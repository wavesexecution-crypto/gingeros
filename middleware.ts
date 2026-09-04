// Production access wall — dedicated client login model.
// Pages: redirect to /login when there is no valid session.
// API:   return 401 JSON when there is no valid session.
// Public exceptions: /login page + /api/auth/* (login/logout endpoints).
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Must match lib/auth.ts COOKIE + secret derivation (middleware runs in the edge
// runtime, so it cannot import lib/auth which depends on node modules).
const COOKIE = "ginger_session";

function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET || "dev-only-change-me-ginger-os");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public: the auth endpoints themselves.
  if (pathname.startsWith("/api/auth/")) return NextResponse.next();

  // Public: the login page (signed-in users bounce home).
  if (pathname === "/login") {
    const tok = req.cookies.get(COOKIE)?.value;
    if (tok) {
      try {
        await jwtVerify(tok, secret());
        return NextResponse.redirect(new URL("/", req.url));
      } catch {
        /* stale token — render the login page */
      }
    }
    return NextResponse.next();
  }

  const tok = req.cookies.get(COOKIE)?.value;

  // API routes require a valid session cookie.
  if (pathname.startsWith("/api/")) {
    if (!tok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      await jwtVerify(tok, secret());
      return NextResponse.next();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Everything else: valid session required.
  if (!tok) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  try {
    await jwtVerify(tok, secret());
    return NextResponse.next();
  } catch {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
}

export const config = {
  // Run on all paths except static assets and build internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};