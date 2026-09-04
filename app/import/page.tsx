import { redirect } from "next/navigation";
import { getDb, nowISO, todayISO } from "@/lib/db";
import { parseCSV } from "@/lib/csv";

export const dynamic = "force-dynamic";

const COLS = "Company,Country,City,Website,CompanyType,ContactName,Role,Email,Phone,LinkedIn,Source,Evidence";

function runImport(csv: string): { inserted: number; skipped: number; errors: string[] } {
  const { rows, errors } = parseCSV(csv);
  const db = getDb();
  let inserted = 0, skipped = 0;
  const errs = [...errors];
  for (const r of rows) {
    const dup = db.prepare("SELECT id FROM companies WHERE lower(name)=lower(?) AND lower(country)=lower(?)").get(r.Company, r.Country) as { id: number } | undefined;
    if (dup) { skipped++; continue; }
    try {
      const res = db.prepare(
        `INSERT INTO companies(name,country,city,website,company_type,source,date_discovered,evidence,buyer_status,data_label) VALUES(?,?,?,?,?,?,?,?,?,?)`
      ).run(r.Company, r.Country, r.City ?? "", r.Website ?? "Unknown", r.CompanyType ?? "Other", r.Source ?? "IMPORTED", todayISO(), r.Evidence ?? "", "Discovered", "IMPORTED");
      const id = Number(res.lastInsertRowid);
      if (r.ContactName) {
        db.prepare(`INSERT INTO contacts(company_id,name,role,email,phone,linkedin) VALUES(?,?,?,?,?,?)`).run(id, r.ContactName, r.Role ?? "", r.Email ?? "Unknown", r.Phone ?? "Unknown", r.LinkedIn ?? "");
      }
      if (r.Evidence) db.prepare(`INSERT INTO lead_evidence(company_id,source,snippet,discovered_at) VALUES(?,?,?,?)`).run(id, r.Source ?? "IMPORTED", r.Evidence, todayISO());
      db.prepare(`INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)`).run(id, "system", "Imported via CSV", `${r.Source ?? "IMPORTED"}`, "System", nowISO());
      inserted++;
    } catch (e) {
      errs.push(`${r.Company}: ${e instanceof Error ? e.message : "insert failed"}`);
    }
  }
  return { inserted, skipped, errors: errs };
}

export default async function ImportPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  async function doImport(form: FormData) {
    "use server";
    const csv = String(form.get("csv") ?? "");
    const r = runImport(csv);
    const msg = `inserted=${r.inserted}&skipped=${r.skipped}&errs=${r.errors.length}`;
    redirect(`/import?${msg}&emsg=${encodeURIComponent(r.errors.slice(0, 5).join(" | "))}`);
  }
  return (
    <div className="space-y-4 max-w-[860px]">
      <div>
        <p className="eyebrow">CSV import</p>
        <h1 className="h1">Import buyers from CSV</h1>
        <p className="muted">Expected columns: {COLS}. Duplicates (same name + country, case-insensitive) are skipped.</p>
      </div>
      {(sp.inserted !== undefined) && (
        <div className="card card-pad">
          <p className="text-navy">Inserted {sp.inserted} · skipped {sp.skipped} · errors {sp.errs}</p>
          {sp.emsg && <p className="muted mt-1">{decodeURIComponent(sp.emsg)}</p>}
        </div>
      )}
      <form action={doImport} className="card card-pad space-y-3">
        <textarea name="csv" rows={12} placeholder={COLS + "\nAcme Spices,UAE,Dubai,acme.ae,Importer,John,Buyer,j@acme.ae,+971..,linkedin.com/in/x,IMPORTED,Website lists dried spices"} className="input font-mono !w-full" />
        <div className="flex gap-2">
          <button className="btn btn-primary" type="submit">Import</button>
          <span className="muted self-center">Paste CSV text above (file picker omitted for reliability — paste file contents).</span>
        </div>
      </form>
    </div>
  );
}
