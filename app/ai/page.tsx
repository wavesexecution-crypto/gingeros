import Link from "next/link";
import { getDb } from "@/lib/db";
import { aiProvider, type AIBriefInput } from "@/lib/providers";

export const dynamic = "force-dynamic";

type SP = { company?: string; op?: string; contactName?: string; lastTouch?: string };

function brief(companyId: number): { input: AIBriefInput; company: Record<string, unknown> } | null {
  const db = getDb();
  const c = db.prepare("SELECT * FROM companies WHERE id=?").get(companyId) as Record<string, unknown> | undefined;
  if (!c) return null;
  const ev = db.prepare("SELECT * FROM lead_evidence WHERE company_id=? ORDER BY id DESC LIMIT 10").all(companyId) as Record<string, unknown>[];
  const signals: string[] = [];
  if (c.products && String(c.products) !== "") signals.push(`Products: ${c.products}`);
  if (c.company_type) signals.push(`Type: ${c.company_type}`);
  if (c.buyer_status) signals.push(`Stage: ${c.buyer_status}`);
  for (const e of ev) if (e.snippet && String(e.snippet).trim()) signals.push(String(e.snippet).slice(0, 160));
  const input: AIBriefInput = {
    company: { name: String(c.name), country: String(c.country), city: String(c.city ?? ""), industry: String(c.industry ?? ""), products: String(c.products ?? ""), website: String(c.website ?? "") },
    signals,
    evidence: String(c.evidence ?? "") || ev.map((e) => String(e.snippet ?? "")).join(" | ") || "Evidence not available",
    grade: String(c.grade ?? "Unknown"),
    score: Number(c.qual_score ?? 0),
  };
  return { input, company: c };
}

const OPS = ["why", "outreach", "followup", "next", "summary"] as const;

export default async function AIPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const companyId = sp.company ? Number(sp.company) : 0;
  const op = (OPS as readonly string[]).includes(sp.op ?? "") ? sp.op! : "";
  const contactName = sp.contactName ?? "";
  const lastTouch = sp.lastTouch ?? "";
  const db = getDb();
  const companies = db.prepare("SELECT id, name, country FROM companies ORDER BY name").all() as Record<string, unknown>[];
  const loaded = companyId ? brief(companyId) : null;
  let result: string | string[] | null = null;
  if (loaded && op) {
    const base = loaded.input;
    if (op === "why") result = await aiProvider.whyContact(base);
    else if (op === "outreach") result = await aiProvider.outreachDraft({ ...base, contactName: contactName || undefined });
    else if (op === "followup") result = await aiProvider.followupDraft({ ...base, lastTouch: lastTouch || undefined });
    else if (op === "next") result = await aiProvider.nextActions({ ...base, stage: String(loaded.company.buyer_status ?? "Discovered") });
    else if (op === "summary") result = await aiProvider.companySummary(base);
  }
  const qs = (o: string) => `?company=${companyId}&op=${o}&contactName=${encodeURIComponent(contactName)}&lastTouch=${encodeURIComponent(lastTouch)}`;

  return (
    <div className="space-y-4 max-w-[860px]">
      <div>
        <p className="eyebrow">AI assistant</p>
        <h1 className="h1">Evidence-grounded sales assistant</h1>
        <p className="muted">Only references loaded evidence — never invents facts. Provider: {aiProvider.label} ({aiProvider.status}).</p>
      </div>
      <form className="card card-pad flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-end">
        <div className="flex-1 min-w-0 sm:min-w-[240px]">
          <label className="muted">Company</label>
          <select name="company" defaultValue={sp.company ?? ""} className="select w-full min-h-[44px]">
            <option value="">Pick a company…</option>
            {companies.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)} · {String(c.country)}</option>)}
          </select>
        </div>
        <input name="contactName" defaultValue={contactName} placeholder="Contact name" className="input w-full sm:!w-[180px]" />
        <input name="lastTouch" defaultValue={lastTouch} placeholder="Last touch (e.g. 2026-08-20)" className="input w-full sm:!w-[220px]" />
        <button className="btn btn-primary min-h-[44px] justify-center" type="submit">Load</button>
      </form>
      {loaded ? (
        <div className="card card-pad">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="h2">{String(loaded.company.name)} · {String(loaded.company.country)}</h2>
            <Link href={`/buyers/${companyId}`} className="btn">Back to buyer</Link>
          </div>
          <p className="muted mt-1">Grade {String(loaded.company.grade)} · {Number(loaded.company.qual_score)}/100 · {loaded.input.signals.length} signals</p>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-3">
            <Link href={qs("why")} className="btn min-h-[44px] justify-center">Why contact</Link>
            <Link href={qs("outreach")} className="btn min-h-[44px] justify-center">Outreach draft</Link>
            <Link href={qs("followup")} className="btn min-h-[44px] justify-center">Follow-up draft</Link>
            <Link href={qs("next")} className="btn min-h-[44px] justify-center">Next actions</Link>
            <Link href={qs("summary")} className="btn min-h-[44px] justify-center">Summary</Link>
          </div>
          {result !== null && (
            <pre className="mt-4 whitespace-pre-wrap break-words text-[13px] leading-relaxed border border-line rounded p-4 bg-ink overflow-x-hidden">{Array.isArray(result) ? result.map((r) => `• ${r}`).join("\n") : result}</pre>
          )}
        </div>
      ) : (
        <div className="card card-pad"><p className="muted">Select a company above to load evidence + signals, then run an operation.</p></div>
      )}
    </div>
  );
}
