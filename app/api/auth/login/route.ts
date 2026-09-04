import { NextResponse } from "next/server";
import { login } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  if (!body.email || !body.password) return NextResponse.json({ error: "email + password required" }, { status: 400 });
  const u = await login(body.email, body.password);
  if (!u) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  return NextResponse.json({ user: u });
}
