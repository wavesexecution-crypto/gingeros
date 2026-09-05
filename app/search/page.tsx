import Link from "next/link";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const raw = (sp.q ?? "").trim();
  const needle = raw.toLowerCase();
  let groups: { companies: Record<string, unknown>[]; contacts: Record<string, unknown>[]; opportunities: Record<string, unknown>[]; enquiries: Record<string, unknown>[]; quotes: Record<string, unknown>[] } | null = null;
  if (needle) {
    const db = getDb();
    const inc = (...vals: unknown[]) => vals.some((v) => String(v ?? "").toLowerCase().includes(needle));
    groups = {
      companies: (await db.prepare("SELECT id, name, city, country, products FROM companies").all() as Record<string, unknown>[]).filter((r) => inc(r.name, r.city, r.country, r.products)).slice(0, 20),
      contacts: (await db.prepare("SELECT t.*, c.name cname FROM contacts t JOIN companies c ON c.id=t.company_id").all() as Record<string, unknown>[]).filter((r) => inc(r.name, r.email, r.role)).slice(0, 20),
      opportunities: (await db.prepare("SELECT o.*, c.name cname FROM opportunities o JOIN companies c ON c.id=o.company_id").all() as Record<string, unknown>[]).filter((r) => inc(r.product, r.next_action, r.cname)).slice(0, 20),
      enquiries: (await db.prepare("SELECT e.*, c.name cname FROM enquiries e JOIN companies c ON c.id=e.company_id").all() as Record<string, unknown>[]).filter((r) => inc(r.product, r.destination, r.cname)).slice(0, 20),
      quotes: (await db.prepare("SELECT q.*, c.name cname FROM quotes q JOIN companies c ON c.id=q.company_id").all() as Record<string, unknown>[]).filter((r) => inc(r.product, r.destination, r.cname)).slice(0, 20),
    };
  }
  return (
    <div className="space-y-4 max-w-[960px]">
      <h1 className="h1">Search</h1>
      <form className="flex flex-col sm:flex-row gap-2 max-w-xl">
        <input name="q" defaultValue={raw} placeholder="Companies, contacts, opportunities, enquiries, quotes…" className="input flex-1" />
        <button className="btn btn-primary min-h-[44px] justify-center" type="submit">Search</button>
      </form>
      {!groups && <p className="muted">Type a query — fast, forgiving lowercase match.</p>}
      {groups && (
        <div className="grid gap-4">
          <div className="card card-pad"><h2 className="h2">Companies ({groups.companies.length})</h2>
            {groups.companies.map((r) => <p key={String(r.id)} className="mt-1 text-[13px]"><Link href={`/buyers/${String(r.id)}`} className="text-navy underline decoration-line underline-offset-4 min-h-[44px] inline-flex items-center">{String(r.name)}</Link> <span className="muted">· {String(r.city)} {String(r.country)} · {String(r.products).slice(0, 60)}</span></p>)}
          </div>
          <div className="card card-pad"><h2 className="h2">Contacts ({groups.contacts.length})</h2>
            {groups.contacts.map((r) => <p key={String(r.id)} className="mt-1 text-[13px]"><span className="text-navy">{String(r.name)}</span> <span className="muted">· {String(r.email)} · {String(r.role)} · </span><Link href={`/buyers/${String(r.company_id)}`} className="underline decoration-line underline-offset-4 min-h-[44px] inline-flex items-center">{String(r.cname)}</Link></p>)}
          </div>
          <div className="card card-pad"><h2 className="h2">Opportunities ({groups.opportunities.length})</h2>
            {groups.opportunities.map((r) => <p key={String(r.id)} className="mt-1 text-[13px]"><span className="text-navy">{String(r.cname)} · {String(r.product)}</span> <span className="muted">· {String(r.stage)} · {String(r.next_action).slice(0, 80)}</span></p>)}
          </div>
          <div className="card card-pad"><h2 className="h2">Enquiries ({groups.enquiries.length})</h2>
            {groups.enquiries.map((r) => <p key={String(r.id)} className="mt-1 text-[13px]"><span className="text-navy">{String(r.cname)} · {String(r.product)}</span> <span className="muted">· {String(r.destination)} · {String(r.status)}</span></p>)}
          </div>
          <div className="card card-pad"><h2 className="h2">Quotes ({groups.quotes.length})</h2>
            {groups.quotes.map((r) => <p key={String(r.id)} className="mt-1 text-[13px]"><span className="text-navy">{String(r.cname)} · {String(r.product)}</span> <span className="muted">· {String(r.destination)} · {String(r.status)}</span></p>)}
          </div>
        </div>
      )}
    </div>
  );
}
