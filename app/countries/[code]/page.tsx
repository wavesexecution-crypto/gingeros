import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { GradeBadge, LabelBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CountryIntel({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const db = getDb();
  const market = (await db.prepare("SELECT * FROM markets WHERE code=?").get(code)) as { code: string; name: string; region: string; notes: string; sources: string; updated_at: string } | undefined;
  if (!market) return notFound();
  const country = market.name;

  const one = async (sql: string) => (await db.prepare(sql).get(country) as { c: number }).c;
  const buyers = await one("SELECT COUNT(*) c FROM companies WHERE country=?");
  const qualified = await one("SELECT COUNT(*) c FROM companies WHERE country=? AND grade='A'");
  const contacted = await one("SELECT COUNT(*) c FROM companies WHERE country=? AND outreach_status != 'Not contacted'");
  const activeOpps = (await db.prepare("SELECT COUNT(*) c FROM opportunities o JOIN companies c ON c.id=o.company_id WHERE c.country=? AND o.stage NOT IN ('Won','Lost')").get(country) as { c: number }).c;
  const won = (await db.prepare("SELECT COUNT(*) c FROM opportunities o JOIN companies c ON c.id=o.company_id WHERE c.country=? AND o.stage='Won'").get(country) as { c: number }).c;

  const types = await db.prepare("SELECT company_type t, COUNT(*) c FROM companies WHERE country=? GROUP BY company_type ORDER BY c DESC").all(country) as { t: string; c: number }[];
  const top = await db.prepare("SELECT * FROM companies WHERE country=? ORDER BY qual_score DESC, name LIMIT 8").all(country) as Record<string, unknown>[];
  const opps = await db.prepare("SELECT o.*, c.name cname FROM opportunities o JOIN companies c ON c.id=o.company_id WHERE c.country=? AND o.stage NOT IN ('Won','Lost') ORDER BY o.value DESC").all(country) as Record<string, unknown>[];
  const acts = await db.prepare("SELECT a.*, c.name cname FROM activities a JOIN companies c ON c.id=a.company_id WHERE c.country=? ORDER BY a.created_at DESC LIMIT 15").all(country) as Record<string, unknown>[];

  async function saveNotes(form: FormData) {
    "use server";
    const notes = String(form.get("notes") ?? "");
    const { getDb: gdb } = await import("@/lib/db");
    await gdb().prepare("UPDATE markets SET notes=?, updated_at=date('now') WHERE code=?").run(notes, code);
    redirect(`/countries/${code}`);
  }

  const kpis: [string, number][] = [["Dry ginger buyers", buyers], ["A-grade buyers", qualified], ["Contacted buyers", contacted], ["Active enquiries", activeOpps], ["Won orders", won]];

  return (
    <div className="space-y-4">
      <Link href="/markets" className="muted underline">← Export markets</Link>
      <div>
        <p className="eyebrow">{market.region} · {market.code}</p>
        <h1 className="h1">{country} — dry ginger market intelligence</h1>
        <p className="muted">Evidence sources: {market.sources || "—"} · Updated {market.updated_at || "—"}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map(([k, v]) => (<div key={k} className="kpi"><p className="kpi-label">{k}</p><p className="kpi-num">{v}</p></div>))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card card-pad">
          <h2 className="h2">Top dry ginger buyer types</h2>
          {types.length === 0 ? <p className="muted mt-2">No dry ginger buyers in this market yet. Add an importer or import buyers.</p> : (
            <table className="table mt-2"><thead><tr><th>Type</th><th>Count</th></tr></thead>
              <tbody>{types.map((t) => <tr key={t.t || "Other"}><td className="text-navy">{t.t || "Other"}</td><td>{t.c}</td></tr>)}</tbody>
            </table>
          )}
        </div>
        <div className="card card-pad">
          <h2 className="h2">Dry ginger market notes</h2>
          <form action={saveNotes} className="mt-2 space-y-2">
            <textarea name="notes" defaultValue={market.notes ?? ""} rows={5} placeholder="Dry ginger notes — e.g. Jebel Ali CIF demand, whole / powder, 25/50kg packing…" className="input" />
            <button className="btn btn-primary" type="submit">Save market notes</button>
          </form>
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="h2">Top dry ginger buyers (by score)</h2>
        {top.length === 0 ? <p className="muted mt-2">No dry ginger buyers yet in {country}.</p> : (
          <>
          <div className="card overflow-auto mt-2 hidden md:block">
            <table className="table min-w-[760px]">
              <thead><tr><th>Dry ginger buyer</th><th>Buyer type</th><th>Grade (A/B/C)</th><th>Export stage</th><th>Outreach</th><th>Source</th></tr></thead>
              <tbody>
                {top.map((r) => (
                  <tr key={String(r.id)}>
                    <td><Link href={`/buyers/${String(r.id)}`} className="text-navy font-medium underline decoration-line underline-offset-4">{String(r.name)}</Link><div className="muted">{String(r.city)} · {String(r.products).slice(0, 60)}</div></td>
                    <td>{String(r.company_type)}</td>
                    <td><GradeBadge grade={String(r.grade)} score={Number(r.qual_score)} /></td>
                    <td>{String(r.buyer_status)}</td><td>{String(r.outreach_status)}</td>
                    <td><LabelBadge label={String(r.data_label)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-2 md:hidden mt-2">
            {top.map((r) => (
              <div key={String(r.id)} className="border border-line rounded p-3 space-y-1">
                <Link href={`/buyers/${String(r.id)}`} className="text-navy font-medium underline decoration-line underline-offset-4 min-h-[44px] inline-flex items-center">{String(r.name)}</Link>
                <p className="muted">{String(r.city)} · {String(r.company_type)} · {String(r.buyer_status)} · {String(r.outreach_status)}</p>
                <p className="flex gap-2 flex-wrap"><GradeBadge grade={String(r.grade)} score={Number(r.qual_score)} /><LabelBadge label={String(r.data_label)} /></p>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card card-pad">
          <h2 className="h2">Active dry ginger enquiries</h2>
          {opps.length === 0 ? <p className="muted mt-2">No active dry ginger enquiries in {country}. Create one from a buyer above.</p> : (
            <>
            <div className="hidden md:block">
            <table className="table mt-2"><thead><tr><th>Dry ginger buyer</th><th>Enquiry stage</th><th>Value + currency</th><th>Next follow-up</th></tr></thead>
              <tbody>{opps.map((o) => (
                <tr key={String(o.id)}><td className="text-navy">{String(o.cname)}</td><td>{String(o.stage)}</td><td>{Number(o.value).toLocaleString()} {String(o.currency)}</td><td className="muted">{String(o.next_action).slice(0, 60)}</td></tr>
              ))}</tbody>
            </table>
            </div>
            <div className="grid gap-2 md:hidden mt-2">
              {opps.map((o) => (
                <div key={String(o.id)} className="border border-line rounded p-3 space-y-0.5">
                  <p className="text-navy text-[13px] font-medium">{String(o.cname)} · {String(o.stage)}</p>
                  <p className="text-[13px] text-navy">{Number(o.value).toLocaleString()} {String(o.currency)}</p>
                  <p className="muted">Next: {String(o.next_action).slice(0, 60) || "—"}</p>
                </div>
              ))}
            </div>
            </>
          )}
        </div>
        <div className="card card-pad">
          <h2 className="h2">Recent buyer activity</h2>
          <div className="mt-2 space-y-2">
            {acts.length === 0 && <p className="muted">No outreach logged for {country} yet.</p>}
            {acts.map((a) => (
              <div key={String(a.id)} className="border-l border-line pl-3">
                <p className="text-[13px] text-navy">{String(a.title)} <span className="muted">· {String(a.cname)} · {String(a.created_at).slice(0, 10)}</span></p>
                <p className="muted">{String(a.body).slice(0, 160)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
