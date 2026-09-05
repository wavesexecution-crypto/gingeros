import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb, nowISO } from "@/lib/db";
import { StageBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUSES = ["Draft", "Sent", "Viewed", "Negotiation", "Accepted", "Rejected", "Expired"];

export default async function QuoteDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const q = (await db.prepare("SELECT q.*, co.name AS cname, c.name AS contact_name FROM quotes q JOIN companies co ON co.id=q.company_id LEFT JOIN contacts c ON c.id=q.contact_id WHERE q.id=?").get(id)) as Record<string, unknown> | undefined;
  if (!q) return notFound();
  const cid = Number(q.company_id);
  const items = await db.prepare("SELECT * FROM quote_items WHERE quote_id=?").all(id) as Record<string, unknown>[];

  async function setStatus(form: FormData) {
    "use server";
    const s = String(form.get("status") ?? "Draft");
    const db2 = getDb();
    await db2.prepare("UPDATE quotes SET status=? WHERE id=?").run(s, Number(id));
    await db2.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(cid, "system", `Quote #${id} → ${s}`, "", "Sales", nowISO());
    redirect(`/quotes/${id}`);
  }

  const fields: [string, string][] = [
    ["Product (Dry Ginger, India origin)", String(q.product)], ["Qty (MT)", String(q.qty)], ["Unit price (per MT + currency)", `${String(q.unit_price)} ${String(q.currency)}`],
    ["Packaging (e.g. 25kg PP)", String(q.packaging)], ["Incoterm", String(q.incoterm)], ["Destination port", String(q.destination)],
    ["Buyer contact", String(q.contact_name ?? "")], ["Linked enquiry #", String(q.enquiry_id ?? "")],
    ["Offer validity", String(q.validity)], ["Export payment terms", String(q.payment_terms)],
    ["Lead time / shipment", String(q.lead_time)], ["Quote date", String(q.created_at).slice(0, 10)],
  ];

  return (
    <div className="space-y-4 max-w-[860px]">
      <Link href="/quotes" className="muted underline">← Dry ginger export quotes</Link>
      <div className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold text-navy">Dry ginger export quote #{String(q.id)}</h1>
            <p className="muted"><Link href={`/buyers/${String(q.company_id)}`} className="underline underline-offset-4 text-navy">{String(q.cname)}</Link></p>
            <div className="mt-2"><StageBadge stage={String(q.status)} /></div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-[13px]">
          {fields.map(([k, v]) => (
            <div key={k} className="border border-line rounded p-2"><p className="muted text-[11px] uppercase">{k}</p><p className="text-navy">{v || "—"}</p></div>
          ))}
        </div>
        {String(q.notes) && <p className="muted mt-3 text-[13px]">Export notes: {String(q.notes)}</p>}
        {items.length > 0 && (
          <div className="mt-4">
            <h2 className="h2">Dry ginger line items (grade / packaging)</h2>
            <table className="table mt-2">
              <thead><tr><th>Grade / description</th><th>Qty (MT)</th><th>Unit price (/MT)</th></tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr key={String(it.id)}><td>{String(it.description)}</td><td>{String(it.qty)}</td><td>{String(it.unit_price)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <form action={setStatus} className="card card-pad flex flex-wrap items-center gap-2">
        <span className="h2">Quote stage</span>
        <select name="status" defaultValue={String(q.status)} className="select">
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-primary" type="submit">Update quote stage</button>
      </form>
    </div>
  );
}
