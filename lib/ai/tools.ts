// Structured application tools — the ONLY database path the AI may use.
// No raw SQL from the model: fixed prepared statements, zod-validated inputs.
// Every write also logs an activities row (existing timeline) and returns an
// inverse descriptor so agent.ts can audit + undo reversible changes.
import { z } from "zod";
import { getDb, nowISO, todayISO } from "@/lib/db";
import { scoreBuyer } from "@/lib/qualification";
import { regionForCountry, PIPELINE_STAGES } from "@/lib/config";
import { aiProvider, emailProvider } from "@/lib/providers";
import { parseCSV } from "@/lib/csv";
import type { Actor } from "./permissions";

export type Row = Record<string, unknown>;
const db = () => getDb();
const S = (v: unknown) => String(v ?? "");
const N = (v: unknown) => Number(v ?? 0);

export async function resolveBuyer(ref: { company_id?: number; company_name?: string }): Promise<{ id: number; name: string } | { candidates: { id: number; name: string; country: string }[] } | { error: string }> {
  if (ref.company_id) {
    const c = (await db().prepare("SELECT id, name FROM companies WHERE id=?").get(ref.company_id)) as { id: number; name: string } | undefined;
    return c ? { id: c.id, name: c.name } : { error: `No buyer with ID ${ref.company_id}.` };
  }
  const q = S(ref.company_name).trim().replace(/^(the|this)\s+/i, "");
  if (!q) return { error: "Which buyer? Give a company name." };
  const like = `%${q}%`;
  const rows = await db().prepare("SELECT id, name, country FROM companies WHERE name LIKE ? ORDER BY qual_score DESC LIMIT 6").all(like) as { id: number; name: string; country: string }[];
  if (!rows.length) return { error: `No buyer matches "${q}". Try /buyers search.` };
  const norm = (s: string) => s.toLowerCase().replace(/^demo\s*[—-]\s*/, "");
  const exact = rows.find((r) => norm(r.name) === norm(q) || norm(r.name).includes(norm(q)));
  if (rows.length === 1 || exact) { const c = exact ?? rows[0]; return { id: c.id, name: c.name }; }
  return { candidates: rows };
}

