import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { LabelBadge, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Exporters({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const marketF = (sp.market ?? "").toLowerCase();
  const productF = (sp.product ?? "").toLowerCase();
  const db = getDb();
  let rows = db.prepare("SELECT * FROM exporters ORDER BY name").all() as Record<string, unknown>[];
  if (marketF) rows = rows.filter((r) => String(r.export_markets ?? "").toLowerCase().includes(marketF) || String(r.name ?? "").toLowerCase().includes(marketF));
  if (productF) rows = rows.filter((r) => `${r.products} ${r.ginger_offering}`.toLowerCase().includes(productF));

  async function add(form: FormData) {
    "use server";
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    const evidence = String(form.get("evidence") ?? "").trim() || "Evidence not available";
    const certs = String(form.get("certs") ?? "").trim() || "Unknown";
    const label = name.startsWith("DEMO") ? "DEMO" : "MANUAL";
    const { getDb: gdb } = await import("@/lib/db");
    gdb().prepare("INSERT INTO exporters(name,location,website,products,ginger_offering,export_markets,certs,source,evidence,notes,data_label) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(
      name, String(form.get("location") ?? ""), String(form.get("website") ?? "") || "Unknown",
      String(form.get("products") ?? ""), String(form.get("ginger_offering") ?? ""),
      String(form.get("export_markets") ?? ""), certs,
      String(form.get("source") ?? "") || "MANUAL", evidence, String(form.get("notes") ?? ""), label
    );
    redirect("/exporters");
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow">Indian dry ginger competitor intel</p>
        <h1 className="h1">Indian exporter intelligence</h1>
        <p className="muted">{rows.length} Indian dry ginger exporters · certs: FSSAI / Spices Board / APEDA or Unknown · evidence required, never invented</p>
      </div>

      <form className="card card-pad flex flex-wrap gap-2">
        <input name="market" defaultValue={sp.market ?? ""} placeholder="Filter by export market (e.g. UAE, Germany, South Africa)" className="input w-full sm:!w-[260px]" />
        <input name="product" defaultValue={sp.product ?? ""} placeholder="Filter by dry ginger form (e.g. powder, whole, slices)" className="input w-full sm:!w-[260px]" />
        <button className="btn min-h-[44px]" type="submit">Filter exporters</button>
      </form>

      {rows.length === 0 ? <Empty title="No Indian dry ginger exporters match" hint="Broaden market / form filters or add an exporter below with evidence." /> : (
        <>
        <div className="card overflow-auto hidden md:block">
          <table className="table min-w-[1100px]">
            <thead><tr><th>Indian exporter</th><th>India location</th><th>Website</th><th>Other spices</th><th>Ginger offering</th><th>Export markets</th><th>Certs</th><th>Data source</th><th>Evidence</th><th>Source</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.id)}>
                  <td className="text-navy font-medium max-w-[180px]">{String(r.name)}<div className="muted font-normal">{String(r.notes ?? "").slice(0, 80)}</div></td>
                  <td>{String(r.location) || "—"}</td>
                  <td className="muted">{String(r.website) || "Unknown"}</td>
                  <td className="max-w-[180px]">{String(r.products) || "—"}</td>
                  <td className="max-w-[180px]">{String(r.ginger_offering) || "—"}</td>
                  <td className="max-w-[160px]">{String(r.export_markets) || "—"}</td>
                  <td>{String(r.certs) || "Unknown"}</td>
                  <td className="muted">{String(r.source) || "—"}</td>
                  <td className="muted max-w-[220px]">{String(r.evidence) || "Evidence not available"}</td>
                  <td><LabelBadge label={String(r.data_label)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-2 md:hidden">
          {rows.map((r) => (
            <div key={String(r.id)} className="card card-pad space-y-1">
              <p className="text-navy font-medium text-[14px]">{String(r.name)}</p>
              <p className="muted">{String(r.location) || "—"}</p>
              <p className="text-[13px] text-navy">Ginger: {String(r.ginger_offering) || "—"}</p>
              <p className="muted">Markets: {String(r.export_markets) || "—"}</p>
              <p><LabelBadge label={String(r.data_label)} /></p>
              <p className="muted">{String(r.evidence) || "Evidence not available"}</p>
            </div>
          ))}
        </div>
        </>
      )}

      <div className="card card-pad max-w-[860px]">
        <h2 className="h2">Add Indian dry ginger exporter</h2>
        <p className="muted mt-1">If unknown, leave blank — we store Unknown. Paste evidence URL / note; rows without evidence stay UNVERIFIED.</p>
        <form action={add} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          <input name="name" required placeholder="Indian exporter name * (e.g. Malabar Spices, Kochi)" className="input col-span-2" />
          <input name="location" placeholder="India location (City, State — e.g. Kochi, Kerala)" className="input" />
          <input name="website" placeholder="Website (e.g. example.in, or leave blank)" className="input" />
          <input name="products" placeholder="Other spices (dry ginger is assumed — e.g. cardamom, pepper)" className="input" />
          <input name="ginger_offering" placeholder="Ginger offering (whole / slices / powder)" className="input" />
          <input name="export_markets" placeholder="Export markets (e.g. UAE, Saudi Arabia, Germany, South Africa)" className="input" />
          <input name="certs" placeholder="Certs (e.g. FSSAI, Spices Board, APEDA — blank = Unknown)" className="input" />
          <input name="source" placeholder="Evidence source (e.g. Spices Board listing, exporter site)" className="input" />
          <input name="evidence" placeholder="Evidence URL / note (blank = Evidence not available)" className="input col-span-2" />
          <input name="notes" placeholder="Dry ginger notes (capacity, specs, MOQ)" className="input col-span-2" />
          <button className="btn btn-primary col-span-2" type="submit">Add dry ginger exporter</button>
        </form>
      </div>
    </div>
  );
}
