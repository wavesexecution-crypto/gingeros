import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getDb, nowISO } from "@/lib/db";
import { GradeBadge, LabelBadge, StageBadge } from "@/components/ui";
import { aiProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

export default async function BuyerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const c = (await db.prepare("SELECT * FROM companies WHERE id=?").get(id)) as Record<string, unknown> | undefined;
  if (!c) return notFound();
  const contacts = await db.prepare("SELECT * FROM contacts WHERE company_id=?").all(id) as Record<string, unknown>[];
  const acts = await db.prepare("SELECT * FROM activities WHERE company_id=? ORDER BY created_at DESC LIMIT 30").all(id) as Record<string, unknown>[];
  const comms = await db.prepare("SELECT * FROM communications WHERE company_id=? ORDER BY created_at DESC LIMIT 20").all(id) as Record<string, unknown>[];
  const fups = await db.prepare("SELECT * FROM followups WHERE company_id=? ORDER BY due_date").all(id) as Record<string, unknown>[];
  const enqs = await db.prepare("SELECT * FROM enquiries WHERE company_id=? ORDER BY id DESC").all(id) as Record<string, unknown>[];
  const opps = await db.prepare("SELECT * FROM opportunities WHERE company_id=? ORDER BY id DESC").all(id) as Record<string, unknown>[];
  const quotes = await db.prepare("SELECT * FROM quotes WHERE company_id=? ORDER BY id DESC").all(id) as Record<string, unknown>[];
  const evid = await db.prepare("SELECT * FROM lead_evidence WHERE company_id=?").all(id) as Record<string, unknown>[];

  const signals: string[] = String(c.evidence ?? "").includes("Evidence not available") ? [] : String(c.evidence ?? "").replace(/^DEMO — /, "").split(";").map((s) => s.trim()).filter(Boolean);
  const brief = await aiProvider.whyContact({ company: { name: String(c.name), country: String(c.country), city: String(c.city), industry: String(c.industry), products: String(c.products), website: String(c.website) }, signals, evidence: String(c.evidence), grade: String(c.grade), score: Number(c.qual_score) });

  async function act(form: FormData) {
    "use server";
    const kind = String(form.get("kind") ?? "note");
    const title = String(form.get("title") ?? kind);
    const body = String(form.get("body") ?? "");
    const db2 = getDb();
    await db2.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(Number(id), kind, title, body, "Sales", nowISO());
    await db2.prepare("UPDATE companies SET last_activity=date('now') WHERE id=?").run(Number(id));
    redirect(`/buyers/${id}`);
  }

  return (
    <div className="space-y-4">
      <Link href="/buyers" className="muted underline">← Dry ginger buyers</Link>
      {/* Mobile-only quick actions — sticks above the AI button while scrolling */}
      <div className="md:hidden sticky bottom-[76px] z-10 card p-2 flex gap-2 shadow-lg">
        <Link href={`/ai?company=${id}`} className="btn btn-primary min-h-[44px] flex-1 justify-center items-center">Ask AI: research</Link>
        <Link href={`/ai?company=${id}&op=outreach`} className="btn min-h-[44px] flex-1 justify-center items-center">Ask AI: outreach</Link>
        <a href="#followup" className="btn min-h-[44px] flex-1 justify-center items-center">Follow up</a>
      </div>
      <div className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold text-navy">{String(c.name)}</h1>
            <p className="muted">{String(c.city)} · {String(c.country)} · {String(c.company_type)}</p>
            <div className="flex gap-2 mt-2 flex-wrap"><GradeBadge grade={String(c.grade)} score={Number(c.qual_score)} /><LabelBadge label={String(c.data_label)} /><StageBadge stage={String(c.buyer_status)} /><span className="badge badge-neutral">Fit: {String(c.ginger_fit)}</span></div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href={`/enquiries/new?company=${id}`} className="btn">+ Import enquiry (MT)</Link>
            <Link href={`/opportunities/new?company=${id}`} className="btn">+ Export opportunity</Link>
            <Link href={`/quotes/new?company=${id}`} className="btn btn-primary">+ Export quote (CIF/FOB)</Link>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="space-y-4 lg:col-span-2">
          <div className="card card-pad">
            <h2 className="h2">Importer profile — dry ginger fit & markets</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-[13px]">
              {[["Importer website", String(c.website)], ["Export market", String(c.country)], ["City", String(c.city)], ["Industry", String(c.industry)], ["Size", String(c.size)], ["Dry ginger products / specs", String(c.products)], ["Dry ginger import relevance", String(c.import_relevance)], ["Sales owner", String(c.owner)], ["Evidence source", `${String(c.source)} ${String(c.source_url)}`], ["Last verified", String(c.last_verified) || "Unverified"]].map(([k, v]) => (
                <div key={k} className="border border-line rounded p-2"><p className="muted text-[11px] uppercase">{k}</p><p className="text-navy">{v || "Unknown"}</p></div>
              ))}
            </div>
          </div>

          <div className="card card-pad">
            <h2 className="h2">Buying signals</h2>
            {signals.length === 0 ? <p className="muted mt-2">Evidence not available</p> : <ul className="list-disc ml-5 mt-2 text-[13px]">{signals.map((s) => <li key={s}>{s}</li>)}</ul>}
            <p className="muted mt-2">Source: {String(c.source)} · Discovered {String(c.date_discovered)} · Evidence: {String(c.evidence) || "Evidence not available"}</p>
            {evid.map((e) => <p key={String(e.id)} className="muted">· {String(e.source)} — {String(e.snippet)}</p>)}
          </div>

          <div className="card card-pad">
            <h2 className="h2">AI brief — why contact?</h2>
            <pre className="whitespace-pre-wrap text-[13px] text-body mt-2 font-sans">{brief}</pre>
            <div className="flex gap-2 mt-3"><Link href={`/ai?company=${id}`} className="btn">Open in AI assistant</Link></div>
          </div>

          <div className="card card-pad">
            <h2 className="h2">Activity timeline</h2>
            <div className="mt-3 space-y-2">
              {acts.length === 0 && <p className="muted">No activity yet.</p>}
              {acts.map((a) => (<div key={String(a.id)} className="border-l border-line pl-3"><p className="text-[13px] text-navy">{String(a.title)} <span className="muted">· {String(a.kind)} · {String(a.created_at).slice(0, 10)}</span></p><p className="muted">{String(a.body).slice(0, 200)}</p></div>))}
              {comms.map((m) => (<div key={`m${String(m.id)}`} className="border-l border-accent/40 pl-3"><p className="text-[13px] text-navy">{String(m.channel)} — {String(m.subject)} <span className="muted">· {String(m.created_at).slice(0, 10)}</span></p></div>))}
            </div>
            <form action={act} className="flex flex-wrap gap-2 mt-4">
              <select name="kind" className="select"><option value="note">Note</option><option value="call">Call</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="linkedin">LinkedIn</option><option value="meeting">Meeting</option></select>
              <input name="title" placeholder="Title" className="input !w-[200px]" required />
              <input name="body" placeholder="Details" className="input !w-[280px]" />
              <button className="btn" type="submit">Log</button>
            </form>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card card-pad">
            <h2 className="h2">Contacts</h2>
            <div className="space-y-2 mt-2">
              {contacts.length === 0 && <p className="muted">No contacts — find procurement / import / owner. Unknown until verified.</p>}
              {contacts.map((p) => (<div key={String(p.id)} className="border border-line rounded p-2"><p className="text-navy text-[13px] font-medium">{String(p.name)} {Number(p.is_dm) ? "· DM" : ""}</p><p className="muted">{String(p.role)} · {String(p.dept)} · {String(p.confidence)}</p><p className="muted">✉ {String(p.email)} · ☎ {String(p.phone)}</p></div>))}
            </div>
            <AddContact id={id} />
          </div>
          <div id="followup" className="card card-pad scroll-mt-24">
            <h2 className="h2">Follow-ups</h2>
            <div className="space-y-2 mt-2">{fups.map((f) => (<div key={String(f.id)} className="border border-line rounded p-2 text-[13px]"><p className="text-navy">{String(f.title)}</p><p className="muted">Due {String(f.due_date)} · {Number(f.done) ? "Done" : "Open"}</p></div>))}{fups.length === 0 && <p className="muted">No follow-ups. Every active buyer needs a next action.</p>}</div>
            <AddFollowup id={id} />
          </div>
          <div className="card card-pad">
            <h2 className="h2">Opportunity / Enquiries / Quotes</h2>
            <div className="muted text-[13px] mt-2 space-y-1">
              {opps.map((o) => <p key={String(o.id)}>OPP #{String(o.id)} · {String(o.stage)} · {Number(o.value).toLocaleString()} {String(o.currency)} · {String(o.next_action).slice(0, 60)}</p>)}
              {enqs.map((e) => <p key={String(e.id)}>ENQ #{String(e.id)} · {String(e.status)} · {String(e.qty)} → {String(e.destination)}</p>)}
              {quotes.map((qq) => <p key={String(qq.id)}>Q #{String(qq.id)} · {String(qq.status)} · {String(qq.qty)} @ {String(qq.unit_price)} {String(qq.currency)} {String(qq.incoterm)}</p>)}
              {opps.length + enqs.length + quotes.length === 0 && <p>None yet.</p>}
            </div>
          </div>
          <MoveStage id={id} current={String(c.buyer_status)} outreach={String(c.outreach_status)} />
        </div>
      </div>
    </div>
  );
}

function AddContact({ id }: { id: string }) {
  async function add(f: FormData) {
    "use server";
    const db = getDb();
    await db.prepare("INSERT INTO contacts(company_id,name,role,dept,email,phone,linkedin,confidence,is_dm,notes) VALUES(?,?,?,?,?,?,?,?,?,?)").run(Number(id), String(f.get("name") ?? ""), String(f.get("role") ?? ""), String(f.get("dept") ?? ""), String(f.get("email") ?? "Unknown") || "Unknown", String(f.get("phone") ?? "Unknown") || "Unknown", String(f.get("linkedin") ?? ""), "Unverified", f.get("is_dm") ? 1 : 0, "");
    await db.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(Number(id), "system", "Contact added", String(f.get("name")), "Sales", nowISO());
    redirect(`/buyers/${id}`);
  }
  return <form action={add} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3"><input name="name" required placeholder="Name *" className="input col-span-2" /><input name="role" placeholder="Role (Procurement…)" className="input" /><input name="dept" placeholder="Dept" className="input" /><input name="email" placeholder="Email or Unknown" className="input" /><input name="phone" placeholder="Phone or Unknown" className="input" /><label className="muted text-[12px] flex items-center gap-1 col-span-2"><input type="checkbox" name="is_dm" /> Decision maker</label><button className="btn col-span-2 min-h-[44px] justify-center" type="submit">Add contact</button></form>;
}
function AddFollowup({ id }: { id: string }) {
  async function add(f: FormData) {
    "use server";
    const db = getDb();
    await db.prepare("INSERT INTO followups(company_id,title,due_date,done,owner,notes,created_at) VALUES(?,?,?,?,?,?,?)").run(Number(id), String(f.get("title") ?? "Follow up"), String(f.get("due") ?? new Date().toISOString().slice(0, 10)), 0, "Sales", "", nowISO());
    redirect(`/buyers/${id}`);
  }
  return <form action={add} className="flex flex-wrap gap-2 mt-3"><input name="title" required placeholder="Next action" className="input min-h-[44px]" /><input name="due" type="date" className="input !w-[150px] min-h-[44px]" /><button className="btn min-h-[44px]" type="submit">Add</button></form>;
}
function MoveStage({ id, current, outreach }: { id: string; current: string; outreach: string }) {
  async function move(f: FormData) {
    "use server";
    const db = getDb();
    const s = String(f.get("stage") ?? current), o = String(f.get("outreach") ?? outreach);
    await db.prepare("UPDATE companies SET buyer_status=?, outreach_status=?, last_activity=date('now') WHERE id=?").run(s, o, Number(id));
    await db.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(Number(id), "system", `Stage → ${s} / ${o}`, "", "Sales", nowISO());
    redirect(`/buyers/${id}`);
  }
  const stages = ["Discovered","Qualified","Researching","Contacted","Responded","Interested","Enquiry","Quotation Sent","Negotiation","Won","Lost","Not Relevant"];
  const outs = ["Not contacted","Contacted","Follow-up 1","Follow-up 2","Responded","Interested","Not interested","No response"];
  return <form action={move} className="card card-pad"><h2 className="h2">Move pipeline</h2><div className="grid gap-2 mt-2"><select name="stage" defaultValue={current} className="select">{stages.map((s) => <option key={s}>{s}</option>)}</select><select name="outreach" defaultValue={outreach} className="select">{outs.map((s) => <option key={s}>{s}</option>)}</select><button className="btn btn-primary" type="submit">Update</button></div></form>;
}
