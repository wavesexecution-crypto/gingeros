import { NextResponse } from "next/server";
import { getDb, nowISO, todayISO } from "@/lib/db";
import { parseCSV } from "@/lib/csv";
import { authGate } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await authGate("write");
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => ({}))) as { csv?: string };
  const { rows, errors } = parseCSV(String(body.csv ?? ""));
  const db = getDb();
  let inserted = 0, skipped = 0;
  const errs = [...errors];
  for (const r of rows) {
    const dup = (await db.prepare("SELECT id FROM companies WHERE lower(name)=lower(?) AND lower(country)=lower(?)").get(r.Company, r.Country)) as { id: number } | undefined;
    if (dup) { skipped++; continue; }
    try {
      const res = await db.prepare(
        `INSERT INTO companies(name,country,city,website,company_type,source,date_discovered,evidence,buyer_status,data_label) VALUES(?,?,?,?,?,?,?,?,?,?)`
      ).run(r.Company, r.Country, r.City ?? "", r.Website ?? "Unknown", r.CompanyType ?? "Other", r.Source ?? "IMPORTED", todayISO(), r.Evidence ?? "", "Discovered", "IMPORTED");
      const id = Number(res.lastInsertRowid);
      if (r.ContactName) {
        await db.prepare(`INSERT INTO contacts(company_id,name,role,email,phone,linkedin) VALUES(?,?,?,?,?,?)`).run(id, r.ContactName, r.Role ?? "", r.Email ?? "Unknown", r.Phone ?? "Unknown", r.LinkedIn ?? "");
      }
      if (r.Evidence) await db.prepare(`INSERT INTO lead_evidence(company_id,source,snippet,discovered_at) VALUES(?,?,?,?)`).run(id, r.Source ?? "IMPORTED", r.Evidence, todayISO());
      await db.prepare(`INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)`).run(id, "system", "Imported via CSV", `${r.Source ?? "IMPORTED"}`, "System", nowISO());
      inserted++;
    } catch (e) {
      errs.push(`${r.Company}: ${e instanceof Error ? e.message : "insert failed"}`);
    }
  }
  return NextResponse.json({ inserted, skipped, errors: errs });
}
