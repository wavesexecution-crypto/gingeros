"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";

function sectionTitle(path: string): string {
  if (path === "/") return "Home";
  if (path.startsWith("/buyers")) return "Buyers";
  if (path.startsWith("/crm")) return "CRM";
  if (path.startsWith("/discovery")) return "Discovery";
  if (path.startsWith("/markets") || path.startsWith("/countries")) return "Markets";
  if (path.startsWith("/exporters")) return "Exporters";
  if (path.startsWith("/outreach")) return "Outreach";
  if (path.startsWith("/followups")) return "Follow-ups";
  if (path.startsWith("/enquiries")) return "Enquiries";
  if (path.startsWith("/quotes")) return "Quotes";
  if (path.startsWith("/opportunities")) return "Opportunities";
  if (path.startsWith("/import")) return "Import";
  if (path.startsWith("/admin") || path.startsWith("/settings")) return "Settings";
  if (path.startsWith("/ai")) return "AI";
  if (path.startsWith("/search")) return "Search";
  if (path.startsWith("/login")) return "Login";
  return "Home";
}

function isActive(path: string, href: string): boolean {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(href + "/");
}

export function MobileHeader({ userEmail }: { userEmail?: string } = {}) {
  const path = usePathname();
  const title = sectionTitle(path ?? "/");
  return (
    <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-line">
      <div className="flex items-center justify-between gap-3 px-4 min-h-[56px] py-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-navy shrink-0">
            Waves
          </span>
          <span className="text-line shrink-0" aria-hidden="true">
            /
          </span>
          <h1 className="text-[15px] font-semibold text-navy truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {userEmail ? (
            <LogoutButton variant="dark" compact />
          ) : (
            <Link
              href="/login"
              className="btn min-h-[44px] min-w-[44px] justify-center !px-3"
            >
              Sign in
            </Link>
          )}
          <button
            type="button"
            aria-label="Open AI assistant"
            onClick={() => window.dispatchEvent(new CustomEvent("waves-ai-open"))}
            className="btn btn-primary min-h-[44px] min-w-[44px] justify-center !px-3"
          >
            AI
          </button>
        </div>
      </div>
    </div>
  );
}

const MORE_LINKS_BASE: { href: string; label: string }[] = [
  { href: "/discovery", label: "Discovery" },
  { href: "/markets", label: "Markets" },
  { href: "/followups", label: "Follow-ups" },
  { href: "/enquiries", label: "Enquiries" },
  { href: "/quotes", label: "Quotes" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/outreach", label: "Outreach" },
  { href: "/exporters", label: "Exporters" },
  { href: "/import", label: "Import" },
];

const MORE_ACTIONS: { href: string; label: string }[] = [
  { href: "/buyers/new", label: "+ Buyer" },
  { href: "/enquiries/new", label: "+ Enquiry" },
  { href: "/opportunities/new", label: "+ Opportunity" },
  { href: "/quotes/new", label: "+ Export quote" },
  { href: "/import", label: "Import buyers (CSV)" },
];

export function MoreSheet({ open, onClose, isAdmin = false }: { open: boolean; onClose: () => void; isAdmin?: boolean }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const moreLinks = isAdmin ? [...MORE_LINKS_BASE, { href: "/admin", label: "Settings" }] : MORE_LINKS_BASE;
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="lg:hidden fixed inset-0 z-40 bg-navy/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More navigation"
        className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-[12px] border-t border-line max-h-[80vh] overflow-y-auto sheet-up shadow-xl"
      >
        <div className="sticky top-0 bg-white flex items-center justify-between px-4 py-2 border-b border-line rounded-t-[12px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-navy2">More</p>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="btn min-h-[44px] min-w-[44px] justify-center"
          >
            Close
          </button>
        </div>
        <nav aria-label="More sections" className="p-2">
          {moreLinks.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={onClose}
              className="flex items-center min-h-[44px] px-3 py-2.5 rounded-[2px] text-[14px] text-navy hover:bg-panel2"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line p-2 pb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted px-3 py-2">
            Actions
          </p>
          {MORE_ACTIONS.map((a) => (
            <Link
              key={a.href + a.label}
              href={a.href}
              onClick={onClose}
              className="flex items-center min-h-[44px] px-3 py-2.5 rounded-[2px] text-[14px] font-medium text-navy hover:bg-panel2"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

export function BottomNav({ isAdmin = false }: { isAdmin?: boolean } = {}) {
  const path = usePathname() ?? "/";
  const [moreOpen, setMoreOpen] = useState(false);

  function openAI() {
    window.dispatchEvent(new CustomEvent("waves-ai-open"));
  }

  const itemBase =
    "flex flex-col items-center justify-center gap-0.5 min-h-[56px] min-w-[44px] flex-1 text-[11px] font-medium uppercase tracking-wide";
  const idle = "text-muted";
  const activeCls = "text-[#00A0AD]";

  return (
    <>
      <nav
        aria-label="Primary"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-line"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5 items-end px-1">
          <Link
            href="/"
            aria-label="Home"
            className={cn(itemBase, isActive(path, "/") ? activeCls : idle)}
          >
            <span aria-hidden="true" className="text-[18px] leading-none">
              ⌂
            </span>
            <span>Home</span>
          </Link>
          <Link
            href="/buyers"
            aria-label="Buyers"
            className={cn(itemBase, isActive(path, "/buyers") ? activeCls : idle)}
          >
            <span aria-hidden="true" className="text-[18px] leading-none">
              ◉
            </span>
            <span>Buyers</span>
          </Link>
          <div className="flex justify-center">
            <button
              type="button"
              aria-label="Open AI assistant"
              onClick={openAI}
              className="flex h-[56px] w-[56px] min-h-[44px] min-w-[44px] -mt-5 items-center justify-center rounded-full bg-accent text-navy text-[15px] font-bold shadow-lg border-2 border-white"
            >
              AI
            </button>
          </div>
          <Link
            href="/crm"
            aria-label="Pipeline"
            className={cn(itemBase, isActive(path, "/crm") ? activeCls : idle)}
          >
            <span aria-hidden="true" className="text-[18px] leading-none">
              ▤
            </span>
            <span>Pipeline</span>
          </Link>
          <button
            type="button"
            aria-label="Open more menu"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
            className={cn(itemBase, moreOpen ? activeCls : idle)}
          >
            <span aria-hidden="true" className="text-[18px] leading-none">
              ⋯
            </span>
            <span>More</span>
          </button>
        </div>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} isAdmin={isAdmin} />
    </>
  );
}