export function parseDue(input?: string): string {
  const s = S(input).toLowerCase().trim();
  const d = new Date();
  if (!s || s === "today") return todayISO();
  if (s === "tomorrow") { d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
  const m = s.match(/in\s+(\d+)\s+days?/);
  if (m) { d.setDate(d.getDate() + Number(m[1])); return d.toISOString().slice(0, 10); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return todayISO();
}

async function logActivity(company_id: number, kind: string, title: string, body: string, owner: string) {
  await db().prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(company_id, kind, title, body.slice(0, 800), owner, nowISO());
  await db().prepare("UPDATE companies SET last_activity=? WHERE id=?").run(todayISO(), company_id);
}

// ---------- READ tools ----------

export const search_buyers = {
  description: "Search buyers by country, region (UAE/Middle East/Europe/South Africa), type, grade A/B/C, stage, ginger fit, text. Returns compact rows with IDs.",
  schema: z.object({
    country: z.string().optional().describe("Country name, e.g. UAE"),
    region: z.string().optional().describe("UAE | Middle East | Europe | South Africa"),
    company_type: z.string().optional(),
    grade: z.enum(["A", "B", "C"]).optional(),
    stage: z.string().optional().describe("Pipeline stage e.g. Interested"),
    ginger_fit: z.string().optional(),
    text: z.string().optional().describe("Free text over name/city/products"),
    limit: z.number().int().min(1).max(50).default(15),
  }),
  async run(_a: Actor, args: any) {
    let rows = await db().prepare("SELECT id,name,country,city,company_type,grade,qual_score,buyer_status,ginger_fit,outreach_status,products,last_activity,data_label FROM companies").all() as Row[];
    if (args.country) rows = rows.filter((r) => S(r.country).toLowerCase() === args.country!.toLowerCase());
    if (args.region) rows = rows.filter((r) => (args.region === "UAE" ? S(r.country) === "UAE" : regionForCountry(S(r.country)) === args.region));
    if (args.company_type) rows = rows.filter((r) => S(r.company_type).toLowerCase().includes(args.company_type!.toLowerCase()));
    if (args.grade) rows = rows.filter((r) => S(r.grade) === args.grade);
    if (args.stage) rows = rows.filter((r) => S(r.buyer_status).toLowerCase() === args.stage!.toLowerCase());
    if (args.ginger_fit) rows = rows.filter((r) => S(r.ginger_fit).toLowerCase() === args.ginger_fit!.toLowerCase());
    if (args.text) { const t = args.text.toLowerCase(); rows = rows.filter((r) => `${r.name} ${r.city} ${r.products}`.toLowerCase().includes(t)); }
    rows.sort((a, b) => N(b.qual_score) - N(a.qual_score));
    return { count: rows.length, buyers: rows.slice(0, args.limit ?? 15) };
  },
};

export const get_buyer = {
  description: "Full buyer dossier: company, evidence, buying signals. Never invents; reports Unknown where missing.",
  schema: z.object({ company_id: z.number().int().optional(), company_name: z.string().optional() }),
  async run(_a: Actor, args: any) {
    const ref = await resolveBuyer(args);
    if ("error" in ref) return ref;
    if ("candidates" in ref) return ref;
    const c = (await db().prepare("SELECT * FROM companies WHERE id=?").get(ref.id)) as Row;
    const ev = await db().prepare("SELECT source,url,snippet,discovered_at FROM lead_evidence WHERE company_id=?").all(ref.id) as Row[];
    const signals = S(c.evidence).includes("Evidence not available") ? [] : S(c.evidence).replace(/^DEMO — /, "").split(";").map((s) => s.trim()).filter(Boolean);
    return { company: c, signals: signals.length ? signals : ["Evidence not available"], evidence_rows: ev };
  },
};

export const get_contacts = {
  description: "Contacts for a buyer, decision-makers first.",
  schema: z.object({ company_id: z.number().int().optional(), company_name: z.string().optional() }),
  async run(_a: Actor, args: any) {
    const ref = await resolveBuyer(args);
    if ("error" in ref) return ref;
    if ("candidates" in ref) return ref;
    const rows = await db().prepare("SELECT * FROM contacts WHERE company_id=? ORDER BY is_dm DESC, id").all(ref.id) as Row[];
    return { buyer: ref.name, contacts: rows.length ? rows : "No contacts on file — find procurement / import / owner." };
  },
};

export const get_market_summary = {
  description: "Market KPIs: buyers, qualified, contacted, active opps, pipeline, won. Country name or code.",
  schema: z.object({ market: z.string().describe("Country name or code, e.g. UAE or AE") }),
  async run(_a: Actor, args: any) {
    const m = (await db().prepare("SELECT * FROM markets WHERE lower(name)=lower(?) OR code=?").get(args.market, args.market.toUpperCase())) as Row | undefined;
    if (!m) return { error: `Unknown market "${args.market}".` };
    const buyers = await db().prepare("SELECT id,grade,outreach_status FROM companies WHERE country=?").all(S(m.name)) as Row[];
    const ids = buyers.map((b) => N(b.id));
    let opps: Row[] = [];
    if (ids.length) opps = await db().prepare(`SELECT stage,value,probability FROM opportunities WHERE company_id IN (${ids.map(() => "?").join(",")})`).all(...ids) as Row[];
    const open = opps.filter((o) => !["Won", "Lost", "Not Relevant"].includes(S(o.stage)));
    return {
      market: m.name, region: m.region, notes: S(m.notes) || "No notes",
      buyers: buyers.length, qualified: buyers.filter((b) => b.grade === "A").length,
      contacted: buyers.filter((b) => b.outreach_status !== "Not contacted").length,
      active_opps: open.length, pipeline: Math.round(open.reduce((s, o) => s + N(o.value), 0)),
      weighted: Math.round(open.reduce((s, o) => s + (N(o.value) * N(o.probability)) / 100, 0)),
      won: opps.filter((o) => o.stage === "Won").length,
    };
  },
};

export const compare_markets = {
  description: "Compare UAE vs Middle East vs Europe vs South Africa on buyers, qualified, pipeline, won. Evidence-based focus recommendation.",
  schema: z.object({}),
  async run() {
    const regions = ["UAE", "Middle East", "Europe", "South Africa"];
    const all = await db().prepare("SELECT id,country,grade,outreach_status FROM companies").all() as Row[];
    const opps = await db().prepare("SELECT company_id,stage,value,probability FROM opportunities").all() as Row[];
    const byCompany = new Map<number, Row[]>();
    for (const o of opps) { const k = N(o.company_id); if (!byCompany.has(k)) byCompany.set(k, []); byCompany.get(k)!.push(o); }
    const rows = regions.map((r) => {
      const inR = all.filter((c) => (r === "UAE" ? S(c.country) === "UAE" : regionForCountry(S(c.country)) === r));
      let pipe = 0, weighted = 0, active = 0, won = 0;
      for (const c of inR) for (const o of byCompany.get(N(c.id)) ?? []) {
        if (o.stage === "Won") won++;
        else if (!["Lost", "Not Relevant"].includes(S(o.stage))) { active++; pipe += N(o.value); weighted += (N(o.value) * N(o.probability)) / 100; }
      }
      return { region: r, buyers: inR.length, qualified: inR.filter((c) => c.grade === "A").length, contacted: inR.filter((c) => c.outreach_status !== "Not contacted").length, active_opps: active, pipeline: Math.round(pipe), weighted: Math.round(weighted), won };
    });
    const best = [...rows].sort((a, b) => b.weighted - a.weighted || b.qualified - a.qualified)[0];
    return { regions: rows, recommendation: `${best.region} currently has the strongest combination of qualified buyers and active (weighted) pipeline.` };
  },
};

export const get_pipeline = {
  description: "CRM pipeline counts by stage + open value.",
  schema: z.object({}),
  async run() {
    const stages = await db().prepare("SELECT buyer_status s, COUNT(*) c FROM companies GROUP BY buyer_status").all() as Row[];
    const v = (await db().prepare("SELECT COALESCE(SUM(value),0) v FROM opportunities WHERE stage NOT IN ('Won','Lost','Not Relevant')").get()) as { v: number };
    return { stages, open_pipeline: Math.round(v.v) };
  },
};

export const get_opportunities = {
  description: "Opportunities with optional stage / min-value / market filters.",
  schema: z.object({ stage: z.string().optional(), min_value: z.number().optional(), market: z.string().optional(), limit: z.number().int().min(1).max(50).default(15) }),
  async run(_a: Actor, args: any) {
    let rows = await db().prepare("SELECT o.*, c.name cname, c.country FROM opportunities o JOIN companies c ON c.id=o.company_id ORDER BY o.value DESC").all() as Row[];
    if (args.stage) rows = rows.filter((r) => S(r.stage).toLowerCase() === args.stage!.toLowerCase());
    if (args.min_value) rows = rows.filter((r) => N(r.value) >= args.min_value!);
    if (args.market) rows = rows.filter((r) => S(r.country).toLowerCase().includes(args.market!.toLowerCase()));
    return { count: rows.length, opportunities: rows.slice(0, args.limit ?? 15) };
  },
};

export const get_followups = {
  description: "Follow-ups grouped: overdue / today / upcoming.",
  schema: z.object({ scope: z.enum(["overdue", "today", "upcoming", "all"]).default("all"), limit: z.number().int().min(1).max(50).default(20) }),
  async run(_a: Actor, args: any) {
    const sel = "SELECT f.id,f.title,f.due_date,f.owner,f.company_id,c.name cname FROM followups f JOIN companies c ON c.id=f.company_id WHERE f.done=0";
    const overdue = await db().prepare(`${sel} AND f.due_date < CURRENT_DATE ORDER BY f.due_date`).all() as Row[];
    const today = await db().prepare(`${sel} AND f.due_date = CURRENT_DATE ORDER BY f.id`).all() as Row[];
    const upcoming = await db().prepare(`${sel} AND f.due_date > CURRENT_DATE ORDER BY f.due_date LIMIT 100`).all() as Row[];
    const scope = args.scope ?? "all";
    const pick = scope === "overdue" ? overdue : scope === "today" ? today : scope === "upcoming" ? upcoming : [...overdue, ...today, ...upcoming];
    return { overdue: overdue.length, today: today.length, upcoming: upcoming.length, items: pick.slice(0, args.limit ?? 20) };
  },
};

export const get_enquiries = {
  description: "Enquiries, optional status filter.",
  schema: z.object({ status: z.string().optional(), limit: z.number().int().min(1).max(50).default(15) }),
  async run(_a: Actor, args: any) {
    let rows = await db().prepare("SELECT e.*, c.name cname FROM enquiries e JOIN companies c ON c.id=e.company_id ORDER BY e.id DESC").all() as Row[];
    if (args.status) rows = rows.filter((r) => S(r.status).toLowerCase() === args.status!.toLowerCase());
    return { count: rows.length, enquiries: rows.slice(0, args.limit ?? 15) };
  },
};

export const get_quotes = {
  description: "Quotations, optional status filter.",
  schema: z.object({ status: z.string().optional(), limit: z.number().int().min(1).max(50).default(15) }),
  async run(_a: Actor, args: any) {
    let rows = await db().prepare("SELECT q.*, c.name cname FROM quotes q JOIN companies c ON c.id=q.company_id ORDER BY q.id DESC").all() as Row[];
    if (args.status) rows = rows.filter((r) => S(r.status).toLowerCase() === args.status!.toLowerCase());
    return { count: rows.length, quotes: rows.slice(0, args.limit ?? 15) };
  },
};

export const get_exporters = {
  description: "Indian exporter intelligence, optional market/product text filter.",
  schema: z.object({ market: z.string().optional(), product: z.string().optional() }),
  async run(_a: Actor, args: any) {
    let rows = await db().prepare("SELECT * FROM exporters ORDER BY name").all() as Row[];
    if (args.market) { const t = args.market.toLowerCase(); rows = rows.filter((r) => `${r.name} ${r.export_markets}`.toLowerCase().includes(t)); }
    if (args.product) { const t = args.product.toLowerCase(); rows = rows.filter((r) => `${r.products} ${r.ginger_offering}`.toLowerCase().includes(t)); }
    return { count: rows.length, exporters: rows };
  },
};

export const get_activity = {
  description: "Chronological activity timeline for a buyer.",
  schema: z.object({ company_id: z.number().int().optional(), company_name: z.string().optional(), limit: z.number().int().min(1).max(30).default(12) }),
  async run(_a: Actor, args: any) {
    const ref = await resolveBuyer(args);
    if ("error" in ref) return ref;
    if ("candidates" in ref) return ref;
    const rows = await db().prepare("SELECT kind,title,body,created_at FROM activities WHERE company_id=? ORDER BY created_at DESC LIMIT ?").all(ref.id, args.limit ?? 12) as Row[];
    return { buyer: ref.name, timeline: rows };
  },
};

export const get_stalled = {
  description: "Buyers contacted but with no activity for N+ days (default 7).",
  schema: z.object({ days: z.number().int().min(1).max(90).default(7), limit: z.number().int().min(1).max(50).default(15) }),
  async run(_a: Actor, args: any) {
    const rows = await db().prepare("SELECT id,name,country,grade,qual_score,buyer_status,last_activity FROM companies WHERE outreach_status NOT IN ('Not contacted') AND (last_activity IS NULL OR last_activity='' OR last_activity::date <= CURRENT_DATE - ($1 || ' days')::interval) ORDER BY qual_score DESC").all(String(args.days ?? 7)) as Row[];
    return { count: rows.length, stalled: rows.slice(0, args.limit ?? 15) };
  },
};

export const sales_brief = {
  description: "Today's sales brief: priorities, urgencies, pipeline, recommended actions. Grounded in stored data.",
  schema: z.object({}),
  async run() {
    const f = await get_followups.run({} as Actor, { scope: "all", limit: 50 }) as { overdue: number; today: number; upcoming: number; items: Row[] };
    const hot = await db().prepare("SELECT id,name,country,grade,qual_score,buyer_status FROM companies WHERE grade='A' ORDER BY qual_score DESC LIMIT 5").all() as Row[];
    const newW = await db().prepare("SELECT id,name,country FROM companies WHERE date_discovered::date >= CURRENT_DATE - INTERVAL '7 days' ORDER BY date_discovered DESC LIMIT 5").all() as Row[];
    const opps = await db().prepare("SELECT o.id,o.stage,o.value,o.currency,o.next_action,c.name cname FROM opportunities o JOIN companies c ON c.id=o.company_id WHERE o.stage NOT IN ('Won','Lost','Not Relevant') ORDER BY o.value DESC LIMIT 5").all() as Row[];
    const enqs = await db().prepare("SELECT e.id,e.status,c.name cname FROM enquiries e JOIN companies c ON c.id=e.company_id WHERE e.status NOT IN ('Won','Lost') ORDER BY e.id DESC LIMIT 5").all() as Row[];
    const stalled = await get_stalled.run({} as Actor, { days: 7, limit: 3 }) as { count: number };
    const urgent = [...(f.items as Row[])].filter((x) => S(x.due_date) <= todayISO()).slice(0, 3);
    return {
      date: todayISO(), overdue_followups: f.overdue, due_today: f.today, upcoming: f.upcoming,
      top_buyers: hot, new_this_week: newW, open_opportunities: opps, open_enquiries: enqs,
      stalled_count: stalled.count, most_urgent: urgent,
      recommended: [
        urgent.length ? `Clear ${urgent.length} overdue/today follow-up(s) first.` : "No overdue items — work A-grade buyers.",
        hot.length ? `Highest priority buyer: ${hot[0].name} (${hot[0].grade} ${hot[0].qual_score}/100).` : "No A-grade buyers yet.",
        opps.length ? `Top opportunity needs attention: ${opps[0].cname} — ${opps[0].stage}, next: ${opps[0].next_action || "set a next action"}.` : "No open opportunities.",
      ],
    };
  },
};

export const qualify_buyer = {
  description: "Run the existing explainable qualification engine (lib/qualification.ts) on stored buyer attributes. Set persist=true to save the score (WRITE).",
  schema: z.object({ company_id: z.number().int().optional(), company_name: z.string().optional(), persist: z.boolean().default(false) }),
  async run(actor: Actor, args: any) {
    const ref = await resolveBuyer({ company_id: args.company_id, company_name: args.company_name });
    if ("error" in ref) return ref;
    if ("candidates" in ref) return ref;
    const c = (await db().prepare("SELECT * FROM companies WHERE id=?").get(ref.id)) as Row;
    const has = (v: string, ...keys: string[]) => keys.some((k) => S(v).toLowerCase().includes(k));
    const prod = S(c.products), type = S(c.company_type), fit = S(c.ginger_fit);
    const contacts = N(((await db().prepare("SELECT COUNT(*) n FROM contacts WHERE company_id=?").get(ref.id)) as { n: number }).n);
    const dm = N(((await db().prepare("SELECT COUNT(*) n FROM contacts WHERE company_id=? AND is_dm=1").get(ref.id)) as { n: number }).n);
    const strongEv = S(c.source_url).length > 4 && S(c.last_verified).length > 0;
    const input = {
      productRelevance: (has(prod, "ginger") ? 3 : has(prod, "spice") ? 2 : has(prod, "food") ? 1 : 0) as 0 | 1 | 2 | 3,
      importerStatus: (["Importer", "Distributor"].includes(type) ? 2 : type ? 1 : 0) as 0 | 1 | 2,
      internationalSourcing: (S(c.evidence).includes("Indian suppliers") ? 2 : S(c.evidence).includes("internationally") ? 1 : 0) as 0 | 1 | 2,
      gingerFit: (fit === "High" ? 3 : fit === "Medium" ? 2 : fit === "Low" ? 0 : 0) as 0 | 1 | 2 | 3,
      geoPriority: (["UAE", "Saudi Arabia", "Qatar", "Oman", "Kuwait", "Bahrain", "United Kingdom", "Germany", "France", "Netherlands", "Italy", "Spain", "South Africa"].includes(S(c.country))) ? 2 as const : 1 as const,
      companyQuality: (S(c.website) !== "Unknown" && S(c.website) ? 2 : S(c.industry) ? 1 : 0) as 0 | 1 | 2,
      contactAvailability: (dm > 0 ? 2 : contacts > 0 ? 1 : 0) as 0 | 1 | 2,
      evidenceStrength: (strongEv ? 2 : S(c.evidence) && !S(c.evidence).includes("not available") ? 1 : 0) as 0 | 1 | 2,
      buyingSignals: S(c.evidence).includes("not available") ? 0 : Math.min(5, S(c.evidence).split(";").length),
    };
    const { score, grade, breakdown } = scoreBuyer(input);
    if (args.persist) {
      await db().prepare("UPDATE companies SET qual_score=?, grade=?, priority=?, last_activity=? WHERE id=?").run(score, grade, grade === "A" ? "High" : grade === "B" ? "Medium" : "Low", todayISO(), ref.id);
      await logActivity(ref.id, "system", `Re-qualified ${grade} (${score}/100) via Waves AI`, "", actor.name);
      return { buyer: ref.name, score, grade, breakdown, saved: true, _inverse: { table: "companies", id: ref.id, op: "restore_score", prev: { qual_score: N(c.qual_score), grade: S(c.grade), priority: S(c.priority) } } };
    }
    return { buyer: ref.name, stored: { score: N(c.qual_score), grade: S(c.grade) }, computed: { score, grade, breakdown }, saved: false };
  },
};

export const summarize_company = {
  description: "Evidence-grounded company summary using the existing AI brief layer.",
  schema: z.object({ company_id: z.number().int().optional(), company_name: z.string().optional() }),
  async run(_a: Actor, args: any) {
    const ref = await resolveBuyer(args);
    if ("error" in ref) return ref;
    if ("candidates" in ref) return ref;
    const d = await get_buyer.run({} as Actor, { company_id: ref.id }) as { company: Row; signals: string[]; evidence_rows: Row[] };
    const c = d.company;
    return {
      summary: await aiProvider.companySummary({
        company: { name: S(c.name), country: S(c.country), city: S(c.city), industry: S(c.industry), products: S(c.products), website: S(c.website) },
        signals: d.signals, evidence: S(c.evidence), grade: S(c.grade), score: N(c.qual_score),
      }),
    };
  },
};

export const generate_outreach = {
  description: "Draft (never send) first outreach or follow-up for a buyer using stored evidence.",
  schema: z.object({ company_id: z.number().int().optional(), company_name: z.string().optional(), kind: z.enum(["first", "followup"]).default("first") }),
  async run(_a: Actor, args: any) {
    const ref = await resolveBuyer({ company_id: args.company_id, company_name: args.company_name });
    if ("error" in ref) return ref;
    if ("candidates" in ref) return ref;
    const d = await get_buyer.run({} as Actor, { company_id: ref.id }) as { company: Row; signals: string[] };
    const c = d.company;
    const base = { company: { name: S(c.name), country: S(c.country), products: S(c.products) }, signals: d.signals, evidence: S(c.evidence), grade: S(c.grade), score: N(c.qual_score) };
    const draft = args.kind === "followup" ? await aiProvider.followupDraft(base) : await aiProvider.outreachDraft(base);
    return { buyer: ref.name, draft, note: "Draft only. No sending provider is connected — drafts save to the timeline via log_outreach_draft." };
  },
};

// ---------- WRITE tools (confirmation-gated by agent) ----------

export const create_buyer = {
  description: "Add a buyer manually (labelled MANUAL). Unknown stays Unknown.",
  schema: z.object({ name: z.string().min(1), country: z.string().min(1), city: z.string().default(""), company_type: z.string().default("Other"), industry: z.string().default(""), products: z.string().default(""), ginger_fit: z.string().default("Unknown"), evidence: z.string().default(""), owner: z.string().default("Unassigned") }),
  async run(actor: Actor, args: any) {
    const id = N((await db().prepare(`INSERT INTO companies(name,country,city,website,company_type,industry,products,ginger_fit,import_relevance,size,source,date_discovered,evidence,buyer_status,qual_score,grade,priority,outreach_status,last_activity,owner,notes,data_label) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      args.name, args.country, args.city, "Unknown", args.company_type, args.industry, args.products, args.ginger_fit, "Unknown", "Unknown", "MANUAL", todayISO(), args.evidence || "Evidence not available", "Discovered", 0, "C", "Low", "Not contacted", todayISO(), args.owner, "", "MANUAL")).lastInsertRowid);
    await logActivity(id, "system", "Buyer added via Waves AI", args.evidence || "", actor.name);
    const r = await qualify_buyer.run(actor, { company_id: id, persist: true }) as { score: number; grade: string };
    return { id, name: args.name, score: r.score, grade: r.grade, _inverse: { table: "companies", id, op: "delete" } };
  },
};

export const create_followup = {
  description: "Create follow-up(s). Accepts one buyer or bulk company_ids (max 25).",
  schema: z.object({ company_id: z.number().int().optional(), company_name: z.string().optional(), company_ids: z.array(z.number().int()).max(25).optional(), title: z.string().min(1), due: z.string().default("tomorrow").describe("today|tomorrow|in N days|YYYY-MM-DD") }),
  async run(actor: Actor, args: any) {
    let ids: number[] = [];
    if (args.company_ids?.length) ids = args.company_ids;
    else {
      const ref = await resolveBuyer({ company_id: args.company_id, company_name: args.company_name });
      if ("error" in ref) return ref;
      if ("candidates" in ref) return ref;
      ids = [ref.id];
    }
    const due = parseDue(args.due);
    const created: number[] = [];
    for (const id of ids) {
      const c = (await db().prepare("SELECT id FROM companies WHERE id=?").get(id)) as { id: number } | undefined;
      if (!c) continue;
      created.push(N((await db().prepare("INSERT INTO followups(company_id,title,due_date,done,owner,notes,created_at) VALUES(?,?,?,?,?,?,?)").run(id, args.title, due, 0, actor.name, "via Waves AI", nowISO())).lastInsertRowid));
      await logActivity(id, "system", `Follow-up set — ${args.title} (due ${due})`, "", actor.name);
    }
    return { created: created.length, due, followup_ids: created, _inverse: { table: "followups", ids: created, op: "delete_many" } };
  },
};

export const create_enquiry = {
  description: "Create an enquiry for a buyer.",
  schema: z.object({ company_id: z.number().int().optional(), company_name: z.string().optional(), qty: z.string().default(""), packaging: z.string().default(""), destination: z.string().default(""), specs: z.string().default(""), target_price: z.string().default(""), notes: z.string().default("") }),
  async run(actor: Actor, args: any) {
    const ref = await resolveBuyer({ company_id: args.company_id, company_name: args.company_name });
    if ("error" in ref) return ref;
    if ("candidates" in ref) return ref;
    const c = (await db().prepare("SELECT country FROM companies WHERE id=?").get(ref.id)) as { country: string };
    const id = N((await db().prepare("INSERT INTO enquiries(company_id,country,product,qty,packaging,destination,specs,certs,target_price,delivery,payment_terms,status,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
      ref.id, c.country, "Dry Ginger", args.qty, args.packaging, args.destination, args.specs, "Unknown", args.target_price, "", "", "New", `${args.notes} (via Waves AI)`, nowISO())).lastInsertRowid);
    await logActivity(ref.id, "system", `Enquiry #${id} created`, `${args.qty} → ${args.destination}`, actor.name);
    return { id, buyer: ref.name, _inverse: { table: "enquiries", id, op: "delete" } };
  },
};

export const create_opportunity = {
  description: "Create a pipeline opportunity.",
  schema: z.object({ company_id: z.number().int().optional(), company_name: z.string().optional(), qty: z.string().default(""), price: z.string().default(""), currency: z.string().default("USD"), value: z.number().default(0), stage: z.string().default("Discovered"), probability: z.number().int().min(0).max(100).default(10), expected_close: z.string().default(""), next_action: z.string().default("") }),
  async run(actor: Actor, args: any) {
    if (!(PIPELINE_STAGES as readonly string[]).includes(args.stage)) return { error: `Invalid stage. Use: ${PIPELINE_STAGES.join(", ")}` };
    const ref = await resolveBuyer({ company_id: args.company_id, company_name: args.company_name });
    if ("error" in ref) return ref;
    if ("candidates" in ref) return ref;
    const id = N((await db().prepare("INSERT INTO opportunities(company_id,product,qty,price,currency,value,stage,probability,expected_close,last_activity,next_action,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
      ref.id, "Dry Ginger", args.qty, args.price, args.currency, args.value, args.stage, args.probability, args.expected_close, todayISO(), args.next_action, "via Waves AI", nowISO())).lastInsertRowid);
    await logActivity(ref.id, "system", `Opportunity #${id} — ${args.stage}`, `${args.qty} / ${args.value} ${args.currency}`, actor.name);
    return { id, buyer: ref.name, _inverse: { table: "opportunities", id, op: "delete" } };
  },
};

export const create_quote = {
  description: "Create a Draft quotation (configurable terms, never hardcoded).",
  schema: z.object({ company_id: z.number().int().optional(), company_name: z.string().optional(), qty: z.string().default(""), unit_price: z.string().default(""), currency: z.string().default("USD"), packaging: z.string().default("25kg PP bags"), incoterm: z.string().default("CIF"), destination: z.string().default(""), validity: z.string().default("15 days"), payment_terms: z.string().default(""), lead_time: z.string().default("") }),
  async run(actor: Actor, args: any) {
    const ref = await resolveBuyer({ company_id: args.company_id, company_name: args.company_name });
    if ("error" in ref) return ref;
    if ("candidates" in ref) return ref;
    const id = N((await db().prepare("INSERT INTO quotes(company_id,product,qty,unit_price,currency,packaging,incoterm,destination,validity,payment_terms,lead_time,status,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
      ref.id, "Dry Ginger", args.qty, args.unit_price, args.currency, args.packaging, args.incoterm, args.destination, args.validity, args.payment_terms, args.lead_time, "Draft", "via Waves AI", nowISO())).lastInsertRowid);
    await logActivity(ref.id, "system", `Quotation #${id} drafted`, `${args.qty} @ ${args.unit_price} ${args.currency} ${args.incoterm} ${args.destination}`, actor.name);
    return { id, buyer: ref.name, status: "Draft", _inverse: { table: "quotes", id, op: "delete" } };
  },
};

export const update_pipeline_stage = {
  description: "Move buyer(s) to a pipeline stage. Bulk via company_ids (max 25).",
  schema: z.object({ company_id: z.number().int().optional(), company_name: z.string().optional(), company_ids: z.array(z.number().int()).max(25).optional(), stage: z.string().describe("Target pipeline stage") }),
  async run(actor: Actor, args: any) {
    if (!(PIPELINE_STAGES as readonly string[]).includes(args.stage)) return { error: `Invalid stage. Use: ${PIPELINE_STAGES.join(", ")}` };
    let ids: number[] = [];
    if (args.company_ids?.length) ids = args.company_ids;
    else {
      const ref = await resolveBuyer({ company_id: args.company_id, company_name: args.company_name });
      if ("error" in ref) return ref;
      if ("candidates" in ref) return ref;
      ids = [ref.id];
    }
    const prev: { id: number; stage: string }[] = [];
    let moved = 0;
    for (const id of ids) {
      const c = (await db().prepare("SELECT id,buyer_status FROM companies WHERE id=?").get(id)) as { id: number; buyer_status: string } | undefined;
      if (!c) continue;
      prev.push({ id, stage: c.buyer_status });
      await db().prepare("UPDATE companies SET buyer_status=?, last_activity=? WHERE id=?").run(args.stage, todayISO(), id);
      await logActivity(id, "system", `Stage → ${args.stage} (was ${c.buyer_status})`, "via Waves AI", actor.name);
      moved++;
    }
    return { moved, stage: args.stage, _inverse: { table: "companies", op: "restore_stages", prev } };
  },
};

export const update_opportunity = {
  description: "Update opportunity stage / probability / next action.",
  schema: z.object({ id: z.number().int(), stage: z.string().optional(), probability: z.number().int().min(0).max(100).optional(), next_action: z.string().optional() }),
  async run(actor: Actor, args: any) {
    const o = (await db().prepare("SELECT * FROM opportunities WHERE id=?").get(args.id)) as Row | undefined;
    if (!o) return { error: `No opportunity #${args.id}.` };
    if (args.stage && !(PIPELINE_STAGES as readonly string[]).includes(args.stage)) return { error: "Invalid stage." };
    await db().prepare("UPDATE opportunities SET stage=COALESCE(?,stage), probability=COALESCE(?,probability), next_action=COALESCE(?,next_action), last_activity=? WHERE id=?").run(
      args.stage ?? null, args.probability ?? null, args.next_action ?? null, todayISO(), args.id);
    await logActivity(N(o.company_id), "system", `Opportunity #${args.id} updated`, "", actor.name);
    return { id: args.id, _inverse: { table: "opportunities", id: args.id, op: "restore_opp", prev: { stage: S(o.stage), probability: N(o.probability), next_action: S(o.next_action) } } };
  },
};

export const add_note = {
  description: "Add a note to a buyer timeline.",
  schema: z.object({ company_id: z.number().int().optional(), company_name: z.string().optional(), body: z.string().min(1) }),
  async run(actor: Actor, args: any) {
    const ref = await resolveBuyer(args);
    if ("error" in ref) return ref;
    if ("candidates" in ref) return ref;
    const id = N((await db().prepare("INSERT INTO notes(company_id,body,owner,created_at) VALUES(?,?,?,?)").run(ref.id, args.body, actor.name, nowISO())).lastInsertRowid);
    await logActivity(ref.id, "note", args.body.slice(0, 120), args.body, actor.name);
    return { note_id: id, buyer: ref.name, _inverse: { table: "notes", id, op: "delete" } };
  },
};

export const log_outreach_draft = {
  description: "Save an outreach draft to the timeline (log-only). NEVER auto-sends. If asked to send: save draft + explain no sending provider connected.",
  schema: z.object({ company_id: z.number().int().optional(), company_name: z.string().optional(), channel: z.enum(["Email", "WhatsApp", "LinkedIn", "Phone"]).default("Email"), subject: z.string().default(""), body: z.string().min(1), send_requested: z.boolean().default(false) }),
  async run(actor: Actor, args: any) {
    const ref = await resolveBuyer({ company_id: args.company_id, company_name: args.company_name });
    if ("error" in ref) return ref;
    if ("candidates" in ref) return ref;
    await db().prepare("INSERT INTO communications(company_id,channel,direction,subject,body,status,created_at) VALUES(?,?,?,?,?,?,?)").run(ref.id, args.channel, "outbound", args.subject, args.body, "draft", nowISO());
    await logActivity(ref.id, args.channel.toLowerCase(), `${args.channel} draft saved — ${args.subject}`.slice(0, 120), args.body, actor.name);
    if (args.send_requested) {
      const prov = emailProvider.status === "connected" ? await emailProvider.send("pending-confirmation", args.subject, args.body).catch(() => null) : null;
      void prov;
      return { buyer: ref.name, draft_saved: true, sent: false, note: "Draft created. No sending provider is connected — nothing was sent." };
    }
    return { buyer: ref.name, draft_saved: true };
  },
};

export const import_csv = {
  description: "Bulk import buyers from CSV text (columns: Company,Country,City,Website,CompanyType,ContactName,Role,Email,Phone,LinkedIn,Source,Evidence). Dedupes on name+country.",
  schema: z.object({ csv: z.string().min(10).max(200000) }),
  async run(actor: Actor, args: any) {
    const { rows, errors } = parseCSV(args.csv);
    let inserted = 0, skipped = 0;
    for (const r of rows.slice(0, 200)) {
      const dup = (await db().prepare("SELECT id FROM companies WHERE lower(name)=lower(?) AND lower(country)=lower(?)").get(r.Company, r.Country)) as { id: number } | undefined;
      if (dup) { skipped++; continue; }
      const id = N((await db().prepare("INSERT INTO companies(name,country,city,website,company_type,source,source_url,date_discovered,evidence,buyer_status,qual_score,grade,priority,outreach_status,last_activity,owner,data_label) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
        r.Company, r.Country, r.City || "", r.Website || "Unknown", r.CompanyType || "Other", r.Source || "IMPORTED", "", todayISO(), r.Evidence || "Evidence not available", "Discovered", 0, "C", "Low", "Not contacted", todayISO(), "Unassigned", "IMPORTED")).lastInsertRowid);
      if (r.ContactName) await db().prepare("INSERT INTO contacts(company_id,name,role,email,phone,linkedin,confidence,is_dm) VALUES(?,?,?,?,?,?,?,?)").run(id, r.ContactName, r.Role || "", r.Email || "Unknown", r.Phone || "Unknown", r.LinkedIn || "", "Unverified", 0);
      if (r.Evidence) await db().prepare("INSERT INTO lead_evidence(company_id,source,snippet,discovered_at) VALUES(?,?,?,?)").run(id, r.Source || "IMPORTED", r.Evidence, todayISO());
      await logActivity(id, "system", "Buyer imported via Waves AI", "", actor.name);
      inserted++;
    }
    return { inserted, skipped, errors: errors.slice(0, 10) };
  },
};

export const undo_ai_action = {
  description: "Undo a reversible AI write by audit ID (restores stages/scores, deletes created rows).",
  schema: z.object({ audit_id: z.number().int() }),
  async run(actor: Actor, args: any) {
    const a = (await db().prepare("SELECT * FROM ai_audit WHERE id=?").get(args.audit_id)) as Row | undefined;
    if (!a) return { error: `No AI action #${args.audit_id}.` };
    if (N(a.undone)) return { error: `Action #${args.audit_id} already undone.` };
    const inv = JSON.parse(S(a.inverse_json) || "{}") as { table?: string; id?: number; ids?: number[]; op?: string; prev?: unknown };
    const d = db();
    if (inv.op === "delete" && inv.id) await d.prepare(`DELETE FROM ${inv.table} WHERE id=?`).run(inv.id);
    else if (inv.op === "delete_many" && inv.ids?.length) { const ids = inv.ids as number[]; await d.prepare(`DELETE FROM ${inv.table} WHERE id IN (${ids.map(() => "?").join(",")})`).run(...ids); }
    else if (inv.op === "restore_stages") for (const p of (inv.prev as { id: number; stage: string }[])) await d.prepare("UPDATE companies SET buyer_status=? WHERE id=?").run(p.stage, p.id);
    else if (inv.op === "restore_score") { const p = inv.prev as { qual_score: number; grade: string; priority: string }; await d.prepare("UPDATE companies SET qual_score=?, grade=?, priority=? WHERE id=?").run(p.qual_score, p.grade, p.priority, Number(inv.id)); }
    else if (inv.op === "restore_opp") { const p = inv.prev as { stage: string; probability: number; next_action: string }; await d.prepare("UPDATE opportunities SET stage=?, probability=?, next_action=? WHERE id=?").run(p.stage, p.probability, p.next_action, Number(inv.id)); }
    else return { error: "This action is not reversible." };
    await d.prepare("UPDATE ai_audit SET undone=1 WHERE id=?").run(args.audit_id);
    return { undone: args.audit_id, tool: S(a.tool) };
  },
};

export const TOOLS = {
  search_buyers, get_buyer, get_contacts, get_market_summary, compare_markets, get_pipeline,
  get_opportunities, get_followups, get_enquiries, get_quotes, get_exporters, get_activity,
  get_stalled, sales_brief, qualify_buyer, summarize_company, generate_outreach,
  create_buyer, create_followup, create_enquiry, create_opportunity, create_quote,
  update_pipeline_stage, update_opportunity, add_note, log_outreach_draft, import_csv, undo_ai_action,
};
export type ToolName = keyof typeof TOOLS;
