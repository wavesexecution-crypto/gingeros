import { NextResponse } from "next/server";
import { getDb, nowISO } from "@/lib/db";
import { PIPELINE_STAGES } from "@/lib/config";
import { authGate } from "@/lib/auth";

export async function POST(req: Request) {
  const gate = await authGate("write");
  if (!gate.ok) return gate.response;
  let body: { id?: number; stage?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = Number(body.id);
  const stage = String(body.stage ?? "");
  if (!id || !(PIPELINE_STAGES as readonly string[]).includes(stage)) {
    return NextResponse.json({ error: "Invalid id or stage" }, { status: 400 });
  }
  const db = getDb();
  const c = (await db.prepare("SELECT id FROM companies WHERE id=?").get(id)) as { id: number } | undefined;
  if (!c) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  await db.prepare("UPDATE companies SET buyer_status=?, last_activity=CURRENT_DATE WHERE id=?").run(stage, id);
  await db.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(
    id, "system", `Pipeline → ${stage}`, "Moved via CRM kanban", "Sales", nowISO()
  );
  return NextResponse.json({ ok: true });
}
