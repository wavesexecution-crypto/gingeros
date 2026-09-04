import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, nowISO } from "@/lib/db";
import { Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

interface Fup { id: number; title: string; due_date: string; owner: string; company_id: number; cname: string }

function Row({ f }: { f: Fup }) {
  async function done() {
    "use server";
    const db = getDb();
    db.prepare("UPDATE followups SET done=1 WHERE id=?").run(f.id);
    db.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(
      f.company_id, "system", `Follow-up done — ${f.title}`, "", "Sales", nowISO());
    redirect("/followups");
  }
  return (
    <div className="card card-pad p-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-navy text-[13px] font-medium">{f.title}</p>
        <p className="muted"><Link href={`/buyers/${f.company_id}`} className="underline decoration-line underline-offset-4 min-h-[44px] inline-flex items-center">{f.cname}</Link> · due {f.due_date} · {f.owner || "Unassigned owner"}</p>
      </div>
      <form action={done}><button className="btn min-h-[44px] w-full sm:w-auto justify-center" type="submit">Mark buyer follow-up done</button></form>
    </div>
  );
}

function Section({ title, items, hint }: { title: string; items: Fup[]; hint: string }) {
  return (
    <div className="card card-pad">
      <h2 className="h2">{title} ({items.length})</h2>
      <div className="space-y-2 mt-3">
        {items.length === 0 ? <p className="muted">{hint}</p> : items.map((f) => <Row key={f.id} f={f} />)}
      </div>
    </div>
  );
}

export default async function Followups() {
  const db = getDb();
  const sel = "SELECT f.id,f.title,f.due_date,f.owner,f.company_id,c.name cname FROM followups f JOIN companies c ON c.id=f.company_id WHERE f.done=0";
  const overdue = db.prepare(`${sel} AND f.due_date < date('now') ORDER BY f.due_date`).all() as unknown as Fup[];
  const today = db.prepare(`${sel} AND f.due_date = date('now') ORDER BY f.id`).all() as unknown as Fup[];
  const upcoming = db.prepare(`${sel} AND f.due_date > date('now') ORDER BY f.due_date LIMIT 100`).all() as unknown as Fup[];
  const companies = db.prepare("SELECT id,name FROM companies ORDER BY name").all() as unknown as { id: number; name: string }[];

  async function add(form: FormData) {
    "use server";
    const company_id = Number(form.get("company_id"));
    const title = String(form.get("title") ?? "").trim();
    const due = String(form.get("due") ?? "");
    if (!company_id || !title || !due) return;
    const db2 = getDb();
    db2.prepare("INSERT INTO followups(company_id,title,due_date,done,owner,notes,created_at) VALUES(?,?,?,?,?,?,?)").run(
      company_id, title, due, 0, String(form.get("owner") ?? "Sales"), "", nowISO());
    db2.prepare("INSERT INTO activities(company_id,kind,title,body,owner,created_at) VALUES(?,?,?,?,?,?)").run(
      company_id, "system", `Follow-up set — ${title} (due ${due})`, "", "Sales", nowISO());
    redirect("/followups");
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow">Export execution · dry ginger buyer follow-ups</p>
        <h1 className="h1">Buyer follow-ups</h1>
        <p className="muted">{overdue.length} overdue buyer follow-ups · {today.length} due today · {upcoming.length} upcoming</p>
      </div>
      {overdue.length === 0 && today.length === 0 && upcoming.length === 0 && <Empty title="No open buyer follow-ups — export pipeline clear" hint="Every active dry ginger importer needs a next action with date + owner." />}
      <Section title="Overdue buyer follow-ups" items={overdue} hint="No overdue dry ginger buyer follow-ups. Good." />
      <Section title="Due today — buyer actions" items={today} hint="Nothing due today." />
      <Section title="Upcoming buyer follow-ups" items={upcoming} hint="Nothing scheduled." />
      <form action={add} className="card card-pad max-w-[720px]">
        <h2 className="h2">Add buyer follow-up</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          <select name="company_id" className="select" required><option value="">Select buyer * — UAE / ME / EU / ZAF importer</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <input name="title" required placeholder="Next action * (e.g. send CIF Jebel Ali quote — 5 MT dry ginger)" className="input" />
          <input name="due" type="date" required className="input" />
          <input name="owner" placeholder="Owner (e.g. export manager — default Sales)" className="input" />
        </div>
        <button className="btn btn-primary mt-3" type="submit">Add buyer follow-up</button>
      </form>
    </div>
  );
}
