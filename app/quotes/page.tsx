import Link from "next/link";
import { getDb } from "@/lib/db";
import { Empty, StageBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUSES = ["Draft", "Sent", "Viewed", "Negotiation", "Accepted", "Rejected", "Expired"];

export default async function Quotes({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const status = sp.status ?? "";
  const db = getDb();
  const rows = (status
    ? db.prepare("SELECT q.*, co.name AS cname FROM quotes q JOIN companies co ON co.id=q.company_id WHERE q.status=? ORDER BY q.id DESC").all(status)
    : db.prepare("SELECT q.*, co.name AS cname FROM quotes q JOIN companies co ON co.id=q.company_id ORDER BY q.id DESC").all()) as Record<string, unknown>[];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="eyebrow">Export pricing · Dry ginger · India → UAE / ME / EU / ZAF</p>
          <h1 className="h1">Dry ginger export quotes</h1>
          <p className="muted">{rows.length} dry ginger export quotes{status ? ` · ${status}` : ""}</p>
        </div>
        <Link href="/quotes/new" className="btn btn-primary">+ New export quote</Link>
      </div>
      <form className="card card-pad flex flex-wrap gap-2">
        <select name="status" defaultValue={status} className="select">
          <option value="">All quote stages</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn" type="submit">Filter quotes</button>
        {status && <Link href="/quotes" className="btn">Clear filter</Link>}
      </form>
      {rows.length === 0 ? <Empty title="No dry ginger export quotes yet" hint="Issue a CIF/FOB dry ginger quote with buyer, qty (MT), unit price, currency, packaging, Incoterm, destination port, validity, payment, lead time." /> : (
        <>
        <div className="card overflow-auto hidden md:block">
          <table className="table min-w-[900px]">
            <thead><tr><th>ID</th><th>Dry ginger buyer</th><th>Qty (MT dry ginger)</th><th>Unit price (/MT)</th><th>Currency</th><th>Incoterm</th><th>Destination port</th><th>Quote stage</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  <td><Link href={`/quotes/${String(r.id)}`} className="text-navy font-medium underline decoration-line underline-offset-4">#{String(r.id)}</Link></td>
                  <td><Link href={`/buyers/${String(r.company_id)}`} className="text-navy underline decoration-line underline-offset-4">{String(r.cname)}</Link></td>
                  <td>{String(r.qty) || "—"}</td>
                  <td>{String(r.unit_price) || "—"}</td>
                  <td>{String(r.currency)}</td>
                  <td>{String(r.incoterm)}</td>
                  <td>{String(r.destination) || "—"}</td>
                  <td><StageBadge stage={String(r.status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-2 md:hidden">
          {rows.map((r) => (
            <div key={String(r.id)} className="card card-pad space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/quotes/${String(r.id)}`} className="text-navy font-medium underline decoration-line underline-offset-4 min-h-[44px] inline-flex items-center">#{String(r.id)} · {String(r.cname)}</Link>
                <StageBadge stage={String(r.status)} />
              </div>
              <p className="text-[13px] text-navy">{String(r.qty) || "—"} @ {String(r.unit_price) || "—"} {String(r.currency)}</p>
              <p className="muted">{String(r.incoterm)} · → {String(r.destination) || "—"}</p>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
