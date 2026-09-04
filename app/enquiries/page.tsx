import Link from "next/link";
import { getDb } from "@/lib/db";
import { Empty, StageBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUSES = ["New", "Qualified", "Quotation Required", "Quotation Sent", "Negotiation", "Won", "Lost"];

export default async function Enquiries({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const status = sp.status ?? "";
  const db = getDb();
  const rows = (status
    ? db.prepare("SELECT e.*, co.name AS cname FROM enquiries e JOIN companies co ON co.id=e.company_id WHERE e.status=? ORDER BY e.id DESC").all(status)
    : db.prepare("SELECT e.*, co.name AS cname FROM enquiries e JOIN companies co ON co.id=e.company_id ORDER BY e.id DESC").all()) as Record<string, unknown>[];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="eyebrow">Dry ginger export demand · India → UAE / ME / EU / ZAF</p>
          <h1 className="h1">Dry ginger enquiries</h1>
          <p className="muted">{rows.length} dry ginger enquiries{status ? ` · ${status}` : ""}</p>
        </div>
        <Link href="/enquiries/new" className="btn btn-primary">+ New dry ginger enquiry</Link>
      </div>
      <form className="card card-pad flex flex-wrap gap-2">
        <select name="status" defaultValue={status} className="select">
          <option value="">All enquiry stages</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn" type="submit">Filter enquiries</button>
        {status && <Link href="/enquiries" className="btn">Clear filter</Link>}
      </form>
      {rows.length === 0 ? <Empty title="No dry ginger enquiries yet" hint="Log buyer, country, dry ginger qty (MT), packaging, destination port, specs, certifications, target price, delivery + payment when a buyer shares demand." /> : (
        <>
        <div className="card overflow-auto hidden md:block">
          <table className="table min-w-[860px]">
            <thead><tr><th>ID</th><th>Buyer</th><th>Buyer country</th><th>Dry ginger qty (MT)</th><th>Destination port</th><th>Enquiry stage</th><th>Date</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  <td><Link href={`/enquiries/${String(r.id)}`} className="text-navy font-medium underline decoration-line underline-offset-4">#{String(r.id)}</Link></td>
                  <td><Link href={`/buyers/${String(r.company_id)}`} className="text-navy underline decoration-line underline-offset-4">{String(r.cname)}</Link></td>
                  <td>{String(r.country) || "—"}</td>
                  <td>{String(r.qty) || "—"}</td>
                  <td>{String(r.destination) || "—"}</td>
                  <td><StageBadge stage={String(r.status)} /></td>
                  <td className="muted">{String(r.created_at).slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-2 md:hidden">
          {rows.map((r) => (
            <div key={String(r.id)} className="card card-pad space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/enquiries/${String(r.id)}`} className="text-navy font-medium underline decoration-line underline-offset-4 min-h-[44px] inline-flex items-center">#{String(r.id)} · {String(r.cname)}</Link>
                <StageBadge stage={String(r.status)} />
              </div>
              <p className="muted">{String(r.country) || "—"} · {String(r.qty) || "—"} · → {String(r.destination) || "—"}</p>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
