// WAVES AI copilot endpoint — chat + tool loop + confirmations + audit.
// POST {message, history, page, lastState, confirm[], mode}
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { actorFrom } from "@/lib/ai/permissions";
import { runCopilot } from "@/lib/ai/agent";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    message?: string; history?: { role: "user" | "assistant"; content: string }[];
    page?: { path: string; companyId?: number; market?: string; opportunityId?: number; companyName?: string; marketName?: string };
    lastState?: { ids?: number[]; filters?: Record<string, string> };
    confirm?: string[]; mode?: "auto" | "ollama" | "local";
  };
  const user = await currentUser();
  const actor = actorFrom(user);
  try {
    const out = await runCopilot(actor, {
      message: String(body.message ?? ""),
      history: Array.isArray(body.history) ? body.history.slice(-8) : [],
      page: body.page ?? { path: "/" },
      lastState: body.lastState ?? {},
      confirm: Array.isArray(body.confirm) ? body.confirm.slice(0, 25) : [],
      mode: body.mode === "local" || body.mode === "ollama" ? body.mode : "auto",
    });
    return NextResponse.json({ ...out, actor: { email: actor.email, role: actor.role } });
  } catch (e) {
    return NextResponse.json({ reply: `Copilot error: ${(e as Error).message}`, cards: [], actions: [], provider: "local" as const, lastState: body.lastState ?? {}, audits: [] }, { status: 500 });
  }
}
