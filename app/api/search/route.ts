import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { authGate } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await authGate("read");
  if (!gate.ok) return gate.response;
  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (!q) return NextResponse.json({ companies: [], contacts: [], opportunities: [], enquiries: [], quotes: [] });
  const db = getDb();
  const inc = (...vals: unknown[]) => vals.some((v) => String(v ?? "").toLowerCase().includes(q));
  const companies = ((await db.prepare("SELECT id, name, city, country, products FROM companies").all() as Record<string, unknown>[]).filter((r) => inc(r.name, r.city, r.country, r.products))).slice(0, 20);
  const contacts = ((await db.prepare("SELECT t.*, c.name cname FROM contacts t JOIN companies c ON c.id=t.company_id").all() as Record<string, unknown>[]).filter((r) => inc(r.name, r.email, r.role))).slice(0, 20);
  const opportunities = ((await db.prepare("SELECT o.*, c.name cname FROM opportunities o JOIN companies c ON c.id=o.company_id").all() as Record<string, unknown>[]).filter((r) => inc(r.product, r.next_action, r.cname))).slice(0, 20);
  const enquiries = ((await db.prepare("SELECT e.*, c.name cname FROM enquiries e JOIN companies c ON c.id=e.company_id").all() as Record<string, unknown>[]).filter((r) => inc(r.product, r.destination, r.cname))).slice(0, 20);
  const quotes = ((await db.prepare("SELECT q.*, c.name cname FROM quotes q JOIN companies c ON c.id=q.company_id").all() as Record<string, unknown>[]).filter((r) => inc(r.product, r.destination, r.cname))).slice(0, 20);
  return NextResponse.json({ companies, contacts, opportunities, enquiries, quotes });
}
