import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { aiProvider } from "@/lib/providers";
import { authGate } from "@/lib/auth";

export const dynamic = "force-dynamic";

const OPS = ["why", "outreach", "followup", "next", "summary"] as const;

export async function POST(req: Request) {
  const gate = await authGate("read");
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => ({}))) as { op?: string; companyId?: number; contactName?: string; lastTouch?: string };
  if (!body.op || !(OPS as readonly string[]).includes(body.op)) {
    return NextResponse.json({ error: "Invalid op. Use why|outreach|followup|next|summary" }, { status: 400 });
  }
  if (!body.companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });
  const db = getDb();
  const c = db.prepare("SELECT * FROM companies WHERE id=?").get(body.companyId) as Record<string, unknown> | undefined;
  if (!c) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  const ev = db.prepare("SELECT * FROM lead_evidence WHERE company_id=? ORDER BY id DESC LIMIT 10").all(body.companyId) as Record<string, unknown>[];
  const signals: string[] = [];
  if (c.products && String(c.products) !== "") signals.push(`Products: ${c.products}`);
  if (c.company_type) signals.push(`Type: ${c.company_type}`);
  if (c.buyer_status) signals.push(`Stage: ${c.buyer_status}`);
  for (const e of ev) if (e.snippet && String(e.snippet).trim()) signals.push(String(e.snippet).slice(0, 160));
  const base = {
    company: { name: String(c.name), country: String(c.country), city: String(c.city ?? ""), industry: String(c.industry ?? ""), products: String(c.products ?? ""), website: String(c.website ?? "") },
    signals,
    evidence: String(c.evidence ?? "") || ev.map((e) => String(e.snippet ?? "")).join(" | ") || "Evidence not available",
    grade: String(c.grade ?? "Unknown"),
    score: Number(c.qual_score ?? 0),
  };
  let result: string | string[];
  if (body.op === "why") result = await aiProvider.whyContact(base);
  else if (body.op === "outreach") result = await aiProvider.outreachDraft({ ...base, contactName: body.contactName });
  else if (body.op === "followup") result = await aiProvider.followupDraft({ ...base, lastTouch: body.lastTouch });
  else if (body.op === "next") result = await aiProvider.nextActions({ ...base, stage: String(c.buyer_status ?? "Discovered") });
  else result = await aiProvider.companySummary(base);
  return NextResponse.json({ result });
}
