import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, nowISO } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewEnquiry({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const pre = sp.company ?? "";
  const db = getDb();
  const companies = db.prepare("SELECT id, name, country FROM companies ORDER BY name").all() as Record<string, unknown>[];
  const contacts = db.prepare("SELECT c.id, c.name, co.name AS cname FROM contacts c JOIN companies co ON co.id=c.company_id ORDER BY c.name").all() as Record<string, unknown>[];

  async function create(form: FormData) {
    "use server";
    const company_id = Number(form.get("company_id") ?? 0);
    if (!company_id) return;
    const contactRaw = String(form.get("contact_id") ?? "");
    const db2 = getDb();
    const r = db2.prepare("INSERT INTO enquiries(company_id,contact_id,country,product,qty,packaging,destination,specs,certs,target_price,delivery,payment_terms,status,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(
      company_id, contactRaw ? Number(contactRaw) : null,
      String(form.get("country") ?? ""), String(form.get("product") ?? "Dry Ginger") || "Dry Ginger",
      String(form.get("qty") ?? ""), String(form.get("packaging") ?? ""), String(form.get("destination") ?? ""),
      String(form.get("specs") ?? ""), String(form.get("certs") ?? ""), String(form.get("target_price") ?? ""),
      String(form.get("delivery") ?? ""), String(form.get("payment_terms") ?? ""),
      "New", String(form.get("notes") ?? ""), nowISO());
    const id = Number(r.lastInsertRowid);
    db2.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(company_id, "enquiry", `Enquiry #${id} logged`, String(form.get("qty") ?? ""), "Sales", nowISO());
    redirect("/enquiries");
  }

  return (
    <div className="max-w-[720px] space-y-4">
      <Link href="/enquiries" className="muted underline">← Dry ginger enquiries</Link>
      <h1 className="h1">New dry ginger enquiry — India origin</h1>
      <form action={create} className="card card-pad grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select name="company_id" required defaultValue={pre} className="select col-span-2">
          <option value="">Select dry ginger buyer (UAE / Middle East / Europe / South Africa importer) *</option>
          {companies.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)} · {String(c.country)}</option>)}
        </select>
        <select name="contact_id" defaultValue="" className="select col-span-2">
          <option value="">No buyer contact (optional — procurement / import)</option>
          {contacts.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)} · {String(c.cname)}</option>)}
        </select>
        <input name="country" placeholder="Buyer country (e.g. UAE)" className="input" />
        <input name="product" defaultValue="Dry Ginger" readOnly title="Product is fixed: Dry Ginger, Origin India" placeholder="Product (fixed: Dry Ginger, Origin India)" className="input opacity-70" />
        <input name="qty" placeholder="Qty dry ginger (e.g. 5 MT)" className="input" />
        <input name="packaging" placeholder="Packaging (e.g. 25kg PP bags)" className="input" />
        <input name="destination" placeholder="Destination port (e.g. Jebel Ali, Rotterdam, Durban)" className="input" />
        <input name="target_price" placeholder="Target price (e.g. USD 3200/MT CIF Jebel Ali)" className="input" />
        <input name="specs" placeholder="Specifications — moisture, admixture, grade" className="input col-span-2" />
        <input name="certs" placeholder="Certifications required (e.g. Phytosanitary, FSSAI, lab report)" className="input col-span-2" />
        <input name="delivery" placeholder="Delivery / shipment timeline (e.g. 15 days ex-Kochi)" className="input" />
        <input name="payment_terms" placeholder="Payment terms (e.g. 30% TT advance, LC, CAD)" className="input" />
        <input name="notes" placeholder="Notes — buyer urgency, spec details, competing offer" className="input col-span-2" />
        <button className="btn btn-primary col-span-2" type="submit">Save dry ginger enquiry</button>
      </form>
    </div>
  );
}
