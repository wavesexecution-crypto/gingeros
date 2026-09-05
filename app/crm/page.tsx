import { getDb } from "@/lib/db";
import { PIPELINE_STAGES } from "@/lib/config";
import Board, { type Card } from "./board";

export const dynamic = "force-dynamic";

export default async function CRM() {
  const db = getDb();
  const companies = await db.prepare("SELECT id,name,country,grade,qual_score,buyer_status FROM companies ORDER BY qual_score DESC").all() as Record<string, unknown>[];
  const vals = await db.prepare("SELECT company_id, COALESCE(SUM(value),0) v FROM opportunities WHERE stage NOT IN ('Won','Lost') GROUP BY company_id").all() as { company_id: number; v: number }[];
  const vmap = new Map(vals.map((v) => [Number(v.company_id), Number(v.v)]));
  const initial: Record<string, Card[]> = {};
  for (const s of PIPELINE_STAGES) initial[s] = [];
  for (const c of companies) {
    const st = String(c.buyer_status ?? "Discovered");
    const card: Card = {
      id: Number(c.id), name: String(c.name), country: String(c.country),
      grade: String(c.grade), score: Number(c.qual_score), value: vmap.get(Number(c.id)) ?? 0,
    };
    if (initial[st]) initial[st].push(card);
    else initial[st] = [card];
  }
  const total = companies.length;
  const openVal = [...vmap.values()].reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow">Dry ginger buyer pipeline · India → UAE / ME / EU / ZAF</p>
        <h1 className="h1">CRM — dry ginger buyer pipeline</h1>
        <p className="muted">{total} dry ginger buyers · {openVal.toLocaleString()} open enquiry value (mixed currencies)<span className="hidden md:inline"> · drag buyers between stages</span><span className="md:hidden"> · pick a stage to review</span></p>
      </div>
      <Board initial={initial} stages={[...PIPELINE_STAGES]} />
    </div>
  );
}
