import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, nowISO } from "@/lib/db";
import { OUTREACH_STATUS } from "@/lib/config";
import { GradeBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const TEMPLATES = [
  { name: "Intro — Dry ginger offer", subject: "Dry ginger from India — specs & pricing", body: "Dear Procurement team,\n\nI'm writing from India regarding dry ginger (whole / slices / powder, HS 0910.12).\n\nCould you share: (1) required form & specs, (2) monthly quantity, (3) destination port, (4) packaging? I'll revert with specs, validity, Incoterm and lead time.\n\nBest regards" },
  { name: "Follow-up nudge", subject: "Follow-up — dry ginger enquiry", body: "Just following up on my note last week. If helpful I can share specs + indicative CIF pricing once you confirm quantity and destination port. Should I keep this open or close for now?" },
  { name: "Quotation follow-up", subject: "Quotation validity — dry ginger", body: "Checking in on the quotation shared (validity noted inside). Happy to discuss Incoterm, packaging or lead time. Shall we lock quantity and delivery window this week?" },
];

export default async function Outreach({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const filter = sp.status ?? "";
  const db = getDb();
  const counts = await db.prepare("SELECT outreach_status s, COUNT(*) c FROM companies GROUP BY outreach_status").all() as { s: string; c: number }[];
  let rows = await db.prepare("SELECT id,name,country,grade,qual_score,outreach_status FROM companies ORDER BY qual_score DESC").all() as Record<string, unknown>[];
  if (filter) rows = rows.filter((r) => String(r.outreach_status) === filter);
  const contacts = await db.prepare("SELECT * FROM contacts ORDER BY company_id, is_dm DESC, id").all() as Record<string, unknown>[];
  const first = new Map<number, Record<string, unknown>>();
  for (const c of contacts) {
    const k = Number(c.company_id);
    if (!first.has(k)) first.set(k, c);
  }
  const companies = await db.prepare("SELECT id,name FROM companies ORDER BY name").all() as { id: number; name: string }[];

  async function log(form: FormData) {
    "use server";
    const company_id = Number(form.get("company_id"));
    const channel = String(form.get("channel") ?? "Email");
    const subject = String(form.get("subject") ?? "");
    const body = String(form.get("body") ?? "");
    if (!company_id) return;
    const db2 = getDb();
    await db2.prepare("INSERT INTO communications(company_id,channel,direction,subject,body,status,created_at) VALUES(?,?,?,?,?,?,?)").run(company_id, channel, "outbound", subject, body, "logged", nowISO());
    await db2.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(company_id, channel.toLowerCase(), `${channel} logged — ${subject}`.slice(0, 120), body.slice(0, 500), "Sales", nowISO());
    await db2.prepare("UPDATE companies SET outreach_status=CASE WHEN outreach_status='Not contacted' THEN 'Contacted' ELSE outreach_status END, last_activity=CURRENT_DATE WHERE id=?").run(company_id);
    redirect("/outreach" + (filter ? `?status=${encodeURIComponent(filter)}` : ""));
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow">Dry ginger buyer outreach</p>
        <h1 className="h1">Dry ginger outreach — follow up buyers</h1>
        <p className="muted">Follow-up log — no auto-send. Share specs + CIF quotation manually, then log it here.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Link href="/outreach" className="btn">All buyers ({rows.length !== counts.reduce((a, x) => a + Number(x.c), 0) ? rows.length : counts.reduce((a, x) => a + Number(x.c), 0)})</Link>
        {[...OUTREACH_STATUS].map((s) => (
          <Link key={s} href={`/outreach?status=${encodeURIComponent(s)}`} className={`btn ${filter === s ? "btn-primary" : ""}`}>
            {s} ({counts.find((x) => x.s === s)?.c ?? 0})
          </Link>
        ))}
      </div>
      <div className="card overflow-auto hidden md:block">
        <table className="table min-w-[860px]">
          <thead><tr><th>Dry ginger buyer</th><th>Buyer contact</th><th>Outreach status</th><th>Log follow-up</th></tr></thead>
          <tbody>
            {rows.slice(0, 80).map((r) => {
              const ct = first.get(Number(r.id));
              return (
                <tr key={String(r.id)}>
                  <td><Link href={`/buyers/${String(r.id)}`} className="text-navy font-medium underline decoration-line underline-offset-4">{String(r.name)}</Link><div className="muted">{String(r.country)} · <GradeBadge grade={String(r.grade)} score={Number(r.qual_score)} /></div></td>
                  <td className="text-[12px]">{ct ? <span>{String(ct.name)}{Number(ct.is_dm) ? " · Decision-maker" : ""}<br /><span className="muted">✉ {String(ct.email)} · ☎ {String(ct.phone)}</span></span> : <span className="muted">No buyer contact yet — add procurement / decision-maker</span>}</td>
                  <td>{String(r.outreach_status)}</td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      {["Email", "Call", "WhatsApp", "LinkedIn"].map((ch) => (
                        <form key={ch} action={log}>
                          <input type="hidden" name="company_id" value={String(r.id)} />
                          <input type="hidden" name="channel" value={ch} />
                          <input type="hidden" name="subject" value={`${ch} follow-up — dry ginger specs & CIF · ${String(r.name)}`} />
                          <input type="hidden" name="body" value={`Logged ${ch} follow-up: shared dry ginger form / qty / port — edit in timeline.`} />
                          <button className="btn !px-2 !py-1 !text-[12px]" type="submit">{ch}</button>
                        </form>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length > 80 && <p className="muted p-3">Showing 80 of {rows.length} dry ginger buyers — filter by outreach status.</p>}
      </div>
      <div className="grid gap-2 md:hidden">
        {rows.slice(0, 80).map((r) => {
          const ct = first.get(Number(r.id));
          return (
            <div key={String(r.id)} className="card card-pad space-y-1">
              <Link href={`/buyers/${String(r.id)}`} className="text-navy font-medium underline decoration-line underline-offset-4 min-h-[44px] inline-flex items-center">{String(r.name)}</Link>
              <p className="muted">{String(r.country)} · {String(r.outreach_status)}</p>
              <p className="text-[12px] text-navy">{ct ? `${String(ct.name)}${Number(ct.is_dm) ? " · Decision-maker" : ""} · ${String(ct.email)} · ${String(ct.phone)}` : "No buyer contact yet — add procurement / decision-maker"}</p>
              <div className="flex gap-2 flex-wrap pt-1">
                {["Email", "Call", "WhatsApp", "LinkedIn"].map((ch) => (
                  <form key={ch} action={log}>
                    <input type="hidden" name="company_id" value={String(r.id)} />
                    <input type="hidden" name="channel" value={ch} />
                    <input type="hidden" name="subject" value={`${ch} follow-up — dry ginger specs & CIF · ${String(r.name)}`} />
                    <input type="hidden" name="body" value={`Logged ${ch} follow-up: shared dry ginger form / qty / port — edit in timeline.`} />
                    <button className="btn min-h-[44px] !px-3" type="submit">{ch}</button>
                  </form>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        {TEMPLATES.map((t) => (
          <div key={t.name} className="card card-pad">
            <h2 className="h2">{t.name}</h2>
            <p className="muted mt-1">Subject: {t.subject}</p>
            <pre className="whitespace-pre-wrap text-[12px] text-body mt-2 font-sans">{t.body}</pre>
          </div>
        ))}
      </div>
      <form action={log} className="card card-pad space-y-2 max-w-[720px]">
        <h2 className="h2">Log dry ginger follow-up</h2>
        <div className="flex gap-2 flex-wrap">
          <select name="company_id" className="select" required><option value="">Select dry ginger buyer…</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select name="channel" className="select"><option>Email</option><option>Call</option><option>WhatsApp</option><option>LinkedIn</option></select>
        </div>
        <input name="subject" placeholder="Subject (e.g. Dry ginger CIF quotation — Jebel Ali)" className="input" />
        <textarea name="body" placeholder="Message (dry ginger form, specs HS 0910.12, qty MT, port, Incoterm…)" rows={4} className="input" />
        <button className="btn btn-primary" type="submit">Log dry ginger outreach</button>
      </form>
    </div>
  );
}
