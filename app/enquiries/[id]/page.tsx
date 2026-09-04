import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb, nowISO } from "@/lib/db";
import { StageBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUSES = ["New", "Qualified", "Quotation Required", "Quotation Sent", "Negotiation", "Won", "Lost"];

export default async function EnquiryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const e = db.prepare("SELECT e.*, co.name AS cname, c.name AS contact_name FROM enquiries e JOIN companies co ON co.id=e.company_id LEFT JOIN contacts c ON c.id=e.contact_id WHERE e.id=?").get(id) as Record<string, unknown> | undefined;
  if (!e) return notFound();
  const cid = Number(e.company_id);

  async function setStatus(form: FormData) {
    "use server";
    const s = String(form.get("status") ?? "New");
    const db2 = getDb();
    db2.prepare("UPDATE enquiries SET status=? WHERE id=?").run(s, Number(id));
    db2.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(cid, "system", `Enquiry #${id} → ${s}`, "", "Sales", nowISO());
    redirect(`/enquiries/${id}`);
  }

  const fields: [string, string][] = [
    ["Product (Dry Ginger, India origin)", String(e.product)], ["Qty dry ginger (MT)", String(e.qty)], ["Buyer country (UAE / ME / EU / ZAF)", String(e.country)],
    ["Packaging", String(e.packaging)], ["Destination port", String(e.destination)], ["Buyer contact (procurement)", String(e.contact_name ?? "")],
    ["Specifications (moisture / admixture / grade)", String(e.specs)], ["Certifications", String(e.certs)], ["Target price (currency + Incoterm)", String(e.target_price)],
    ["Delivery / shipment terms", String(e.delivery)], ["Payment terms", String(e.payment_terms)], ["Enquiry date", String(e.created_at).slice(0, 10)],
  ];

  return (
    <div className="space-y-4 max-w-[860px]">
      <Link href="/enquiries" className="muted underline">← Dry ginger enquiries</Link>
      <div className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold text-navy">Dry ginger enquiry #{String(e.id)} — India origin</h1>
            <p className="muted"><Link href={`/buyers/${String(e.company_id)}`} className="underline underline-offset-4 text-navy">{String(e.cname)}</Link></p>
            <div className="mt-2"><StageBadge stage={String(e.status)} /></div>
          </div>
          <Link href={`/quotes/new?company=${String(e.company_id)}`} className="btn btn-primary">Quote dry ginger to this buyer (CIF/FOB)</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-[13px]">
          {fields.map(([k, v]) => (
            <div key={k} className="border border-line rounded p-2"><p className="muted text-[11px] uppercase">{k}</p><p className="text-navy">{v || "—"}</p></div>
          ))}
        </div>
        {String(e.notes) && <p className="muted mt-3 text-[13px]">Buyer notes / requirements: {String(e.notes)}</p>}
      </div>
      <form action={setStatus} className="card card-pad flex flex-wrap items-center gap-2">
        <span className="h2">Enquiry stage</span>
        <select name="status" defaultValue={String(e.status)} className="select">
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-primary" type="submit">Update enquiry stage</button>
      </form>
    </div>
  );
}
