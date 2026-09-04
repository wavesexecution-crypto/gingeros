import { redirect } from "next/navigation";
import { getDb, nowISO, todayISO } from "@/lib/db";
import { scoreBuyer } from "@/lib/qualification";
import { regionForCountry } from "@/lib/config";

export default function NewBuyer() {
  async function create(form: FormData) {
    "use server";
    const name = String(form.get("name") ?? "").trim();
    const country = String(form.get("country") ?? "").trim();
    if (!name || !country) return;
    const type = String(form.get("company_type") ?? "Other");
    const fit = String(form.get("ginger_fit") ?? "Unknown");
    const geo = ["UAE","Saudi Arabia","Qatar","Oman","Kuwait","Bahrain","United Kingdom","Germany","France","Netherlands","Italy","Spain","South Africa"].includes(country) ? 2 : 1;
    const pr = fit === "High" ? 3 : fit === "Medium" ? 2 : 1;
    const gf = fit === "High" ? 3 : fit === "Medium" ? 2 : 0;
    const { score, grade } = scoreBuyer({ productRelevance: pr as 0|1|2|3, importerStatus: type==="Importer"?2:1, internationalSourcing: 1, gingerFit: gf as 0|1|2|3, geoPriority: geo as 0|1|2, companyQuality: 1, contactAvailability: 0, evidenceStrength: 0, buyingSignals: 0 });
    const db = getDb();
    const r = db.prepare(`INSERT INTO companies(name,country,city,website,company_type,industry,products,ginger_fit,import_relevance,size,source,source_url,date_discovered,evidence,buyer_status,qual_score,grade,priority,outreach_status,last_activity,owner,notes,data_label) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      name, country, String(form.get("city") ?? ""), String(form.get("website") ?? "Unknown"), type, String(form.get("industry") ?? ""), String(form.get("products") ?? ""), fit, "Unknown", "Unknown", "MANUAL", String(form.get("source_url") ?? ""), todayISO(), String(form.get("evidence") ?? "") || "Evidence not available",
      "Discovered", score, grade, grade==="A"?"High":grade==="B"?"Medium":"Low", "Not contacted", todayISO(), String(form.get("owner") ?? "Unassigned"), String(form.get("notes") ?? ""), "MANUAL");
    const id = Number(r.lastInsertRowid);
    db.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(id, "system", "Buyer added manually", `Score ${score}/100 grade ${grade}`, "System", nowISO());
    redirect(`/buyers/${id}`);
  }
  return (
    <div className="max-w-[720px] space-y-4">
      <h1 className="h1">Add dry ginger importer</h1>
      <p className="muted">Manual entry is labelled MANUAL. Unknown fields must stay Unknown — never fabricate. Applies to UAE · Middle East · Europe · South Africa.</p>
      <form action={create} className="card card-pad grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input name="name" required placeholder="Importer company name * (e.g. Gulf Spice Trading LLC)" className="input col-span-2" />
        <input name="country" required placeholder="Export market / country * (UAE, Saudi Arabia, Germany…)" className="input" />
        <input name="city" placeholder="City (e.g. Dubai, Rotterdam, Durban)" className="input" />
        <input name="website" placeholder="Importer website or Unknown" className="input" />
        <select name="company_type" className="select"><option>Importer</option><option>Distributor</option><option>Wholesaler</option><option>Spice company</option><option>Food ingredient company</option><option>Food manufacturer</option><option>Beverage manufacturer</option><option>Hotel supplier</option><option>Restaurant supplier</option><option>Trading company</option><option>Other</option></select>
        <input name="industry" placeholder="Industry (Spices / Food ingredients)" className="input" />
        <select name="ginger_fit" className="select"><option>High</option><option>Medium</option><option>Low</option><option>Unknown</option></select>
        <input name="products" placeholder="Dry ginger specs (whole / slices / powder, MOQ MT, pack)" className="input" />
        <input name="evidence" placeholder="Import evidence (trade listing / website / referral, or blank)" className="input col-span-2" />
        <input name="source_url" placeholder="Evidence source URL / reference" className="input col-span-2" />
        <input name="owner" placeholder="Sales owner" className="input" />
        <input name="notes" placeholder="Export notes (qty MT, CIF/FOB, destination port)" className="input" />
        <button className="btn btn-primary col-span-2" type="submit">Create importer + auto-qualify (A/B/C)</button>
      </form>
    </div>
  );
}
