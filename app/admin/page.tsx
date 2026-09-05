import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getDb, nowISO } from "@/lib/db";
import { providerHealth, emailProvider, aiProvider } from "@/lib/providers";
import { PRODUCTS, COUNTRIES, BUYER_TYPES, PIPELINE_STAGES, CURRENCIES, INCOTERMS } from "@/lib/config";
import { currentUser, authGate } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Waves-internal administration — the client (sales role) must never see this.
  const gate = await authGate("admin");
  if (!gate.ok) redirect("/");
  const db = getDb();
  const users = await db.prepare("SELECT id, email, name, role FROM users ORDER BY id").all() as Record<string, unknown>[];
  const sources = await db.prepare("SELECT source, COUNT(*) c FROM companies GROUP BY source ORDER BY c DESC").all() as Record<string, unknown>[];
  const health = providerHealth();
  let audit: Record<string, unknown>[] = [];
  try { audit = await db.prepare("SELECT * FROM ai_audit ORDER BY id DESC LIMIT 50").all() as Record<string, unknown>[]; } catch { audit = []; }

  async function addUser(form: FormData) {
    "use server";
    const me = await currentUser();
    if (!me || me.role !== "admin") return redirect("/");
    const email = String(form.get("email") ?? "").trim();
    const name = String(form.get("name") ?? "").trim() || email;
    const role = String(form.get("role") ?? "viewer");
    const password = String(form.get("password") ?? "");
    if (!email || !password) return;
    if (!["viewer", "sales", "admin"].includes(role)) return;
    const hash = await bcrypt.hash(password, 10);
    try {
      await getDb().prepare("INSERT INTO users(email,name,role,password_hash,created_at) VALUES(?,?,?,?,?)").run(email, name, role, hash, nowISO());
    } catch {}
    redirect("/admin");
  }

  return (
    <div className="space-y-4 max-w-[960px]">
      <div>
        <p className="eyebrow">Admin</p>
        <h1 className="h1">Configuration + users + providers</h1>
        <p className="muted">Secrets live in env only — never in the frontend. Admin seeded from ADMIN_EMAIL / ADMIN_PASSWORD.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card card-pad">
          <h2 className="h2">Business config</h2>
          <div className="muted mt-2 space-y-1 text-[13px]">
            <p>Products: {PRODUCTS.map((p) => ("name" in p ? String(p.name) : "")).filter(Boolean).join(", ") || "Dry Ginger"}</p>
            <p>Countries: {COUNTRIES.map((c) => c.name).join(", ")}</p>
            <p>Buyer types: {BUYER_TYPES.join(", ")}</p>
            <p>Pipeline stages: {PIPELINE_STAGES.join(", ")}</p>
            <p>Currencies: {CURRENCIES.join(", ")}</p>
            <p>Incoterms: {INCOTERMS.join(", ")}</p>
          </div>
        </div>
        <div className="card card-pad">
          <h2 className="h2">Provider status</h2>
          <div className="muted mt-2 space-y-1 text-[13px]">
            <p>AI: {health.ai.id} — {health.ai.status} ({aiProvider.label})</p>
            <p>Discovery: {health.discovery.map((d) => `${d.id} (${d.status})`).join(", ")}</p>
            <p>Email: {health.email.id} — {health.email.status} ({emailProvider.label})</p>
            <p>Email integration: not connected — abstraction ready, drafts save to timeline.</p>
            <p className="mt-2">{health.note}</p>
          </div>
          <h2 className="h2 mt-4">Data sources in DB</h2>
          <ul className="muted mt-1 text-[13px]">{sources.map((s) => <li key={String(s.source)}>{String(s.source) || "Unknown"}: {Number(s.c)}</li>)}</ul>
        </div>
      </div>
      <div className="card card-pad">
        <h2 className="h2">Users ({users.length})</h2>
        <div className="hidden md:block">
        <table className="table mt-3">
          <thead><tr><th>ID</th><th>Email</th><th>Name</th><th>Role</th></tr></thead>
          <tbody>{users.map((u) => <tr key={String(u.id)}><td>{String(u.id)}</td><td className="text-navy">{String(u.email)}</td><td>{String(u.name)}</td><td>{String(u.role)}</td></tr>)}</tbody>
        </table>
        </div>
        <div className="grid gap-2 md:hidden mt-3">
          {users.map((u) => (
            <div key={String(u.id)} className="border border-line rounded p-3 space-y-0.5">
              <p className="text-navy text-[13px] font-medium">#{String(u.id)} · {String(u.email)}</p>
              <p className="muted">{String(u.name)} · {String(u.role)}</p>
            </div>
          ))}
        </div>
        <form action={addUser} className="flex flex-wrap gap-2 mt-4">
          <input name="email" required type="email" placeholder="Email *" className="input w-full sm:!w-[220px]" />
          <input name="name" placeholder="Name" className="input w-full sm:!w-[160px]" />
          <input name="password" required type="password" placeholder="Password *" className="input w-full sm:!w-[160px]" />
          <select name="role" className="select" defaultValue="sales"><option value="viewer">viewer</option><option value="sales">sales</option><option value="admin">admin</option></select>
          <button className="btn btn-primary" type="submit">Add user</button>
        </form>
      </div>
      <div className="card card-pad">
        <h2 className="h2">Waves AI activity log ({audit.length})</h2>
        <p className="muted mt-1">Every AI write: request, tool, target, result, undo state. Reversible actions can be undone from the copilot (“undo that”).</p>
        {audit.length === 0 ? <p className="muted mt-2">No AI write actions yet.</p> : (
          <>
          <div className="hidden md:block">
          <table className="table mt-3">
            <thead><tr><th>ID</th><th>When</th><th>User</th><th>Request</th><th>Tool</th><th>Target</th><th>Result</th><th>Undone</th></tr></thead>
            <tbody>{audit.map((a) => <tr key={String(a.id)}><td>#{String(a.id)}</td><td className="muted">{String(a.created_at).slice(0, 16).replace("T", " ")}</td><td>{String(a.user_email)}</td><td className="muted">{String(a.user_request).slice(0, 60)}</td><td className="text-navy">{String(a.tool)}</td><td>{String(a.target).slice(0, 40)}</td><td className="muted">{String(a.result).slice(0, 80)}</td><td>{Number(a.undone) ? "Yes" : "No"}</td></tr>)}</tbody>
          </table>
          </div>
          <div className="grid gap-2 md:hidden mt-3">
            {audit.map((a) => (
              <div key={String(a.id)} className="border border-line rounded p-3 space-y-0.5">
                <p className="text-navy text-[13px] font-medium">#{String(a.id)} · {String(a.tool)} · {Number(a.undone) ? "Undone" : "Active"}</p>
                <p className="muted">{String(a.user_email)} · {String(a.created_at).slice(0, 16).replace("T", " ")}</p>
                <p className="text-[13px] text-navy">{String(a.user_request).slice(0, 80)}</p>
                <p className="muted">→ {String(a.target).slice(0, 60)}</p>
              </div>
            ))}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
