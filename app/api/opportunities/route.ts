import { NextResponse } from "next/server";
import { getDb, nowISO } from "@/lib/db";
import { PIPELINE_STAGES } from "@/lib/config";
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
  const c = db.prepare("SELECT id FROM companies WHERE id=?").get(company_id) as { id: number } | undefined;
  if (!c) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  const r = db.prepare("INSERT INTO opportunities(company_id,product,qty,price,currency,value,stage,probability,expected_close,last_activity,next_action,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
    company_id,
    String(body.product ?? "Dry Ginger"),
    String(body.qty ?? ""),
    String(body.price ?? ""),
    String(body.currency ?? "USD"),
    Number(body.value ?? 0),
    String(body.stage ?? "Discovered"),
    Number(body.probability ?? 10),
    String(body.expected_close ?? ""),
    String(body.last_activity ?? ""),
    String(body.next_action ?? ""),
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
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const db = getDb();
  const o = db.prepare("SELECT id FROM opportunities WHERE id=?").get(id) as { id: number } | undefined;
  if (!o) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  const sets: string[] = [];
  const params: Array<string | number> = [];
  if (body.stage !== undefined) {
    const stage = String(body.stage);
    if (!(PIPELINE_STAGES as readonly string[]).includes(stage)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }
    sets.push("stage=?");
    params.push(stage);
  }
  if (body.probability !== undefined) {
    const p = Number(body.probability);
    if (!Number.isFinite(p) || p < 0 || p > 100) {
      return NextResponse.json({ error: "probability must be 0-100" }, { status: 400 });
    }
    sets.push("probability=?");
    params.push(p);
  }
  if (body.next_action !== undefined) {
    sets.push("next_action=?");
    params.push(String(body.next_action));
  }
  if (sets.length === 0) {
    return NextResponse.json({ error: "Nothing to update (stage, probability, next_action)" }, { status: 400 });
  }
  params.push(id);
  db.prepare(`UPDATE opportunities SET ${sets.join(", ")} WHERE id=?`).run(...params);
  return NextResponse.json({ ok: true });
}
