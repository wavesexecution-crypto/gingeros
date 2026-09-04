import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDb, nowISO } from "@/lib/db";
import { PIPELINE_STAGES } from "@/lib/config";
import { StageBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const STAGES = [...PIPELINE_STAGES];

export default async function OpportunityDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const o = db.prepare("SELECT o.*, co.name AS cname, co.country AS ccountry FROM opportunities o JOIN companies co ON co.id=o.company_id WHERE o.id=?").get(id) as Record<string, unknown> | undefined;
  if (!o) return notFound();
  const cid = Number(o.company_id);

  async function update(form: FormData) {
    "use server";
    const stage = String(form.get("stage") ?? "Discovered");
    const prob = Math.min(100, Math.max(0, Number(form.get("probability") ?? 0) || 0));
    const next = String(form.get("next_action") ?? "");
    const db2 = getDb();
    db2.prepare("UPDATE opportunities SET stage=?, probability=?, next_action=?, last_activity=date('now') WHERE id=?").run(stage, prob, next, Number(id));
    db2.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(cid, "system", `Opportunity #${id} → ${stage} (${prob}%)`, next, "Sales", nowISO());
    redirect(`/opportunities/${id}`);
  }

  const v = Number(o.value || 0), p = Number(o.probability || 0);
  const fields: [string, string][] = [
    ["Dry ginger form", String(o.product)], ["Qty (MT)", String(o.qty)], ["Price (/MT + Incoterm)", String(o.price)],
    ["Value + currency", `${v.toLocaleString()} ${String(o.currency)}`], ["Expected value (value × win %)", Math.round(v * p / 100).toLocaleString()],
    ["Expected close", String(o.expected_close)], ["Last follow-up", String(o.last_activity)], ["Opened", String(o.created_at).slice(0, 10)],
  ];

  return (
    <div className="space-y-4 max-w-[860px]">
      <Link href="/opportunities" className="muted underline">← Export opportunities</Link>
      <div className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold text-navy">Dry ginger enquiry #{String(o.id)}</h1>
            <p className="muted"><Link href={`/buyers/${String(o.company_id)}`} className="underline underline-offset-4 text-navy">{String(o.cname)}</Link> · {String(o.ccountry)}</p>
            <div className="mt-2"><StageBadge stage={String(o.stage)} /> <span className="badge badge-neutral ml-2">{p}%</span></div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-[13px]">
          {fields.map(([k, val]) => (
            <div key={k} className="border border-line rounded p-2"><p className="muted text-[11px] uppercase">{k}</p><p className="text-navy">{val || "—"}</p></div>
          ))}
          <div className="border border-line rounded p-2 col-span-2"><p className="muted text-[11px] uppercase">Next follow-up</p><p className="text-navy">{String(o.next_action) || "—"}</p></div>
        </div>
        {String(o.notes) && <p className="muted mt-3 text-[13px]">Enquiry notes (specs, packing, Incoterm): {String(o.notes)}</p>}
      </div>
      <form action={update} className="card card-pad">
        <h2 className="h2">Move dry ginger enquiry</h2>
        <div className="grid sm:grid-cols-3 gap-2 mt-3">
          <select name="stage" defaultValue={String(o.stage)} className="select">
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <input name="probability" type="number" min="0" max="100" defaultValue={p} className="input" />
          <input name="next_action" defaultValue={String(o.next_action)} placeholder="Next follow-up (e.g. buyer to confirm 5 MT CIF…)" className="input" />
        </div>
        <button className="btn btn-primary mt-3" type="submit">Update dry ginger enquiry</button>
      </form>
    </div>
  );
}
