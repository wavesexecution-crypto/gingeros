import { NextResponse } from "next/server";
import { getDb, nowISO, todayISO } from "@/lib/db";
import { scoreBuyer } from "@/lib/qualification";
import { authGate } from "@/lib/auth";

export async function GET(req: Request) {
  const gate = await authGate("read");
  if (!gate.ok) return gate.response;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const country = (url.searchParams.get("country") ?? "").trim();
  const grade = (url.searchParams.get("grade") ?? "").trim();
  const db = getDb();
  const where: string[] = [];
  const params: string[] = [];
  if (q) {
    where.push("(name LIKE ? OR city LIKE ? OR products LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (country) {
    where.push("country = ?");
    params.push(country);
  }
  if (grade) {
    where.push("grade = ?");
    params.push(grade);
  }
  const sql = `SELECT * FROM companies${where.length ? " WHERE " + where.join(" AND ") : ""} ORDER BY qual_score DESC, id DESC LIMIT 200`;
  const companies = await db.prepare(sql).all(...params);
  return NextResponse.json({ companies });
}

export async function POST(req: Request) {
  const gate = await authGate("write");
  if (!gate.ok) return gate.response;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim();
  const country = String(body.country ?? "").trim();
  if (!name || !country) {
    return NextResponse.json({ error: "name and country are required" }, { status: 400 });
  }
  const type = String(body.company_type ?? "Other");
  const fit = String(body.ginger_fit ?? "Unknown");
  const geo = ["UAE", "Saudi Arabia", "Qatar", "Oman", "Kuwait", "Bahrain", "United Kingdom", "Germany", "France", "Netherlands", "Italy", "Spain", "South Africa"].includes(country) ? 2 : 1;
  const pr = fit === "High" ? 3 : fit === "Medium" ? 2 : 1;
  const gf = fit === "High" ? 3 : fit === "Medium" ? 2 : 0;
  const { score, grade } = scoreBuyer({
    productRelevance: pr as 0 | 1 | 2 | 3,
    importerStatus: type === "Importer" ? 2 : 1,
    internationalSourcing: 1,
    gingerFit: gf as 0 | 1 | 2 | 3,
    geoPriority: geo as 0 | 1 | 2,
    companyQuality: 1,
    contactAvailability: 0,
    evidenceStrength: 0,
    buyingSignals: 0,
  });
  const db = getDb();
  const r = await db.prepare(`INSERT INTO companies(name,country,city,website,company_type,industry,products,ginger_fit,import_relevance,size,source,source_url,date_discovered,evidence,buyer_status,qual_score,grade,priority,outreach_status,last_activity,owner,notes,data_label) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    name,
    country,
    String(body.city ?? ""),
    String(body.website ?? "Unknown"),
    type,
    String(body.industry ?? ""),
    String(body.products ?? ""),
    fit,
    "Unknown",
    "Unknown",
    String(body.source ?? "MANUAL"),
    String(body.source_url ?? ""),
    todayISO(),
    String(body.evidence ?? "") || "Evidence not available",
    "Discovered",
    score,
    grade,
    grade === "A" ? "High" : grade === "B" ? "Medium" : "Low",
    "Not contacted",
    todayISO(),
    String(body.owner ?? "Unassigned"),
    String(body.notes ?? ""),
    "MANUAL"
  );
  const id = Number(r.lastInsertRowid);
  await db.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(
    id, "system", "Buyer added via API", `Score ${score}/100 grade ${grade}`, "System", nowISO()
  );
  return NextResponse.json({ id, score, grade }, { status: 201 });
}
