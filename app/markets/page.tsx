import Link from "next/link";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type Market = { code: string; name: string; region: string; notes: string; sources: string; updated_at: string };

export default async function Markets() {
  const db = getDb();
  const markets = db.prepare("SELECT * FROM markets ORDER BY region, name").all() as Market[];

  const rows = markets.map((m) => {
    const buyers = (db.prepare("SELECT COUNT(*) c FROM companies WHERE country=?").get(m.name) as { c: number }).c;
    const importers = (db.prepare("SELECT COUNT(*) c FROM companies WHERE country=? AND company_type='Importer'").get(m.name) as { c: number }).c;
    const qualified = (db.prepare("SELECT COUNT(*) c FROM companies WHERE country=? AND grade='A'").get(m.name) as { c: number }).c;
    const activeOpps = (db.prepare("SELECT COUNT(*) c FROM opportunities o JOIN companies c ON c.id=o.company_id WHERE c.country=? AND o.stage NOT IN ('Won','Lost')").get(m.name) as { c: number }).c;
    const exporterPresence = (db.prepare("SELECT COUNT(*) c FROM exporters WHERE export_markets LIKE ?").get(`%${m.name}%`) as { c: number }).c;
    return { ...m, buyers, importers, qualified, activeOpps, exporterPresence };
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow">Dry ginger market intelligence · India → UAE / Middle East / Europe / South Africa</p>
        <h1 className="h1">Dry ginger export markets</h1>
        <p className="muted">{rows.length} dry ginger markets · live counts from dry ginger buyers, export enquiries, Indian exporter coverage</p>
      </div>
      <div className="card overflow-auto hidden md:block">
        <table className="table min-w-[1000px]">
          <thead><tr><th>Dry ginger market</th><th>Region</th><th>Dry ginger buyers</th><th>Importers</th><th>A-grade buyers</th><th>Active enquiries</th><th>Indian exporter presence</th><th>Dry ginger notes</th><th>Evidence sources</th><th>Updated</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <td><Link href={`/countries/${r.code}`} className="text-navy font-medium underline decoration-line underline-offset-4">{r.name}</Link><div className="muted font-mono text-[11px]">{r.code}</div></td>
                <td>{r.region}</td>
                <td className="text-navy">{r.buyers}</td>
                <td>{r.importers}</td>
                <td>{r.qualified}</td>
                <td>{r.activeOpps}</td>
                <td>{r.exporterPresence}</td>
                <td className="max-w-[260px]"><span className="muted">{r.notes?.slice(0, 120) || "—"}</span></td>
                <td className="muted">{r.sources || "—"}</td>
                <td className="muted">{r.updated_at || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 md:hidden">
        {rows.map((r) => (
          <div key={r.code} className="card card-pad space-y-1">
            <Link href={`/countries/${r.code}`} className="text-navy font-medium underline decoration-line underline-offset-4 min-h-[44px] inline-flex items-center">{r.name}</Link>
            <p className="muted font-mono text-[11px]">{r.code} · {r.region}</p>
            <p className="text-[13px] text-navy">Dry ginger buyers {r.buyers} · Importers {r.importers} · A-grade {r.qualified}</p>
            <p className="muted">Enquiry pipeline: {r.activeOpps} active dry ginger enquiries · {r.exporterPresence} Indian exporters cover this market</p>
          </div>
        ))}
      </div>
      {rows.length === 0 && <p className="muted">No dry ginger markets tracked yet.</p>}
    </div>
  );
}
