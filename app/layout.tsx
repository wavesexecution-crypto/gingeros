import "./globals.css";
import Link from "next/link";
import { Suspense } from "react";
import { ensureAdminSeed, ensureClientSeed, currentUser } from "@/lib/auth";
import { getDb, initSchema } from "@/lib/db";
import { SidebarNav } from "@/components/sidebar-nav";
import { MobileHeader, BottomNav } from "@/components/mobile-nav";
import { CopilotBar } from "@/components/copilot-bar";
import { LogoutButton } from "@/components/logout-button";

export const metadata = { title: "Dry Ginger Sales OS", description: "B2B international sales OS for dry ginger exporter (India)" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Provision production users from env on first request (idempotent).
  // Schema is created first so the seeds don't hit 42P01 on a fresh database.
  try { await initSchema(); } catch {}
  try { await ensureAdminSeed(); } catch {}
  try { await ensureClientSeed(); } catch {}
  const me = await currentUser();
  let overdue = 0;
  try {
    const db = getDb();
    const r = (await db.prepare("SELECT COUNT(*) c FROM followups WHERE done=0 AND due_date < CURRENT_DATE").get()) as { c: number } | undefined;
    overdue = r?.c ?? 0;
  } catch {}
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <aside className="sidebar w-[240px] shrink-0 hidden lg:flex lg:flex-col">
            <div className="p-5 border-b border-white/10">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/60">Waves</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">India · Dry Ginger Exporter</p>
              <h1 className="mt-2 text-[17px] font-semibold text-white leading-tight">Dry Ginger<br />International Sales OS</h1>
              <p className="mt-1 text-[12px] text-white/50">India → UAE · ME · EU · ZAF</p>
            </div>
            <SidebarNav role={me?.role} />
            <div className="p-4 border-t border-white/10">
              <p className="text-[12px] leading-5 text-white/50">Find importer → Qualify (A/B/C) → Contact → Enquiry (MT) → Quote (CIF/FOB) → Export order</p>
              {overdue > 0 && <p className="mt-2 text-[12px] font-semibold text-[#FF6B61]">{overdue} overdue buyer follow-ups</p>}
              {me ? (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-[12px] text-white/60 truncate">{me.email}</p>
                  <LogoutButton variant="light" />
                </div>
              ) : (
                <Link href="/login" className="text-[12px] text-white/60 underline underline-offset-4 mt-2 inline-block">Login</Link>
              )}
            </div>
          </aside>
          <div className="flex-1 min-w-0 pb-24 lg:pb-0">
            <MobileHeader userEmail={me?.email} />
            <header className="sticky top-0 z-10 border-b border-line bg-white hidden lg:block">
              <div className="flex items-center gap-3 px-5 py-2.5">
                <form action="/search" className="flex-1 max-w-xl flex gap-2">
                  <input name="q" placeholder="Search dry ginger buyers, contacts, enquiries, export quotes…" className="input" />
                  <button className="btn" type="submit">Search buyers</button>
                </form>
                <div className="hidden lg:flex gap-2 ml-auto">
                  <Link href="/buyers/new" className="btn">+ Buyer</Link>
                  <Link href="/import" className="btn">Import</Link>
                  <Link href="/enquiries/new" className="btn">+ Enquiry</Link>
                  <Link href="/opportunities/new" className="btn">+ Opportunity</Link>
                  <Link href="/quotes/new" className="btn btn-primary">+ Export quote</Link>
                </div>
              </div>
            </header>
            <main className="p-3 sm:p-5 max-w-[1280px] mx-auto">{children}</main>
            <BottomNav isAdmin={me?.role === "admin"} />
          </div>
        </div>
        <Suspense fallback={null}><CopilotBar /></Suspense>
      </body>
    </html>
  );
}
