"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Focused nav for the Dry Ginger International Sales OS (India → UAE / Middle East / Europe / South Africa).
// Primary = daily export workflow. Secondary = supporting modules. Routes not listed here still exist
// (e.g. /search, /login, /countries) but are reached contextually to keep the nav focused.
function buildGroups(role: string | undefined) {
  const groups: { label: string; links: { href: string; label: string }[] }[] = [
    {
      label: "Dry Ginger Export",
      links: [
        { href: "/", label: "Home" },
        { href: "/buyers", label: "Buyers" },
        { href: "/discovery", label: "Discovery" },
        { href: "/markets", label: "Markets" },
        { href: "/crm", label: "CRM" },
        { href: "/followups", label: "Follow-ups" },
        { href: "/enquiries", label: "Enquiries" },
        { href: "/quotes", label: "Quotes" },
        { href: "/ai", label: "AI" },
      ],
    },
    {
      label: "Secondary",
      links: [
        { href: "/exporters", label: "Exporters" },
        { href: "/opportunities", label: "Opportunities" },
        { href: "/outreach", label: "Outreach" },
        { href: "/import", label: "Import" },
        // Settings is Waves-internal admin — the client must not see it.
        ...(role === "admin" ? [{ href: "/admin", label: "Settings" } as { href: string; label: string }] : []),
      ],
    },
  ];
  return groups;
}

function active(path: string, href: string) {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(href + "/");
}

export function SidebarNav({ role }: { role?: string } = {}) {
  const path = usePathname();
  const groups = buildGroups(role);
  return (
    <nav className="flex-1 overflow-auto p-3">
      {groups.map((g) => (
        <div key={g.label} className="mb-4">
          <p className="sidebar-label px-3 pb-1.5">{g.label}</p>
          <div className="space-y-0.5">
            {g.links.map((n) => (
              <Link key={n.href} href={n.href} className={cn("navlink", active(path, n.href) && "navlink-active")}>
                {n.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const path = usePathname();
  const all = buildGroups(undefined).flatMap((g) => g.links);
  return (
    <nav className="md:hidden flex gap-2 overflow-auto px-4 pb-2 scroll-thin bg-white border-b border-line">
      {all.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={active(path, n.href) ? "btn btn-primary whitespace-nowrap" : "btn whitespace-nowrap"}
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
