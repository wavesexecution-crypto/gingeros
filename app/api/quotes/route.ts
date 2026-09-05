import { NextResponse } from "next/server";
import { getDb, nowISO } from "@/lib/db";
import { QUOTE_STATUS } from "@/lib/config";
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
  const r = await db.prepare("INSERT INTO quotes(company_id,product,qty,unit_price,currency,packaging,incoterm,destination,validity,payment_terms,lead_time,status,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    company_id,
    String(body.product ?? "Dry Ginger"),
    String(body.qty ?? ""),
    String(body.unit_price ?? ""),
    String(body.currency ?? "USD"),
    String(body.packaging ?? ""),
    String(body.incoterm ?? "CIF"),
    String(body.destination ?? ""),
    String(body.validity ?? ""),
    String(body.payment_terms ?? ""),
    String(body.lead_time ?? ""),
    "Draft",
    String(body.notes ?? ""),
    nowISO()
  );
  return NextResponse.json({ id: Number(r.lastInsertRowid) }, { status: 201 });
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
  if (!id || !(QUOTE_STATUS as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "Valid id and status are required" }, { status: 400 });
  }
  const db = getDb();
  const q = (await db.prepare("SELECT id FROM quotes WHERE id=?").get(id)) as { id: number } | undefined;
  if (!q) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  await db.prepare("UPDATE quotes SET status=? WHERE id=?").run(status, id);
  return NextResponse.json({ ok: true });
}
