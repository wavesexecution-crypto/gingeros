// Auth: bcrypt + JWT (jose), httpOnly cookie, RBAC. Secrets via env, never frontend.
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb, nowISO } from "./db";

const COOKIE = "ginger_session";

export interface CurrentUser {
  id: string;
  email: string;
  role: string;
  name: string;
}

function secret(): Uint8Array {
  const v = process.env.AUTH_SECRET;
  if (!v && process.env.NODE_ENV === "production") {
    // eslint-disable-next-line no-console
    console.error("[auth] AUTH_SECRET is not set in production — session tokens are signed with an insecure fallback. Set a long random value now (see .env.example).");
  }
  return new TextEncoder().encode(v || "dev-only-change-me-ginger-os");
}

// Provision the Waves administration account from env (ADMIN_EMAIL / ADMIN_PASSWORD).
// Never auto-creates default dev credentials in production.
export async function ensureAdminSeed() {
  const db = getDb();
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    if (process.env.NODE_ENV === "production") {
      // eslint-disable-next-line no-console
      console.warn("[auth] ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin auto-seed. Set them on first deploy (see .env.example).");
    }
    return;
  }
  const exists = db.prepare("SELECT id FROM users WHERE email=?").get(email) as { id: number } | undefined;
  if (!exists) {
    const hash = await bcrypt.hash(password, 10);
    db.prepare("INSERT INTO users(email,name,role,password_hash,created_at) VALUES(?,?,?,?,?)").run(
      email, "Waves Admin", "admin", hash, nowISO()
    );
  }
}

// Provision the dedicated client account from env (CLIENT_EMAIL / CLIENT_NAME / CLIENT_PASSWORD).
// This is the only client-facing login. No default dev credentials are ever created.
export async function ensureClientSeed() {
  const db = getDb();
  const email = process.env.CLIENT_EMAIL;
  const password = process.env.CLIENT_PASSWORD;
  if (!email || !password) {
    if (process.env.NODE_ENV === "production") {
      // eslint-disable-next-line no-console
      console.warn("[auth] CLIENT_EMAIL / CLIENT_PASSWORD not set — no client account provisioned. Set them on first deploy (see .env.example).");
    }
    return;
  }
  const exists = db.prepare("SELECT id FROM users WHERE email=?").get(email) as { id: number } | undefined;
  if (!exists) {
    const hash = await bcrypt.hash(password, 10);
    db.prepare("INSERT INTO users(email,name,role,password_hash,created_at) VALUES(?,?,?,?,?)").run(
      email, process.env.CLIENT_NAME || "Dry Ginger Client", "sales", hash, nowISO()
    );
  }
}

export async function login(email: string, password: string) {
  await ensureAdminSeed();
  await ensureClientSeed();
  const db = getDb();
  const u = db.prepare("SELECT * FROM users WHERE email=?").get(email) as
    | { id: number; email: string; name: string; role: string; password_hash: string } | undefined;
  if (!u) return null;
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) return null;
  const token = await new SignJWT({ sub: String(u.id), email: u.email, role: u.role, name: u.name })
    .setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    // Production deployments should run behind HTTPS and set COOKIE_SECURE=true.
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: 604800,
  });
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

export async function logout() { (await cookies()).delete(COOKIE); }

export async function currentUser(): Promise<CurrentUser | null> {
  const c = (await cookies()).get(COOKIE)?.value;
  if (!c) return null;
  try {
    const { payload } = await jwtVerify(c, secret());
    return { id: String(payload.sub), email: String(payload.email), role: String(payload.role), name: String(payload.name) };
  } catch { return null; }
}

export function can(role: string | undefined, action: "read" | "write" | "admin") {
  if (!role) return false;
  if (action === "read") return ["viewer", "sales", "admin"].includes(role);
  if (action === "write") return ["sales", "admin"].includes(role);
  return role === "admin";
}

export type AuthLevel = "read" | "write" | "admin";

export type AuthOutcome =
  | { ok: true; user: CurrentUser }
  | { ok: false; status: 401 | 403 };

// Route-level guard wrapper: returns the current user when authorized, else 401/403.
// Usage in API routes and server components:
//   const gate = await authGate("write");   // or "read" / "admin"
//   if (!gate.ok) return gate.response;
//   gate.user // authorized CurrentUser
export async function requireAuth(level: AuthLevel = "read"): Promise<AuthOutcome> {
  const u = await currentUser();
  if (!u) return { ok: false, status: 401 };
  if (!can(u.role, level)) return { ok: false, status: 403 };
  return { ok: true, user: u };
}

export type AuthGate =
  | { ok: true; user: CurrentUser }
  | { ok: false; response: NextResponse };

export async function authGate(level: AuthLevel = "read"): Promise<AuthGate> {
  const r = await requireAuth(level);
  if (r.ok) return { ok: true, user: r.user };
  return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: r.status }) };
}
