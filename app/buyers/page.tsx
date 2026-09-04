import Link from "next/link";
import { getDb } from "@/lib/db";
import { GradeBadge, LabelBadge, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Buyers({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").toLowerCase();
  const country = sp.country ?? "", type = sp.type ?? "", grade = sp.grade ?? "", status = sp.status ?? "";
  const db = getDb();
  let rows = db.prepare("SELECT * FROM companies ORDER BY qual_score DESC, name").all() as Record<string, unknown>[];
  if (q) rows = rows.filter((r) => `${r.name} ${r.city} ${r.country} ${r.products} ${r.industry}`.toLowerCase().includes(q));
  if (country) rows = rows.filter((r) => String(r.country) === country);
  if (type) rows = rows.filter((r) => String(r.company_type) === type);
  if (grade) rows = rows.filter((r) => String(r.grade) === grade);
  if (status) rows = rows.filter((r) => String(r.buyer_status) === status);
  const countries = [...new Set((db.prepare("SELECT DISTINCT country FROM companies").all() as { country: string }[]).map((x) => x.country))];
  const openFups = db.prepare("SELECT company_id,title,due_date FROM followups WHERE done=0 ORDER BY due_date").all() as { company_id: number; title: string; due_date: string }[];
  const nextByCompany = new Map<number, { title: string; due_date: string }>();
  for (const f of openFups) {
    const cid = Number(f.company_id);
    if (!nextByCompany.has(cid)) nextByCompany.set(cid, { title: f.title, due_date: f.due_date });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><p className="eyebrow">International buyers · Dry ginger · India → UAE / ME / EU / ZAF</p>
          <h1 className="h1">International buyers</h1><p className="muted">{rows.length} dry ginger importers · filter by export market, importer type, grade, export stage</p></div>
        <div className="flex gap-2"><Link href="/buyers/new" className="btn btn-primary">+ Add buyer</Link><Link href="/import" className="btn">CSV import</Link></div>
      </div>
      <form className="card card-pad flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search importers — name, city (Dubai, Rotterdam…), country…" className="input w-full sm:!w-[240px] min-h-[44px]" />
        <select name="country" defaultValue={country} className="select min-h-[44px]"><option value="">All export markets</option>{countries.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <select name="type" defaultValue={type} className="select min-h-[44px]"><option value="">All importer types</option>{["Importer","Distributor","Wholesaler","Spice company","Food ingredient company","Food manufacturer","Beverage manufacturer","Hotel supplier","Restaurant supplier","Trading company","Other"].map((t) => <option key={t}>{t}</option>)}</select>
        <select name="grade" defaultValue={grade} className="select min-h-[44px]"><option value="">All grades (A/B/C)</option><option>A</option><option>B</option><option>C</option></select>
        <select name="status" defaultValue={status} className="select min-h-[44px]"><option value="">All export stages</option>{["Discovered","Qualified","Researching","Contacted","Responded","Interested","Enquiry","Quotation Sent","Negotiation","Won","Lost","Not Relevant"].map((s) => <option key={s}>{s}</option>)}</select>
        <button className="btn min-h-[44px]" type="submit">Filter importers</button>
      </form>
      {rows.length === 0 ? <Empty title="No dry ginger importers match" hint="Adjust export-market filters or add an importer manually / via CSV." /> : (
        <>
        <div className="md:hidden space-y-2">
          {rows.map((r) => {
            const nx = nextByCompany.get(Number(r.id));
            return (
              <div key={String(r.id)} className="card card-pad !p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/buyers/${String(r.id)}`} className="text-navy font-medium underline decoration-line underline-offset-4 min-h-[44px] inline-flex items-center">{String(r.name)}</Link>
                    <p className="muted">{String(r.country)} · {String(r.company_type)}</p>
                  </div>
                  <GradeBadge grade={String(r.grade)} score={Number(r.qual_score)} />
                </div>
                <div className="flex gap-2 mt-2 flex-wrap items-center">
                  <LabelBadge label={String(r.data_label)} />
                  <span className="muted">Dry ginger fit: {String(r.ginger_fit)}</span>
                </div>
                <p className="muted mt-1">Stage: {String(r.buyer_status)} · Outreach: {String(r.outreach_status)}</p>
                <p className="text-[13px] text-navy mt-1">{nx ? `Next: ${nx.title} · due ${nx.due_date}` : "No open export follow-up — set a next action for this importer"}</p>
                <Link href={`/buyers/${String(r.id)}`} className="btn min-h-[44px] items-center justify-center w-full mt-2">Open importer profile</Link>
              </div>
            );
          })}
        </div>
        <div className="card overflow-auto hidden md:block">
          <table className="table min-w-[900px]">
            <thead><tr><th>Importer</th><th>Export market</th><th>Importer type</th><th>Ginger fit</th><th>Grade</th><th>Export stage</th><th>Outreach</th><th>Source</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  <td><Link href={`/buyers/${String(r.id)}`} className="text-navy font-medium underline decoration-line underline-offset-4">{String(r.name)}</Link><div className="muted">{String(r.city)} · {String(r.products).slice(0, 60)}</div></td>
                  <td>{String(r.country)}</td><td>{String(r.company_type)}</td><td>{String(r.ginger_fit)}</td>
                  <td><GradeBadge grade={String(r.grade)} score={Number(r.qual_score)} /></td>
                  <td>{String(r.buyer_status)}</td><td>{String(r.outreach_status)}</td>
                  <td><LabelBadge label={String(r.data_label)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
