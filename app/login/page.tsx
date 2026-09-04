import { redirect } from "next/navigation";
import { login, currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const me = await currentUser();
  if (me) redirect("/");
  const sp = await searchParams;
  async function doLogin(form: FormData) {
    "use server";
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) redirect("/login?error=missing");
    const u = await login(email, password);
    if (!u) redirect("/login?error=invalid");
    redirect("/");
  }
  const err = sp?.error;
  const errMsg =
    err === "invalid"
      ? "Invalid email or password."
      : err === "missing"
      ? "Email and password are required."
      : null;
  return (
    <div className="max-w-sm mx-auto w-full space-y-4">
      <div>
        <p className="eyebrow">Waves</p>
        <h1 className="h1">Dry Ginger International Sales OS</h1>
        <p className="muted mt-1">Sign in to continue. India → UAE · Middle East · Europe · South Africa.</p>
      </div>
      <form action={doLogin} className="card card-pad space-y-3">
        <input name="email" type="email" required placeholder="Email" autoComplete="email" className="input !w-full min-h-[44px]" />
        <input name="password" type="password" required placeholder="Password" autoComplete="current-password" className="input !w-full min-h-[44px]" />
        {errMsg && <p className="text-[13px] text-[#FF6B61] font-medium">{errMsg}</p>}
        <button className="btn btn-primary w-full min-h-[44px] justify-center" type="submit">Sign in</button>
      </form>
      <p className="muted text-[12px]">Access is restricted to authorised users. Contact Waves for account assistance.</p>
    </div>
  );
}
