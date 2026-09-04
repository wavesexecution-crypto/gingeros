// WAVES AI orchestrator — tool-calling control layer (not a chatbot).
// Two engines, same guarantees: Ollama model loop (primary) + deterministic
// rule-based fallback (works with no live provider). Both enforce:
// READ executes immediately, WRITE needs HMAC-signed confirmation,
// never auto-send, evidence-only answers, RBAC per tool, full audit.
import crypto from "node:crypto";
import { z } from "zod";
import { getDb, nowISO, todayISO } from "@/lib/db";
import { COUNTRIES, PIPELINE_STAGES } from "@/lib/config";
import { TOOLS, type ToolName } from "./tools";
import { assertToolAccess, toolKind, type Actor } from "./permissions";
import { SYSTEM_PROMPT, contextBlock } from "./prompts";
import { ollamaChat, toolSpec, parseActionBlocks } from "./ollama";
import type { ChatMsg, LastState, PageCtx } from "./context";

export interface Card { title: string; meta: string; href: string }
export interface PendingAction { token: string; tool: string; summary: string; target: string; count: number }
export interface AgentResult { reply: string; cards: Card[]; actions: PendingAction[]; provider: "ollama" | "local"; lastState: LastState; audits: number[] }

function secret() { return process.env.AUTH_SECRET || "dev-only-change-me-ginger-os"; }

export function ensureAuditTable() {
  getDb().exec(`CREATE TABLE IF NOT EXISTS ai_audit(
    id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL,
    user_email TEXT DEFAULT '', user_request TEXT DEFAULT '', tool TEXT NOT NULL,
    target TEXT DEFAULT '', args_json TEXT DEFAULT '', result TEXT DEFAULT '',
    undone INTEGER DEFAULT 0, inverse_json TEXT DEFAULT '')`);
}

function signAction(tool: string, args: Record<string, unknown>, email: string): string {
  const payload = JSON.stringify({ tool, args, email, exp: Date.now() + 15 * 60 * 1000 });
  const b = Buffer.from(payload).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(b).digest("base64url");
  return `${b}.${sig}`;
}

function verifyAction(token: string, email: string): { tool: string; args: Record<string, unknown> } | null {
  try {
    const [b, sig] = token.split(".");
    if (crypto.createHmac("sha256", secret()).update(b).digest("base64url") !== sig) return null;
    const p = JSON.parse(Buffer.from(b, "base64url").toString()) as { tool: string; args: Record<string, unknown>; email: string; exp: number };
    if (p.email !== email || p.exp < Date.now()) return null;
    if (!(p.tool in TOOLS)) return null;
    return { tool: p.tool, args: p.args };
  } catch { return null; }
}

function auditWrite(actor: Actor, req: string, tool: string, target: string, args: unknown, result: unknown, inverse: unknown): number {
  ensureAuditTable();
  return Number(getDb().prepare("INSERT INTO ai_audit(created_at,user_email,user_request,tool,target,args_json,result,inverse_json) VALUES(?,?,?,?,?,?,?,?)").run(
    nowISO(), actor.email, req.slice(0, 500), tool, target.slice(0, 200), JSON.stringify(args).slice(0, 2000), JSON.stringify(result).slice(0, 2000), JSON.stringify(inverse ?? null)).lastInsertRowid);
}

const S = (v: unknown) => String(v ?? "");
const N = (v: unknown) => Number(v ?? 0);
type AnyTool = { description: string; schema: z.ZodTypeAny; run: (a: Actor, args: any) => unknown };

