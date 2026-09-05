import { NextResponse } from "next/server";
import { getDb, nowISO } from "@/lib/db";
import { ENQUIRY_STATUS } from "@/lib/config";
import { authGate } from "@/lib/auth";

export async function POST(req: Request) {
  const gate = await authGate("write");
  if (!gate.ok) return gate.response;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const company_id = Number(body.company_id);
  if (!company_id) {
    return NextResponse.json({ error: "company_id is required" }, { status: 400 });
  }
  const db = getDb();
  const c = (await db.prepare("SELECT id FROM companies WHERE id=?").get(company_id)) as { id: number } | undefined;
  if (!c) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  const r = await db.prepare("INSERT INTO enquiries(company_id,country,product,qty,packaging,destination,specs,certs,target_price,delivery,payment_terms,status,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    company_id,
    String(body.country ?? ""),
    String(body.product ?? "Dry Ginger"),
    String(body.qty ?? ""),
    String(body.packaging ?? ""),
    String(body.destination ?? ""),
    String(body.specs ?? ""),
    String(body.certs ?? ""),
    String(body.target_price ?? ""),
    String(body.delivery ?? ""),
    String(body.payment_terms ?? ""),
    "New",
    String(body.notes ?? ""),
    nowISO()
  );
  const id = Number(r.lastInsertRowid);
  await db.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(
    company_id, "system", "Enquiry created", `Enquiry #${id} logged`, "Sales", nowISO()
  );
  return NextResponse.json({ id }, { status: 201 });
}

export async function PATCH(req: Request) {
  const gate = await authGate("write");
  if (!gate.ok) return gate.response;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = Number(body.id);
  const status = String(body.status ?? "");
  if (!id || !(ENQUIRY_STATUS as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "Valid id and status are required" }, { status: 400 });
  }
  const db = getDb();
  const e = (await db.prepare("SELECT id FROM enquiries WHERE id=?").get(id)) as { id: number } | undefined;
  if (!e) return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
  await db.prepare("UPDATE enquiries SET status=? WHERE id=?").run(status, id);
  return NextResponse.json({ ok: true });
}
