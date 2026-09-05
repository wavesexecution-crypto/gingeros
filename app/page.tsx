import Link from "next/link";
import { getDb } from "@/lib/db";
import { regionForCountry } from "@/lib/config";
import { GradeBadge, LabelBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const db = getDb();
  const one = async (sql: string, ...p: unknown[]) => ((await db.prepare(sql).get(...(p as never[]))) as unknown as Record<string, number>);
  const total = (await one("SELECT COUNT(*) c FROM companies")).c;
  const highly = (await one("SELECT COUNT(*) c FROM companies WHERE grade='A'")).c;
  const openEnq = (await one("SELECT COUNT(*) c FROM enquiries WHERE status NOT IN ('Won','Lost')")).c;
  const activeOpp = (await one("SELECT COUNT(*) c FROM opportunities WHERE stage NOT IN ('Won','Lost','Not Relevant')")).c;
  const quotesSent = (await one("SELECT COUNT(*) c FROM quotes WHERE status != 'Draft'")).c;
  const won = (await one("SELECT COUNT(*) c FROM opportunities WHERE stage='Won'")).c;
  const pipe = (await db.prepare("SELECT COALESCE(SUM(value),0) v FROM opportunities WHERE stage NOT IN ('Won','Lost','Not Relevant')").get() as { v: number }).v;
  const weighted = (await db.prepare("SELECT COALESCE(SUM(value*probability/100.0),0) v FROM opportunities WHERE stage NOT IN ('Won','Lost','Not Relevant')").get() as { v: number }).v;

  const regions = ["UAE", "Middle East", "Europe", "South Africa"];
  const rows = (await db.prepare("SELECT * FROM companies").all() as { country: string; grade: string; outreach_status: string }[]);
  const byRegion = regions.map((r) => {
    const inR = rows.filter((x) => (r === "UAE" ? x.country === "UAE" : regionForCountry(x.country) === r));
    return { region: r, buyers: inR.length, qualified: inR.filter((x) => x.grade === "A").length, contacted: inR.filter((x) => x.outreach_status !== "Not contacted").length };
  });
  const opps = await db.prepare("SELECT o.*, c.name cname, c.country FROM opportunities o JOIN companies c ON c.id=o.company_id WHERE o.stage NOT IN ('Won','Lost','Not Relevant') ORDER BY o.value DESC LIMIT 8").all() as Record<string, unknown>[];
  const followups = await db.prepare("SELECT f.*, c.name cname FROM followups f JOIN companies c ON c.id=f.company_id WHERE f.done=0 ORDER BY f.due_date LIMIT 10").all() as Record<string, unknown>[];
  const hot = await db.prepare("SELECT * FROM companies WHERE grade='A' ORDER BY qual_score DESC LIMIT 6").all() as Record<string, unknown>[];
  const recentEnq = await db.prepare("SELECT e.*, c.name cname FROM enquiries e JOIN companies c ON c.id=e.company_id ORDER BY e.id DESC LIMIT 5").all() as Record<string, unknown>[];

  const kpis: [string, string | number][] = [
    ["Total buyers", total], ["A-grade buyers", highly], ["Active opportunities", activeOpp],
    ["Open enquiries", openEnq], ["Quotes sent", quotesSent],
    ["Pipeline value (mixed ccy)", Math.round(pipe).toLocaleString()], ["Won orders", won],
  ];

  return (
    <div className="space-y-6">
      {/* Mobile-only priority block — AI stays reachable via the header + bottom navigation */}
      <div className="md:hidden space-y-3">
        <div className="card card-pad">
          <p className="eyebrow">Dry Ginger · International Sales OS</p>
          <div className="mt-2 flex gap-2">
            <Link href="/followups" className="btn btn-primary min-h-[44px] flex-1 justify-center items-center">Today&apos;s follow-ups</Link>
          </div>
        </div>
        {(() => {
          const todayStr = new Date().toISOString().slice(0, 10);
          const urgent = followups.filter((f) => String(f.due_date) <= todayStr).length;
          const stats: [string, string | number][] = [
            ["Today urgent", urgent],
            ["Pipeline (mixed ccy)", Math.round(pipe).toLocaleString()],
            ["A-grade buyers", highly],
            ["Active opportunities", activeOpp],
          ];
          return (
            <div className="grid grid-cols-2 gap-2">
              {stats.map(([k, v]) => (
                <div key={k} className="kpi !p-4"><p className="kpi-label">{k}</p><p className="kpi-num !text-[22px]">{v}</p></div>
              ))}
            </div>
          );
        })()}
        <div className="card card-pad">
          <h2 className="h2">Top dry ginger priorities</h2>
          <div className="mt-2 space-y-2">
            {opps.slice(0, 3).map((o) => (
              <div key={String(o.id)} className="flex items-center justify-between gap-2 border border-line rounded px-3 py-2">
                <div className="min-w-0">
                  <p className="text-navy text-[13px] font-medium truncate">{String(o.cname)}</p>
                  <p className="muted">{String(o.stage)} · {Number(o.value).toLocaleString()} {String(o.currency)}</p>
                </div>
                <Link href={`/opportunities/${String(o.id)}`} className="btn min-h-[44px] items-center shrink-0">Open</Link>
              </div>
            ))}
            {opps.length === 0 && <p className="muted">No active dry ginger export opportunities yet.</p>}
          </div>
        </div>
        <div className="card card-pad">
          <h2 className="h2">Today&apos;s follow-ups</h2>
          <div className="mt-2 space-y-2">
            {followups.slice(0, 4).map((f) => (
              <div key={String(f.id)} className="flex items-center justify-between gap-2 border border-line rounded px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[13px] text-navy truncate">{String(f.title)}</p>
                  <p className="muted truncate">{String(f.cname)} · due {String(f.due_date)}</p>
                </div>
                <Link href={`/buyers/${String(f.company_id)}`} className="btn min-h-[44px] items-center shrink-0">Open</Link>
              </div>
            ))}
            {followups.length === 0 && <p className="muted">No open buyer follow-ups — every active importer needs a next action.</p>}
          </div>
        </div>
      </div>
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow">Dry ginger export overview</p>
          <h1 className="h1 mt-1">Where are my best dry ginger export opportunities?</h1>
          <p className="muted mt-1">Dry ginger · India → UAE / Middle East / Europe / South Africa · Weighted pipeline ${Math.round(weighted).toLocaleString()} (mixed currencies)</p>
        </div>
        <div className="flex gap-2">
          <Link href="/buyers/new" className="btn">+ Add buyer</Link>
          <Link href="/followups" className="btn">Today&apos;s follow-ups</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map(([k, v]) => (
          <div key={k} className="kpi"><p className="kpi-label">{k}</p><p className="kpi-num">{v}</p></div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card card-pad">
          <h2 className="h2">Dry ginger markets — UAE · Middle East · Europe · South Africa</h2>
          <table className="table mt-3">
            <thead><tr><th>Market</th><th>Buyers</th><th>A-grade</th><th>Contacted</th></tr></thead>
            <tbody>
              {byRegion.map((r) => (
                <tr key={r.region}>
                  <td><Link href={`/markets`} className="text-navy underline decoration-line underline-offset-4">{r.region}</Link></td>
                  <td>{r.buyers}</td><td>{r.qualified}</td><td>{r.contacted}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted mt-3">Focus rule: work A-grade dry ginger importers in UAE + Europe first — highest evidence + active responses.</p>
        </div>
        <div className="card card-pad">
          <h2 className="h2">Today&apos;s follow-ups</h2>
          <div className="mt-3 space-y-2">
            {followups.length === 0 && <p className="muted">No open buyer follow-ups. Add one from any importer profile.</p>}
            {followups.map((f) => (
              <div key={String(f.id)} className="flex items-center justify-between gap-2 border border-line rounded px-3 py-2">
                <div className="min-w-0"><p className="text-[13px] text-navy truncate">{String(f.title)}</p><p className="muted truncate">{String(f.cname)} · due {String(f.due_date)}</p></div>
                <Link href={`/buyers/${String(f.company_id)}`} className="btn min-h-[44px] items-center shrink-0">Open</Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card card-pad">
          <h2 className="h2">Hot buyers — A-grade dry ginger importers</h2>
          <div className="mt-3 space-y-2">
            {hot.map((h) => (
              <div key={String(h.id)} className="flex items-center justify-between gap-3 border border-line rounded px-3 py-2">
                <div className="min-w-0"><Link href={`/buyers/${String(h.id)}`} className="text-navy text-[13px] font-medium truncate block">{String(h.name)}</Link>
                  <p className="muted">{String(h.country)} · {String(h.company_type)} · {String(h.buyer_status)}</p></div>
                <div className="flex items-center gap-2 shrink-0"><GradeBadge grade={String(h.grade)} score={Number(h.qual_score)} /><LabelBadge label={String(h.data_label)} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card card-pad">
          <h2 className="h2">Active export opportunities</h2>
          <table className="table mt-3">
            <thead><tr><th>Buyer</th><th>Stage</th><th>Value</th><th className="hidden md:table-cell">Next follow-up</th></tr></thead>
            <tbody>
              {opps.map((o) => (
                <tr key={String(o.id)}><td className="text-navy">{String(o.cname)}</td><td>{String(o.stage)}</td><td>{Number(o.value).toLocaleString()} {String(o.currency)}</td><td className="muted hidden md:table-cell">{String(o.next_action).slice(0, 60)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="h2">Recent dry ginger enquiries</h2>
        <table className="table mt-3">
          <thead><tr><th>Buyer</th><th>Qty (MT)</th><th>Destination port</th><th>Stage</th></tr></thead>
          <tbody>{recentEnq.map((e) => (<tr key={String(e.id)}><td className="text-navy">{String(e.cname)}</td><td>{String(e.qty)}</td><td>{String(e.destination)}</td><td>{String(e.status)}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