async function execTool(actor: Actor, tool: ToolName, args: Record<string, unknown>): Promise<{ ok: boolean; data?: unknown; error?: string; inverse?: unknown }> {
  try {
    assertToolAccess(actor, tool);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const t = TOOLS[tool] as AnyTool;
  const parsed = t.schema.safeParse(args);
  if (!parsed.success) return { ok: false, error: `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}` };
  try {
    const data = (await t.run(actor, parsed.data)) as Record<string, unknown>;
    if (data && typeof data === "object" && ("error" in data)) return { ok: false, error: S((data as { error: unknown }).error) };
    const { _inverse, ...rest } = (data ?? {}) as { _inverse?: unknown };
    return { ok: true, data: rest, inverse: _inverse };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function summarizeWrite(tool: ToolName, args: Record<string, unknown>): { summary: string; target: string; count: number } {
  const g = (k: string) => S(args[k] ?? "");
  switch (tool) {
    case "create_followup": {
      const n = Array.isArray(args.company_ids) ? args.company_ids.length : 1;
      return { summary: `Create follow-up "${g("title")}" due ${g("due") || "tomorrow"}`, target: g("company_name") || (n > 1 ? `${n} buyers` : `company ${g("company_id")}`), count: n };
    }
    case "update_pipeline_stage": {
      const n = Array.isArray(args.company_ids) ? args.company_ids.length : 1;
      return { summary: `Move to stage "${g("stage")}"`, target: g("company_name") || (n > 1 ? `${n} buyers` : `company ${g("company_id")}`), count: n };
    }
    case "create_opportunity": return { summary: `Create opportunity (${g("qty") || "?"} / value ${g("value") || "?"})`, target: g("company_name") || `company ${g("company_id")}`, count: 1 };
    case "create_enquiry": return { summary: `Create enquiry (${g("qty") || "?"} → ${g("destination") || "?"})`, target: g("company_name") || `company ${g("company_id")}`, count: 1 };
    case "create_quote": return { summary: `Create Draft quote (${g("qty") || "?"} @ ${g("unit_price") || "?"} ${g("currency")})`, target: g("company_name") || `company ${g("company_id")}`, count: 1 };
    case "create_buyer": return { summary: `Add buyer "${g("name")}" (${g("country")})`, target: g("name"), count: 1 };
    case "import_csv": return { summary: "Import buyers from CSV", target: "buyer database", count: -1 };
    case "log_outreach_draft": return { summary: `Save ${g("channel") || "Email"} draft${args.send_requested ? " (send requested — will NOT send, no provider)" : ""}`, target: g("company_name") || `company ${g("company_id")}`, count: 1 };
    case "add_note": return { summary: "Add timeline note", target: g("company_name") || `company ${g("company_id")}`, count: 1 };
    case "update_opportunity": return { summary: `Update opportunity #${g("id")}`, target: `opportunity #${g("id")}`, count: 1 };
    case "qualify_buyer": return { summary: "Re-qualify and save score", target: g("company_name") || `company ${g("company_id")}`, count: 1 };
    default: return { summary: tool, target: "", count: 1 };
  }
}

// ---------- formatting ----------
function buyerCards(rows: Record<string, unknown>[]): Card[] {
  return rows.slice(0, 8).map((r) => ({ title: S(r.name), meta: `${S(r.grade)} ${S(r.qual_score)}/100 · ${S(r.buyer_status || r.stage)} · ${S(r.country)}`, href: `/buyers/${S(r.id)}` }));
}
function fmtBuyers(title: string, rows: Record<string, unknown>[], total: number): string {
  if (!rows.length) return `${title}\nNo matches. Try widening filters or /buyers.`;
  const lines = rows.slice(0, 8).map((r, i) => `${i + 1}. ${r.name} — ${r.grade} ${r.qual_score}/100 · ${r.buyer_status} · ${r.country}`);
  return `${title} — found ${total}\n${lines.join("\n")}${total > 8 ? `\n…and ${total - 8} more.` : ""}`;
}

// ---------- local deterministic orchestrator ----------
const COUNTRY_NAMES = COUNTRIES.map((c) => c.name);
const TYPE_KEYS: [RegExp, string][] = [
  [/importer/i, "Importer"], [/distributor/i, "Distributor"], [/wholesaler/i, "Wholesaler"],
  [/spice compan|spice co/i, "Spice company"], [/ingredient/i, "Food ingredient company"],
  [/beverage|drink|tea/i, "Beverage manufacturer"], [/food manufact/i, "Food manufacturer"],
  [/hotel|horeca/i, "Hotel supplier"], [/restaurant|cater/i, "Restaurant supplier"], [/trad/i, "Trading company"],
];
const STAGE_KEYS = [...PIPELINE_STAGES].sort((a, b) => b.length - a.length);

function extractFilters(msg: string): { country?: string; region?: string; company_type?: string; grade?: "A" | "B" | "C"; stage?: string; ginger_fit?: string; text?: string } {
  const f: ReturnType<typeof extractFilters> = {};
  for (const c of COUNTRY_NAMES) if (new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(msg)) { f.country = c; break; }
  if (!f.country) {
    if (/\bUAE\b|emirates|dubai|sharjah|abu dhabi/i.test(msg)) f.country = "UAE";
    else if (/europe|european|uk|german|france|netherlands|italy|spain|britain|london|hamburg|rotterdam|paris|milan/i.test(msg)) f.region = "Europe";
    else if (/middle east|saudi|qatar|oman|kuwait|bahrain|gulf/i.test(msg) && !/uae/i.test(msg)) f.region = "Middle East";
    else if (/south africa|cape town|johannesburg|durban|joburg/i.test(msg)) f.region = "South Africa";
  }
  const gm = msg.match(/\b([ABC])[\s-]?grade\b|grade\s+([ABC])\b|(high|medium|low)[\s-]?priority/i);
  if (gm) f.grade = (gm[1] || gm[2] || (gm[3]?.toLowerCase() === "high" ? "A" : gm[3]?.toLowerCase() === "medium" ? "B" : "C")) as "A" | "B" | "C";
  for (const [re, t] of TYPE_KEYS) if (re.test(msg)) { f.company_type = t; break; }
  for (const s of STAGE_KEYS) if (new RegExp(`\\b${s}\\b`, "i").test(msg)) { f.stage = s; break; }
  if (/high fit|good fit|strong fit/i.test(msg)) f.ginger_fit = "High";
  return f;
}

function stageFuzzy(s: string): string | null {
  const t = s.toLowerCase().trim();
  if (/quot/.test(t)) return "Quotation Sent";
  const hit = PIPELINE_STAGES.find((p) => p.toLowerCase() === t) ?? PIPELINE_STAGES.find((p) => p.toLowerCase().startsWith(t) || t.startsWith(p.toLowerCase()));
  return hit ?? null;
}

async function localRun(actor: Actor, msg: string, page: PageCtx & { companyName?: string; marketName?: string }, last: LastState, userReq: string): Promise<{ reply: string; cards: Card[]; actions: PendingAction[]; lastState: LastState }> {
  const cards: Card[] = [];
  const actions: PendingAction[] = [];
  const out = (reply: string, extra?: Partial<{ cards: Card[]; actions: PendingAction[]; lastState: LastState }>) =>
    ({ reply, cards: extra?.cards ?? cards, actions: extra?.actions ?? actions, lastState: extra?.lastState ?? last });
  const need = (tool: ToolName, args: Record<string, unknown>, note?: string) => {
    try { assertToolAccess(actor, tool); } catch (e) { return out((e as Error).message); }
    const s = summarizeWrite(tool, args);
    const r = out(`${note ?? "Ready to execute."}\n\nACTION\n${s.summary}\nTARGET\n${s.target}${s.count > 1 ? `\nRECORDS\n${s.count}` : ""}\n\n[CONFIRM] [CANCEL]`, {
      actions: [{ token: signAction(tool, args, actor.email), tool, summary: s.summary, target: s.target, count: s.count }],
    });
    return r;
  };
  const m = msg;

  // undo
  if (/^\s*(undo|revert)(\s+that|\s+last|\s+it)?\s*[.?]?\s*$/i.test(m)) {
    ensureAuditTable();
    const a = getDb().prepare("SELECT id FROM ai_audit WHERE user_email=? AND undone=0 ORDER BY id DESC LIMIT 1").get(actor.email) as { id: number } | undefined;
    if (!a) return out("Nothing to undo — no recent AI write found.");
    const r = await execTool(actor, "undo_ai_action", { audit_id: a.id });
    if (!r.ok) return out(r.error!);
    auditWrite(actor, userReq, "undo_ai_action", `#${a.id}`, { audit_id: a.id }, r.data, null);
    return out(`Undone AI action #${a.id}.`);
  }
  // brief
  if (/brief|today'?s sales|daily|good morning|what.*(need|do|focus|matter)|my day|action list/i.test(m) && !/follow.?up/i.test(m)) {
    const r = await execTool(actor, "sales_brief", {});
    if (!r.ok) return out(r.error!);
    const d = r.data as Record<string, unknown>;
    const L = (arr: unknown, fn: (x: Record<string, unknown>) => string) => ((arr as Record<string, unknown>[]) ?? []).map(fn).join("\n");
    return out(`TODAY'S SALES BRIEF — ${d.date}\nOverdue ${d.overdue_followups} · Due today ${d.due_today} · Upcoming ${d.upcoming}\n\nTOP BUYERS\n${L(d.top_buyers, (b) => `• ${b.name} — ${b.grade} ${b.qual_score}/100 · ${b.buyer_status}`) || "—"}\n\nOPEN OPPORTUNITIES\n${L(d.open_opportunities, (o) => `• ${o.cname} — ${o.stage} · ${o.value} ${o.currency} · next: ${o.next_action || "—"}`) || "—"}\n\nRECOMMENDED\n${((d.recommended as string[]) ?? []).map((x) => `• ${x}`).join("\n")}\n\n[Open follow-ups] /followups`, { cards: buyerCards(((d.top_buyers as Record<string, unknown>[]) ?? []).map((b) => ({ ...b, country: "" }))) });
  }
  // markets
  if (/which market|compare market|market.*(focus|best|strongest|worth)|focus.*market/i.test(m)) {
    const r = await execTool(actor, "compare_markets", {});
    if (!r.ok) return out(r.error!);
    const d = r.data as { regions: Record<string, unknown>[]; recommendation: string };
    const rows = d.regions.map((x) => `${x.region}: ${x.buyers} buyers · ${x.qualified} A · ${x.active_opps} opps · pipe ${x.pipeline} · weighted ${x.weighted} · won ${x.won}`).join("\n");
    return out(`MARKET COMPARISON\n${rows}\n\n${d.recommendation}`);
  }
  // single market summary ("how is UAE", "top buyers here")
  const mktMatch = m.match(/(?:how is|about|top buyers(?: in| for| here)?|show|market)\s+([A-Za-z ]+)/i);
  if ((/market|top buyers here|buyers here/i.test(m) && (page.market || page.marketName)) || (mktMatch && COUNTRY_NAMES.some((c) => mktMatch[1].toLowerCase().includes(c.toLowerCase())))) {
    const market = page.marketName || page.market || COUNTRY_NAMES.find((c) => m.toLowerCase().includes(c.toLowerCase()))!;
    const r = await execTool(actor, "get_market_summary", { market });
    if (!r.ok) return out(r.error!);
    const d = r.data as Record<string, unknown>;
    return out(`${String(d.market).toUpperCase()} — MARKET INTELLIGENCE\nBuyers ${d.buyers} · Qualified ${d.qualified} · Contacted ${d.contacted} · Active opps ${d.active_opps}\nPipeline ${d.pipeline} · Weighted ${d.weighted} · Won ${d.won}\nNotes: ${d.notes}`);
  }
  // follow-ups read
  if (/follow.?up|overdue|due today|need to do|chase|haven'?t replied|no response|not respond/i.test(m) && !/create|set|schedule|add/i.test(m)) {
    const scope = /overdue/i.test(m) ? "overdue" : /today/i.test(m) ? "today" : "all";
    const r = await execTool(actor, "get_followups", { scope, limit: 20 });
    if (!r.ok) return out(r.error!);
    const d = r.data as { overdue: number; today: number; upcoming: number; items: Record<string, unknown>[] };
    const lines = d.items.slice(0, 10).map((x) => `• ${x.title} — ${x.cname} · due ${x.due_date}`).join("\n") || "—";
    return out(`FOLLOW-UPS — overdue ${d.overdue} · today ${d.today} · upcoming ${d.upcoming}\n${lines}\n\n[Open follow-ups] /followups`);
  }
  // outreach draft / send
  if (/draft|write.*(email|mail|message|outreach)|prepare.*(outreach|email)|send.*(email|outreach|message)/i.test(m)) {
    const name = (/for\s+([A-Z][\w .&'-]+)/i.exec(m)?.[1] ?? /to\s+([A-Z][\w .&'-]+)/i.exec(m)?.[1] ?? "").replace(/\s+(tomorrow|today)$/i, "").trim();
    const send = /\bsend\b/i.test(m);
    const ref = name || page.companyName;
    const kind = /follow/i.test(m) ? "followup" : "first";
    const g = await execTool(actor, "generate_outreach", { ...(page.companyId && !name ? { company_id: page.companyId } : {}), ...(ref ? { company_name: ref } : {}), kind });
    if (!g.ok) return out(g.error!);
    const d = g.data as { buyer: string; draft: string };
    if (!send) return out(`DRAFT — ${d.buyer}\n${d.draft}\n\nDraft only — nothing sent. Say "save this draft" to log it to the timeline.`);
    return need("log_outreach_draft", { company_name: d.buyer, channel: /whatsapp/i.test(m) ? "WhatsApp" : /linkedin/i.test(m) ? "LinkedIn" : "Email", subject: "Dry ginger from India", body: d.draft, send_requested: true }, "External sends need explicit confirmation — and no sending provider is connected, so this will only save a draft.");
  }
  if (/save (this|the) draft/i.test(m) && page.companyId) {
    const g = await execTool(actor, "generate_outreach", { company_id: page.companyId, kind: "first" });
    if (!g.ok) return out(g.error!);
    const d = g.data as { buyer: string; draft: string };
    return need("log_outreach_draft", { company_id: page.companyId, channel: "Email", subject: "Dry ginger from India", body: d.draft }, "Saving draft to the buyer timeline (no send).");
  }
  // qualify
  if (/qualif/i.test(m)) {
    const name = /(?:qualify|re-qualify|score)\s+(?:this\s+buyer|(.+))?/i.exec(m)?.[1]?.trim();
    const save = /save|apply|persist/i.test(m);
    const r = await execTool(actor, "qualify_buyer", { ...(page.companyId && !name ? { company_id: page.companyId } : {}), ...(name ? { company_name: name } : {}), persist: false });
    if (!r.ok) return out(r.error!);
    const d = r.data as { buyer: string; stored: { score: number; grade: string }; computed: { score: number; grade: string; breakdown: { label: string; points: number; max: number; reason: string }[] } };
    const lines = d.computed.breakdown.map((b) => `• ${b.label}: ${b.points}/${b.max} — ${b.reason}`).join("\n");
    const head = `${d.buyer} — ${d.computed.score}/100 · GRADE ${d.computed.grade} (stored: ${d.stored.score}/${d.stored.grade})\n${lines}`;
    if (save && (d.computed.score !== d.stored.score || d.computed.grade !== d.stored.grade)) {
      const cfg = await execTool(actor, "qualify_buyer", { company_name: d.buyer, persist: false });
      void cfg;
      return need("qualify_buyer" as ToolName, { company_name: d.buyer, persist: true }, head + "\n\nSave this score?");
    }
    return out(head);
  }
  // research
  if (/research|tell me about|profile of|look (into|up)|about\s+[A-Z]|who is|brief me/i.test(m) || (/this (buyer|company|guy|one)/i.test(m) && page.companyId)) {
    const name = /(?:research|about|profile of|look (?:into|up)|who is)\s+([A-Z][\w .&'-]+)/i.exec(m)?.[1]?.replace(/\s+[.?]$/, "").trim();
    const b = await execTool(actor, "get_buyer", { ...(page.companyId && !name ? { company_id: page.companyId } : {}), ...(name ? { company_name: name } : {}) });
    if (!b.ok) return out(b.error!);
    const d = b.data as { company: Record<string, unknown>; signals: string[] };
    const c = d.company;
    const ct = await execTool(actor, "get_contacts", { company_id: N(c.id) });
    const ac = await execTool(actor, "get_activity", { company_id: N(c.id), limit: 6 });
    const contacts = ct.ok ? ((ct.data as { contacts: unknown }).contacts as Record<string, unknown>[]) : [];
    const timeline = ac.ok ? ((ac.data as { timeline: Record<string, unknown>[] }).timeline ?? []) : [];
    return out(`RESEARCH — ${c.name}\n${c.city}, ${c.country} · ${c.company_type} · Fit ${c.ginger_fit} · ${c.grade} ${c.qual_score}/100 · Stage ${c.buyer_status}\n\nBUYING SIGNALS\n${d.signals.map((s) => `• ${s}`).join("\n")}\n\nCONTACTS\n${Array.isArray(contacts) && contacts.length ? contacts.map((x) => `• ${x.name} — ${x.role} (${x.email})`).join("\n") : "No contacts — find procurement / import / owner."}\n\nRECENT ACTIVITY\n${timeline.map((x) => `• ${x.title} · ${S(x.created_at).slice(0, 10)}`).join("\n") || "—"}\nEvidence: ${c.evidence}`, { cards: [{ title: S(c.name), meta: `${c.grade} ${c.qual_score}/100 · ${c.buyer_status}`, href: `/buyers/${c.id}` }] });
  }
  // create follow-up (also bulk)
  if (/(create|set|schedule|add).*(follow|reminder|task)|follow.?up.*(tomorrow|today|for)/i.test(m)) {
    let ids: number[] | undefined;
    let single: { company_id?: number; company_name?: string } = {};
    if (/(these|those|them|all three|these three|these buyers|for them)/i.test(m) && last.ids?.length) ids = last.ids;
    else if (/everyone|all.*(not|n'?t).*(replied|responded|response)|no response|haven'?t replied/i.test(m)) {
      const all = await execTool(actor, "search_buyers", { limit: 50 });
      const rows = ((all.ok ? (all.data as { buyers: Record<string, unknown>[] }).buyers : []) ?? []).filter((r) => ["Contacted", "Follow-up 1", "Follow-up 2", "No response"].includes(S(r.outreach_status)));
      ids = rows.map((r) => N(r.id));
      if (!ids.length) return out("No buyers awaiting a first-outreach response found.");
    } else {
      const name = /(?:for|with)\s+([A-Z][\w .&'-]+?)(?:\s+(?:for |tomorrow|today|on |next )|$)/i.exec(m)?.[1]?.trim();
      if (name && !/^(tomorrow|today|them|these)$/i.test(name)) single = { company_name: name };
      else if (page.companyId) single = { company_id: page.companyId };
      else return out("Which buyer? Name one, open a buyer profile and say \"follow up with this buyer tomorrow\", or list buyers first then say \"create follow-ups for these\".");
    }
    const titleM = /["“](.+?)["”]/.exec(m);
    const title = titleM?.[1] ?? (/call/i.test(m) ? "Call procurement manager" : /spec/i.test(m) ? "Send product specifications" : /quot/i.test(m) ? "Send quotation" : "Follow up");
    const dueM = /for\s+(tomorrow|today|in \d+ days|\d{4}-\d{2}-\d{2})/i.exec(m);
    return need("create_followup", { ...single, ...(ids ? { company_ids: ids } : {}), title, due: (dueM?.[1] ?? "tomorrow").toLowerCase() });
  }
  // move stage (also bulk "these")
  {
    const mv = /move\s+(.+?)\s+to\s+([A-Za-z ]+?)\s*[.?]?\s*$/i.exec(m);
    if (/move|stage|pipeline/i.test(m) && (mv || /(these|those|them)/i.test(m))) {
      let ids: number[] | undefined;
      let single: { company_id?: number; company_name?: string } = {};
      const who = (mv?.[1] ?? "").trim();
      if (/(these|those|them|all three)/i.test(who || m) && last.ids?.length && (!who || /these|those|them/i.test(who))) ids = last.ids;
      else if (who && page.companyId && /^(this|it|him|them|buyer|company|guy)\b/i.test(who)) single = { company_id: page.companyId };
      else if (who) single = { company_name: who };
      else if (page.companyId) single = { company_id: page.companyId };
      else return out("Which buyer should I move?");
      const stage = stageFuzzy(mv?.[2] ?? "");
      if (!stage) return out(`Unknown stage. Use: ${PIPELINE_STAGES.join(", ")}`);
      const cur = single.company_id ? (getDb().prepare("SELECT buyer_status FROM companies WHERE id=?").get(single.company_id) as { buyer_status: string } | undefined) : null;
      return need("update_pipeline_stage", { ...single, ...(ids ? { company_ids: ids } : {}), stage }, cur ? `${who || "Buyer"} is currently in ${cur.buyer_status}.` : undefined);
    }
  }
  // create opportunity / enquiry / quote
  {
    const mk = /(create|new|raise|make).*(opportunity|opportunit|enquiry|enquiries|quote|quotation)/i.exec(m);
    if (mk) {
      const kind = /opportunit/i.test(mk[2]) ? "opp" : /enquir/i.test(mk[2]) ? "enq" : "quote";
      const name = /(?:for|with)\s+([A-Z][\w .&'-]+?)(?:\s+\d|\s+for\s+tomorrow|$)/i.exec(m)?.[1]?.trim();
      const ref = name ? { company_name: name } : page.companyId ? { company_id: page.companyId } : null;
      if (!ref) return out(`Which buyer is the ${kind === "opp" ? "opportunity" : kind === "enq" ? "enquiry" : "quote"} for?`);
      const qty = /(\d+(?:\.\d+)?\s?(?:MT|kg|tons?|containers?))/i.exec(m)?.[1] ?? "";
      const val = / Ganesh? \$?([\d,]+)/.exec(m)?.[1]?.replace(/,/g, "") ?? /value\s*([\d,]+)/i.exec(m)?.[1]?.replace(/,/g, "") ?? "";
      if (kind === "opp") return need("create_opportunity", { ...ref, qty, value: val ? Number(val) : 0, next_action: "Confirm requirements" });
      if (kind === "enq") return need("create_enquiry", { ...ref, qty });
      const dest = /(?:to|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*$/i.exec(m)?.[1] ?? "";
      return need("create_quote", { ...ref, qty, destination: dest });
    }
  }
  // stalled
  if (/stall|no activity|gone quiet|inactive|dormant|7 days|haven'?t heard/i.test(m)) {
    const d = Number(/(\d+)\s*days?/.exec(m)?.[1] ?? 7);
    const r = await execTool(actor, "get_stalled", { days: d, limit: 15 });
    if (!r.ok) return out(r.error!);
    const dd = r.data as { count: number; stalled: Record<string, unknown>[] };
    return out(fmtBuyers(`STALLED (${d}+ days, contacted)`, dd.stalled, dd.count), { cards: buyerCards(dd.stalled), lastState: { ...last, ids: dd.stalled.map((x) => N(x.id)) } });
  }
  // opportunities read
  if (/opportunit|pipeline value|above \$|deal/i.test(m)) {
    const val = /\$?([\d,]+)\+?/.exec(m)?.[1]?.replace(/,/g, "");
    const r = await execTool(actor, "get_opportunities", { ...(val && Number(val) >= 100 ? { min_value: Number(val) } : {}), limit: 12 });
    if (!r.ok) return out(r.error!);
    const d = r.data as { count: number; opportunities: Record<string, unknown>[] };
    const lines = d.opportunities.map((o) => `• ${o.cname} — ${o.stage} · ${o.value} ${o.currency} · next: ${o.next_action || "—"}`).join("\n") || "—";
    return out(`OPPORTUNITIES (${d.count})\n${lines}`);
  }
  // exporters
  if (/exporter|indian supplier|competitor/i.test(m)) {
    const r = await execTool(actor, "get_exporters", {});
    if (!r.ok) return out(r.error!);
    const d = r.data as { count: number; exporters: Record<string, unknown>[] };
    return out(`INDIAN EXPORTERS (${d.count}) — not buyers; verify before relying\n${d.exporters.slice(0, 8).map((e) => `• ${e.name} — ${e.location} · ${e.ginger_offering}`).join("\n")}`);
  }
  // add note
  {
    const nm = /(add|leave|log).*(note).*(?:for|on|to)\s+([A-Z][\w .&'-]+?)\s*:\s*(.+)/i.exec(m) ?? /(add|leave|log).*(note)\s*:\s*(.+)/i.exec(m);
    if (nm) {
      const hasTarget = nm.length > 4;
      const target = hasTarget ? nm[3] : undefined;
      const body = hasTarget ? nm[4] : nm[3];
      const ref = target ? { company_name: target } : page.companyId ? { company_id: page.companyId } : null;
      if (!ref) return out("Which buyer should the note go on?");
      return need("add_note", { ...ref, body });
    }
  }
  // buyer search (default for discovery phrasing)
  if (/find|show|search|list|get|give me|which|best|top|high.?priority|a.?grade|importer|buyer|companies|distributor/i.test(m)) {
    const refine = /^(only|just|filter|narrow|and |but )|only (show|list)/i.test(m.trim());
    const f = extractFilters(m);
    const merged = { ...(refine || !Object.keys(f).length ? last.filters ?? {} : {}), ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)) };
    if (!Object.keys(merged).length) return out("What should I filter by? Try: \"A-grade UAE importers\" or \"interested European spice companies\".");
    const r = await execTool(actor, "search_buyers", { ...merged, limit: 15 });
    if (!r.ok) return out(r.error!);
    const d = r.data as { count: number; buyers: Record<string, unknown>[] };
    const label = [merged.grade ? `${merged.grade}-grade` : "", merged.country || merged.region || "", merged.company_type || "buyers", merged.stage || ""].filter(Boolean).join(" · ");
    return out(fmtBuyers(`FOUND ${d.count} — ${label || "buyers"}`, d.buyers, d.count), {
      cards: buyerCards(d.buyers),
      lastState: { ids: d.buyers.map((b) => N(b.id)), filters: merged as LastState["filters"] },
    });
  }
  if (/help|what can you do|commands|examples/i.test(m)) {
    return out(`WAVES AI — operate the sales OS by talking.\n• "A-grade UAE importers" — filtered buyer search\n• "Research Gulf Spice" — evidence dossier\n• "Qualify this buyer" — explainable score\n• "Create follow-up for X tomorrow" — with confirmation\n• "Move X to Negotiation" — with confirmation\n• "Today's brief" / "Which market should I focus on?"\n• "Create a quote for X, 3 MT to Jeddah"\nReads run instantly. Writes always ask first. I never send external messages.`);
  }
  const sug = page.companyId ? " Try: \"research this buyer\", \"qualify this buyer\", \"create a follow-up for tomorrow\"." : " Try: \"today's brief\", \"A-grade UAE importers\", \"which market should I focus on?\".";
  return out(`I can help with that via system tools, but I need a sharper request.${sug}`);
}

// ---------- main entry ----------
export interface CopilotRequest {
  message: string;
  history?: ChatMsg[];
  page?: PageCtx & { companyName?: string; marketName?: string };
  lastState?: LastState;
  confirm?: string[];
  mode?: "auto" | "ollama" | "local";
}

export async function runCopilot(actor: Actor, req: CopilotRequest): Promise<AgentResult> {
  ensureAuditTable();
  const page = req.page ?? { path: "/" };
  const last: LastState = req.lastState ?? {};
  const audits: number[] = [];
  const cards: Card[] = [];

  // 1. execute confirmed write actions first
  let confirmedNote = "";
  if (req.confirm?.length) {
    const done: string[] = [];
    for (const tok of req.confirm.slice(0, 25)) {
      const v = verifyAction(tok, actor.email);
      if (!v) { done.push("One confirmation expired or mismatched — please re-issue the command."); continue; }
      if (toolKind(v.tool) !== "WRITE") continue;
      const r = await execTool(actor, v.tool as ToolName, v.args);
      if (!r.ok) {
        auditWrite(actor, req.message, v.tool, "", v.args, { error: r.error }, null);
        done.push(`${v.tool}: failed — ${r.error}`);
        continue;
      }
      const s = summarizeWrite(v.tool as ToolName, v.args);
      const id = auditWrite(actor, req.message, v.tool, s.target, v.args, r.data, r.inverse);
      audits.push(id);
      const extra = v.tool === "create_followup" ? `(${(r.data as { created: number }).created} created)` : v.tool === "create_quote" ? `(Quote #${(r.data as { id: number }).id} Draft)` : v.tool === "create_opportunity" ? `(Opp #${(r.data as { id: number }).id})` : v.tool === "create_enquiry" ? `(Enquiry #${(r.data as { id: number }).id})` : "";
      done.push(`✓ ${s.summary} — ${s.target} ${extra} [audit #${id}]`);
    }
    confirmedNote = done.join("\n");
  }

  const userReq = req.message?.trim() ?? "";
  if (!userReq && !req.confirm?.length) return { reply: "Tell me what to do — e.g. \"today's brief\" or \"A-grade UAE importers\".", cards, actions: [], provider: "local", lastState: last, audits };

  // resolve current buyer name for context
  let companyName: string | undefined = page.companyName;
  if (page.companyId && !companyName) {
    try { companyName = S((getDb().prepare("SELECT name FROM companies WHERE id=?").get(page.companyId) as { name: string } | undefined)?.name); } catch { /* ignore */ }
  }
  const marketName = page.marketName ?? page.market;

  // 2. try Ollama model loop
  const useModel = (req.mode ?? "auto") !== "local" && process.env.AI_PROVIDER !== "local";
  let modelNotice = "";
  if (useModel && userReq) {
    try {
      const specs = Object.entries(TOOLS).map(([name, t]) => toolSpec(name, (t as AnyTool).description, (t as AnyTool).schema));
      const history = (req.history ?? []).slice(-8).flatMap((h) => [{ role: h.role as "user" | "assistant", content: h.content.slice(0, 1500) }]);
      const messages = [
        { role: "system" as const, content: SYSTEM_PROMPT },
        { role: "system" as const, content: contextBlock({ date: todayISO(), page: page.path, companyId: page.companyId, companyName, market: marketName }) },
        ...history,
        { role: "user" as const, content: confirmedNote ? `${userReq}\n\n[Prior confirmed results]\n${confirmedNote}` : userReq },
      ];
      const pending: PendingAction[] = [];
      let reply = "";
      const conv: { role: "system" | "user" | "assistant" | "tool"; content: string; tool_calls?: { id: string; function: { name: string; arguments: Record<string, unknown> } }[] }[] = messages;
      for (let i = 0; i < 6; i++) {
        const res = await ollamaChat(conv, specs);
        const calls = [...res.tool_calls];
        for (const b of parseActionBlocks(res.content)) calls.push({ id: `block_${i}_${calls.length}`, name: b.name, arguments: b.arguments });
        if (!calls.length) {
          if (i === 0) {
            // nudge once: some models need an explicit push to use tools
            conv.push({ role: "assistant", content: res.content });
            conv.push({ role: "user", content: "Call the relevant tool(s) now to get real data before answering. If the request is a write action, stage it for confirmation instead of executing." });
            continue;
          }
          reply = res.content || reply || "Done.";
          break;
        }
        reply = res.content;
        conv.push({ role: "assistant", content: res.content, tool_calls: calls.map((c) => ({ id: c.id, function: { name: c.name, arguments: c.arguments } })) });
        for (const c of calls) {
          if (!(c.name in TOOLS)) { conv.push({ role: "tool", content: `Unknown tool ${c.name}` }); continue; }
          const kind = toolKind(c.name);
          if (kind === "WRITE" && c.name !== "undo_ai_action") {
            try { assertToolAccess(actor, c.name); } catch (e) { conv.push({ role: "tool", content: `DENIED: ${(e as Error).message}` }); continue; }
            const s = summarizeWrite(c.name as ToolName, c.arguments);
            pending.push({ token: signAction(c.name, c.arguments, actor.email), tool: c.name, summary: s.summary, target: s.target, count: s.count });
            conv.push({ role: "tool", content: `Write action staged for user confirmation: ${s.summary} → ${s.target}. Do NOT claim it is done; present the confirmation.` });
          } else {
            const r = await execTool(actor, c.name as ToolName, c.arguments);
            if (r.ok && r.inverse) { const id = auditWrite(actor, userReq, c.name, summarizeWrite(c.name as ToolName, c.arguments).target, c.arguments, r.data, r.inverse); audits.push(id); }
            if (!r.ok && r.error) auditWrite(actor, userReq, c.name, "", c.arguments, { error: r.error }, null);
            if (r.ok && (c.name === "search_buyers" || c.name === "get_stalled")) {
              const rows = ((r.data as { buyers?: Record<string, unknown>[]; stalled?: Record<string, unknown>[] }).buyers ?? (r.data as { stalled?: Record<string, unknown>[] }).stalled ?? []) as Record<string, unknown>[];
              cards.push(...buyerCards(rows));
            }
            conv.push({ role: "tool", content: JSON.stringify(r.ok ? r.data : { error: r.error }).slice(0, 4000) });
          }
        }
      }
      const lastIds = cards.length ? cards.map((c) => Number(c.href.split("/").pop())).filter(Boolean) : last.ids;
      return { reply: (confirmedNote ? confirmedNote + "\n\n" : "") + reply, cards, actions: pending, provider: "ollama", lastState: { ...last, ...(lastIds?.length ? { ids: lastIds } : {}) }, audits };
    } catch (e) {
      // fall through to deterministic local engine (transparency per error-handling spec)
      modelNotice = `Live model unavailable (${(e as Error).message}). Used deterministic engine — same tools, same data.`;
    }
  }

  // 3. deterministic local engine (skipped for bare confirmations)
  if (!userReq) {
    return { reply: confirmedNote || "Confirmed.", cards, actions: [], provider: "local", lastState: last, audits };
  }
  const lr = await localRun(actor, userReq, { ...page, companyName, marketName }, last, userReq);
  const baseReply = (confirmedNote ? confirmedNote + "\n\n" : "") + lr.reply;
  return { reply: modelNotice ? `${modelNotice}\n\n${baseReply}` : baseReply, cards: [...cards, ...lr.cards], actions: lr.actions, provider: "local", lastState: lr.lastState, audits };
}
