import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, nowISO } from "@/lib/db";
import { PIPELINE_STAGES, CURRENCIES } from "@/lib/config";

export const dynamic = "force-dynamic";

const STAGES = [...PIPELINE_STAGES];

export default async function NewOpportunity({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const pre = sp.company ?? "";
  const db = getDb();
  const companies = await db.prepare("SELECT id, name, country FROM companies ORDER BY name").all() as Record<string, unknown>[];

  async function create(form: FormData) {
    "use server";
    const company_id = Number(form.get("company_id") ?? 0);
    if (!company_id) return;
    const db2 = getDb();
    const r = await db2.prepare("INSERT INTO opportunities(company_id,product,qty,price,currency,value,stage,probability,expected_close,next_action,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(
      company_id, String(form.get("product") ?? "Dry Ginger") || "Dry Ginger", String(form.get("qty") ?? ""),
      String(form.get("price") ?? ""), String(form.get("currency") ?? "USD") || "USD",
      Number(form.get("value") ?? 0) || 0, String(form.get("stage") ?? "Discovered") || "Discovered",
      Math.min(100, Math.max(0, Number(form.get("probability") ?? 10) || 0)),
      String(form.get("expected_close") ?? ""), String(form.get("next_action") ?? ""), String(form.get("notes") ?? ""), nowISO());
    const id = Number(r.lastInsertRowid);
    await db2.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(company_id, "opportunity", `Opportunity #${id} opened`, String(form.get("stage") ?? ""), "Sales", nowISO());
    redirect("/opportunities");
  }

  return (
    <div className="max-w-[720px] space-y-4">
      <Link href="/opportunities" className="muted underline">← Export opportunities</Link>
      <h1 className="h1">New dry ginger export opportunity</h1>
      <form action={create} className="card card-pad grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select name="company_id" required defaultValue={pre} className="select col-span-2">
          <option value="">Select dry ginger buyer (importer / distributor) *</option>
          {companies.map((c) => <option key={String(c.id)} value={String(c.id)}>{String(c.name)} · {String(c.country)}</option>)}
        </select>
        <input name="product" defaultValue="Dry Ginger" placeholder="Dry ginger form (Whole / Slices / Powder)" className="input" />
        <input name="qty" placeholder="Qty (e.g. 5 MT)" className="input" />
        <input name="price" placeholder="Price (e.g. USD 3200/MT CIF Jebel Ali)" className="input" />
        <select name="currency" defaultValue="USD" className="select">
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input name="value" type="number" step="any" min="0" placeholder="Enquiry value in selected currency (e.g. 16000)" className="input" />
        <select name="stage" defaultValue="Discovered" className="select">
          {STAGES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input name="probability" type="number" min="0" max="100" defaultValue="10" placeholder="Win probability % (10 = early enquiry, 80 = quote accepted)" className="input" />
        <input name="expected_close" type="date" className="input" />
        <input name="next_action" placeholder="Next follow-up (e.g. share CIF quotation + specs by Friday)" className="input col-span-2" />
        <input name="notes" placeholder="Notes (specs, HS 0910.12, packing 25/50kg, lead time)" className="input col-span-2" />
        <button className="btn btn-primary col-span-2" type="submit">Save dry ginger enquiry</button>
      </form>
    </div>
  );
}
