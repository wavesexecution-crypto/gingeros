import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, nowISO } from "@/lib/db";
import { CURRENCIES, INCOTERMS } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function NewQuote({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const pre = sp.company ?? "";
  const db = getDb();
  const companies = await db.prepare("SELECT id, name, country FROM companies ORDER BY name").all() as Record<string, unknown>[];
  const contacts = await db.prepare("SELECT c.id, c.name, co.name AS cname FROM contacts c JOIN companies co ON co.id=c.company_id ORDER BY c.name").all() as Record<string, unknown>[];
  const enquiries = await db.prepare("SELECT e.id, e.product, e.qty, co.name AS cname FROM enquiries e JOIN companies co ON co.id=e.company_id ORDER BY e.id DESC").all() as Record<string, unknown>[];

  async function create(form: FormData) {
    "use server";
    const company_id = Number(form.get("company_id") ?? 0);
    if (!company_id) return;
    const contactRaw = String(form.get("contact_id") ?? "");
    const enquiryRaw = String(form.get("enquiry_id") ?? "");
    const db2 = getDb();
    const r = await db2.prepare("INSERT INTO quotes(company_id,contact_id,enquiry_id,product,qty,unit_price,currency,packaging,incoterm,destination,validity,payment_terms,lead_time,status,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
      company_id, contactRaw ? Number(contactRaw) : null, enquiryRaw ? Number(enquiryRaw) : null,
      String(form.get("product") ?? "Dry Ginger") || "Dry Ginger", String(form.get("qty") ?? ""),
      String(form.get("unit_price") ?? ""), String(form.get("currency") ?? "USD") || "USD",
      String(form.get("packaging") ?? ""), String(form.get("incoterm") ?? "CIF") || "CIF",
      String(form.get("destination") ?? ""), String(form.get("validity") ?? ""),
      String(form.get("payment_terms") ?? ""), String(form.get("lead_time") ?? ""),
      "Draft", String(form.get("notes") ?? ""), nowISO());
    const id = Number(r.lastInsertRowid);
    await db2.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(company_id, "quote", `Quote #${id} drafted`, `${String(form.get("qty") ?? "")} @ ${String(form.get("unit_price") ?? "")}`, "Sales", nowISO());
    redirect("/quotes");
  }

  return (
    <div className="max-w-[720px] space-y-4">
      <Link href="/quotes" className="muted underline">← Dry ginger export quotes</Link>
      <h1 className="h1">New dry ginger export quote — India origin</h1>
      <form action={create} className="card card-pad grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select name="company_id" required defaultValue={pre} className="select col-span-2">
          <option value="">Select export buyer (importer) *</option>
          {companies.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)} · {String(c.country)}</option>)}
        </select>
        <select name="contact_id" defaultValue="" className="select">
          <option value="">No buyer contact (optional)</option>
          {contacts.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)} · {String(c.cname)}</option>)}
        </select>
        <select name="enquiry_id" defaultValue="" className="select">
          <option value="">No linked enquiry (optional)</option>
          {enquiries.map((e) => <option key={String(e.id)} value={String(e.id)}>Enquiry #{String(e.id)} · {String(e.cname)} · {String(e.qty)}</option>)}
        </select>
        <input name="product" defaultValue="Dry Ginger" readOnly title="Product is fixed: Dry Ginger, Origin India" placeholder="Dry Ginger (India origin — fixed)" className="input opacity-70" />
        <input name="qty" placeholder="Qty dry ginger (e.g. 5 MT)" className="input" />
        <input name="unit_price" placeholder="Unit price per MT (e.g. 3200 USD/MT)" className="input" />
        <select name="currency" defaultValue="USD" className="select">
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input name="packaging" placeholder="Packaging (e.g. 25kg PP bags)" className="input" />
        <select name="incoterm" defaultValue="CIF" title="Incoterm (CIF default for export)" className="select">
          {INCOTERMS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <input name="destination" placeholder="Destination port (e.g. Jebel Ali, Rotterdam, Durban)" className="input" />
        <input name="validity" placeholder="Offer validity (e.g. 15 days)" className="input" />
        <input name="payment_terms" placeholder="Export payment terms (e.g. 30% TT + CAD)" className="input" />
        <input name="lead_time" placeholder="Lead time / shipment (e.g. 15 days ex-Kochi)" className="input" />
        <input name="notes" placeholder="Export notes (grade, shipment)" className="input col-span-2" />
        <button className="btn btn-primary col-span-2" type="submit">Save draft export quote (Dry Ginger)</button>
      </form>
    </div>
  );
}
