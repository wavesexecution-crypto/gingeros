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
  const channel = String(body.channel ?? "").trim();
  if (!company_id || !channel) {
    return NextResponse.json({ error: "company_id and channel are required" }, { status: 400 });
  }
  const subject = String(body.subject ?? "");
  const text = String(body.body ?? "");
  const db = getDb();
  const c = (await db.prepare("SELECT id FROM companies WHERE id=?").get(company_id)) as { id: number } | undefined;
  if (!c) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  // Log-only: no auto-send. Sending happens only via an explicitly connected email provider.
  const r = await db.prepare("INSERT INTO communications(company_id,channel,direction,subject,body,status,created_at) VALUES(?,?,?,?,?,?,?)").run(
    company_id, channel, "outbound", subject, text, "logged", nowISO()
  );
  const id = Number(r.lastInsertRowid);
  await db.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(
    company_id, channel.toLowerCase() === "email" ? "email" : "note",
    `${channel} logged`, subject || `${channel} logged (no auto-send)`, "Sales", nowISO()
  );
  return NextResponse.json({ id }, { status: 201 });
}
