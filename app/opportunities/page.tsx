import Link from "next/link";
import { getDb } from "@/lib/db";
import { PIPELINE_STAGES } from "@/lib/config";
import { Empty, StageBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const STAGES = [...PIPELINE_STAGES];
const OPEN: string[] = [...PIPELINE_STAGES].filter((s) => !["Won", "Lost", "Not Relevant"].includes(s));

export default async function Opportunities({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").toLowerCase();
  const stage = sp.stage ?? "";
  const db = getDb();
  let rows = await db.prepare("SELECT o.*, co.name AS cname, co.country AS ccountry FROM opportunities o JOIN companies co ON co.id=o.company_id ORDER BY o.id DESC").all() as Record<string, unknown>[];
  if (stage) rows = rows.filter((r) => String(r.stage) === stage);
  if (q) rows = rows.filter((r) => `${r.cname} ${r.ccountry} ${r.product}`.toLowerCase().includes(q));
  const open = rows.filter((r) => OPEN.includes(String(r.stage)));
  const pipe = open.reduce((s, r) => s + Number(r.value || 0), 0);
  const weighted = open.reduce((s, r) => s + Number(r.value || 0) * Number(r.probability || 0) / 100, 0);
  const wonRow = (await db.prepare("SELECT COALESCE(SUM(value),0) AS t FROM opportunities WHERE stage='Won'").get()) as { t: number } | undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="eyebrow">Dry ginger export pipeline</p>
          <h1 className="h1">Dry ginger export opportunities</h1>
          <p className="muted">{rows.length} dry ginger export opportunities · values shown per row with currency (totals indicative — mixed currencies)</p>
        </div>
        <Link href="/opportunities/new" className="btn btn-primary">+ New export opportunity</Link>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="kpi"><p className="kpi-label">Open dry ginger pipeline (indicative)</p><p className="kpi-num">{Math.round(pipe).toLocaleString()}</p></div>
        <div className="kpi"><p className="kpi-label">Weighted value (value × win %)</p><p className="kpi-num">{Math.round(weighted).toLocaleString()}</p></div>
        <div className="kpi"><p className="kpi-label">Won dry ginger revenue</p><p className="kpi-num">{Math.round(Number(wonRow?.t ?? 0)).toLocaleString()}</p></div>
      </div>
      <form className="card card-pad flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search dry ginger buyer, market (UAE, Germany…), form (powder, whole)…" className="input w-full sm:!w-[240px]" />
        <select name="stage" defaultValue={stage} className="select">
          <option value="">All dry ginger stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn" type="submit">Filter enquiries</button>
        {(q || stage) && <Link href="/opportunities" className="btn">Clear filters</Link>}
      </form>
      {rows.length === 0 ? <Empty title="No dry ginger export opportunities" hint="Create one from a dry ginger buyer page or + New export opportunity above." /> : (
        <>
        <div className="card overflow-auto hidden md:block">
          <table className="table min-w-[1000px]">
            <thead><tr><th>Enq #</th><th>Dry ginger buyer</th><th>Export market</th><th>Dry ginger form</th><th>Qty (MT)</th><th>Value + currency</th><th>Enquiry stage</th><th>Win %</th><th>Expected value</th><th>Next follow-up</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const v = Number(r.value || 0), p = Number(r.probability || 0);
                return (
                  <tr key={String(r.id)}>
                    <td><Link href={`/opportunities/${String(r.id)}`} className="text-navy font-medium underline decoration-line underline-offset-4">#{String(r.id)}</Link></td>
                    <td><Link href={`/buyers/${String(r.company_id)}`} className="text-navy underline decoration-line underline-offset-4">{String(r.cname)}</Link></td>
                    <td>{String(r.ccountry)}</td>
                    <td>{String(r.product)}</td>
                    <td>{String(r.qty) || "—"}</td>
                    <td>{v.toLocaleString()} {String(r.currency)}</td>
                    <td><StageBadge stage={String(r.stage)} /></td>
                    <td>{p}%</td>
                    <td>{Math.round(v * p / 100).toLocaleString()}</td>
                    <td className="muted">{String(r.next_action).slice(0, 60) || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grid gap-2 md:hidden">
          {rows.map((r) => {
            const v = Number(r.value || 0), p = Number(r.probability || 0);
            return (
              <div key={String(r.id)} className="card card-pad space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/opportunities/${String(r.id)}`} className="text-navy font-medium underline decoration-line underline-offset-4 min-h-[44px] inline-flex items-center">#{String(r.id)} · {String(r.cname)}</Link>
                  <StageBadge stage={String(r.stage)} />
                </div>
                <p className="muted">{String(r.ccountry)} · {String(r.product)} · {String(r.qty) || "—"}</p>
                <p className="text-[13px] text-navy">{v.toLocaleString()} {String(r.currency)} · {p}%</p>
                <p className="muted">Next: {String(r.next_action).slice(0, 80) || "—"}</p>
              </div>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}
