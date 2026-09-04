import { NextResponse } from "next/server";
import { getDb, nowISO } from "@/lib/db";
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
  const title = String(body.title ?? "").trim();
  const due_date = String(body.due_date ?? "").trim();
  if (!company_id || !title || !due_date) {
    return NextResponse.json({ error: "company_id, title and due_date are required" }, { status: 400 });
  }
  const db = getDb();
  const c = db.prepare("SELECT id FROM companies WHERE id=?").get(company_id) as { id: number } | undefined;
  if (!c) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  const r = db.prepare("INSERT INTO followups(company_id,title,due_date,done,owner,notes,created_at) VALUES(?,?,?,?,?,?,?)").run(
    company_id, title, due_date, 0,
    String(body.owner ?? "Unassigned"),
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
  if (!id || body.done === undefined) {
    return NextResponse.json({ error: "id and done are required" }, { status: 400 });
  }
  const done = body.done === true || body.done === 1 || body.done === "1" ? 1 : 0;
  const db = getDb();
  const f = db.prepare("SELECT id FROM followups WHERE id=?").get(id) as { id: number } | undefined;
  if (!f) return NextResponse.json({ error: "Follow-up not found" }, { status: 404 });
  db.prepare("UPDATE followups SET done=? WHERE id=?").run(done, id);
  return NextResponse.json({ ok: true });
}
