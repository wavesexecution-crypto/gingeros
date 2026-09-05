import Link from "next/link";
import { getDb } from "@/lib/db";
import { REGIONS, BUYER_TYPES, regionForCountry } from "@/lib/config";
import { GradeBadge, LabelBadge, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

const RANK: Record<string, number> = { A: 3, B: 2, C: 1 };

export default async function Discovery({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const region = sp.region ?? "";
  const buyerType = sp.buyerType ?? "";
  const minGrade = sp.minGrade ?? "";
  const searched = Boolean(region || buyerType || minGrade);
  const db = getDb();
  let rows = await db.prepare("SELECT id,name,country,city,company_type,grade,qual_score,products,buyer_status,data_label FROM companies ORDER BY qual_score DESC").all() as Record<string, unknown>[];
  if (region) rows = rows.filter((r) => regionForCountry(String(r.country)) === region);
  if (buyerType) rows = rows.filter((r) => String(r.company_type) === buyerType);
  if (minGrade) rows = rows.filter((r) => (RANK[String(r.grade)] ?? 0) >= (RANK[minGrade] ?? 0));

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow">Dry ginger sourcing · UAE · Middle East · Europe · South Africa</p>
        <h1 className="h1">Find international dry ginger buyers</h1>
        <div className="card card-pad mt-3 border-accent/40">
          <p className="text-navy text-[14px] font-medium">Showing your saved dry ginger importers for UAE · Middle East · Europe · South Africa. Add importers manually or via CSV.</p>
        </div>
      </div>
      <form className="card card-pad flex flex-wrap gap-2 items-end">
        <div><p className="muted mb-1">Product (fixed)</p><input value="Dry Ginger · India origin" disabled className="input opacity-70" /></div>
        <div><p className="muted mb-1">Export market</p><select name="region" defaultValue={region} className="select"><option value="">All export markets</option>{[...REGIONS].map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
        <div><p className="muted mb-1">Importer type</p><select name="buyerType" defaultValue={buyerType} className="select"><option value="">All importer types</option>{[...BUYER_TYPES].map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        <div><p className="muted mb-1">Min grade (A = high ginger fit + evidence)</p><select name="minGrade" defaultValue={minGrade} className="select"><option value="">Any grade</option><option>A</option><option>B</option><option>C</option></select></div>
        <button className="btn btn-primary" type="submit">Find dry ginger importers</button>
      </form>
      {!searched && <Empty title="Filter dry ginger importers" hint="Pick export market / importer type / min grade to list matching dry ginger importers." />}
      {searched && (rows.length === 0 ? <Empty title="No dry ginger importers match in this export market" hint="Add importers manually or via CSV import (UAE · Middle East · Europe · South Africa)." /> : (
        <>
        <div className="card overflow-auto hidden md:block">
          <table className="table min-w-[820px]">
            <thead><tr><th>Importer</th><th>Importer type</th><th>Grade (A/B/C)</th><th>Source</th><th>Buyer profile</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  <td><span className="text-navy font-medium">{String(r.name)}</span><div className="muted">{String(r.city)} · {String(r.country)} · {String(r.products).slice(0, 60)}</div></td>
                  <td>{String(r.company_type)}</td>
                  <td><GradeBadge grade={String(r.grade)} score={Number(r.qual_score)} /></td>
                  <td><LabelBadge label={String(r.data_label)} /></td>
                  <td><Link href={`/buyers/${String(r.id)}`} className="btn !py-1 !text-[12px]">Open importer profile</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-2 md:hidden">
          {rows.map((r) => (
            <div key={String(r.id)} className="card card-pad space-y-1">
              <p className="text-navy font-medium text-[14px]">{String(r.name)}</p>
              <p className="muted">{String(r.city)} · {String(r.country)} · {String(r.company_type)}</p>
              <p className="flex gap-2 items-center flex-wrap"><GradeBadge grade={String(r.grade)} score={Number(r.qual_score)} /><LabelBadge label={String(r.data_label)} /></p>
              <Link href={`/buyers/${String(r.id)}`} className="btn min-h-[44px] mt-1">Open importer profile</Link>
            </div>
          ))}
        </div>
        </>
      ))}
    </div>
  );
}
