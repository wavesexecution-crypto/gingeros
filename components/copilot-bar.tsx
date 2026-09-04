"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Card { title: string; meta: string; href: string }
interface Action { token: string; tool: string; summary: string; target: string; count: number }
interface Msg { role: "user" | "ai"; text: string; cards?: Card[]; actions?: Action[] }

const SUGGESTIONS: [RegExp, string[]][] = [
  [/^\/buyers\/\d+/, ["Research this buyer", "Qualify this buyer", "Draft outreach for this buyer", "Create a follow-up for tomorrow"]],
  [/^\/buyers/, ["A-grade UAE importers", "Interested European buyers", "Stalled buyers 7+ days"]],
  [/^\/countries/, ["Top buyers here", "Compare this market", "Show active opportunities"]],
  [/^\/markets/, ["Which market should I focus on?", "Compare UAE vs Europe"]],
  [/^\/crm|^\/opportunities/, ["What's stalled?", "Opportunities above $10000", "What needs attention today?"]],
  [/^\/followups/, ["Show overdue follow-ups", "What do I need to do tomorrow?"]],
  [/^\/$/, ["Today's sales brief", "A-grade UAE importers", "Which market should I focus on?", "Show overdue follow-ups"]],
];

const EXAMPLES = ["Find high priority UAE buyers", "Show my overdue follow-ups", "Which market has the strongest pipeline?", "Show opportunities above $10,000"];

function suggestionsFor(path: string): string[] {
  for (const [re, s] of SUGGESTIONS) if (re.test(path)) return s;
  return ["Today's sales brief", "Research this company", "Create a follow-up for tomorrow"];
}

export function CopilotBar() {
  const path = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [lastState, setLastState] = useState<{ ids?: number[]; filters?: Record<string, string> }>({});
  const [history, setHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);

  useEffect(() => {
    const openAi = () => setOpen(true);
    window.addEventListener("waves-ai-open", openAi);
    return () => window.removeEventListener("waves-ai-open", openAi);
  }, []);

  function pageCtx() {
    const m = path.match(/^\/buyers\/(\d+)/);
    const mc = path.match(/^\/countries\/([A-Z]{2})/);
    return {
      path,
      companyId: m ? Number(m[1]) : search.get("company") && /^\d+$/.test(search.get("company")!) ? Number(search.get("company")) : undefined,
      market: mc ? mc[1] : search.get("market") ?? undefined,
    };
  }

  async function send(text: string, confirm?: string[]) {
    const msg = text.trim();
    if ((!msg && !confirm?.length) || busy) return;
    setBusy(true);
    if (msg) setMsgs((p) => [...p, { role: "user", text: msg }]);
    setInput("");
    try {
      const r = await fetch("/api/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: msg, history: history.slice(-8), page: pageCtx(), lastState, confirm: confirm ?? [] }),
      });
      const j = (await r.json()) as { reply: string; cards: Card[]; actions: Action[]; provider: string; lastState: { ids?: number[] }; audits: number[] };
      setMsgs((p) => [...p, { role: "ai", text: j.reply, cards: j.cards ?? [], actions: j.actions ?? [] }]);
      if (j.lastState) setLastState(j.lastState);
      if (msg) setHistory((h) => [...h, { role: "user" as const, content: msg }, { role: "assistant" as const, content: j.reply }].slice(-8));
    } catch {
      setMsgs((p) => [...p, { role: "ai", text: "Copilot unreachable. Check the server and retry." }]);
    } finally {
      setBusy(false);
    }
  }

  function confirmAll(actions: Action[]) { send("", actions.map((a) => a.token)); }

  useEffect(() => {
    function onAsk(e: Event) {
      const d = (e as CustomEvent).detail;
      const text: string =
        typeof d === "string" ? d : String(d?.message ?? d?.text ?? "");
      setOpen(true);
      if (text.trim()) {
        setInput(text);
        void send(text);
      }
    }
    window.addEventListener("waves-ai-ask", onAsk);
    return () => window.removeEventListener("waves-ai-ask", onAsk);
  });

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[420px] sm:max-h-[76vh] w-full card rounded-none sm:!rounded-[4px] shadow-xl flex flex-col max-h-[100dvh]">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-navy2">Waves AI · Sales Copilot</p>
              <p className="muted !text-[12px]">Reads run instantly · writes ask first · never sends</p>
            </div>
            <div className="flex gap-1.5">
              <button className="btn !py-1 !text-[11px]" onClick={() => send("Give me today's sales brief.")}>Today&apos;s Brief</button>
              <button className="btn !py-1 !text-[11px]" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-3 min-h-[180px]">
            {msgs.length === 0 && (
              <div>
                <p className="muted mb-2">Operate the sales OS by talking. Try:</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestionsFor(path).map((s) => (
                    <button key={s} className="btn !py-1 !text-[11px] !normal-case !tracking-normal !font-normal" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted mb-1">{m.role === "user" ? "You" : "Waves AI"}</p>
                <pre className={`whitespace-pre-wrap font-sans text-[13px] leading-relaxed rounded-[3px] p-2.5 border ${m.role === "user" ? "bg-panel2 border-line text-navy inline-block text-left" : "bg-white border-line text-navy"}`}>{m.text}</pre>
                {!!m.cards?.length && (
                  <div className="mt-1.5 space-y-1">
                    {m.cards.map((c) => (
                      <Link key={c.href + c.title} href={c.href} className="flex items-center justify-between gap-2 border border-line rounded-[2px] px-2.5 py-1.5 bg-white">
                        <span><span className="block text-[13px] font-medium text-navy">{c.title}</span><span className="muted !text-[12px]">{c.meta}</span></span>
                        <span className="btn !py-0.5 !text-[11px]">Open</span>
                      </Link>
                    ))}
                  </div>
                )}
                {!!m.actions?.length && (
                  <div className="mt-1.5 border border-accent/60 rounded-[3px] p-2.5 bg-white">
                    {m.actions.map((a) => (
                      <div key={a.token} className="text-[13px] mb-1.5">
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Action · needs confirmation</p>
                        <p className="text-navy font-medium">{a.summary}</p>
                        <p className="muted">Target: {a.target}{a.count > 1 ? ` · Records: ${a.count}` : ""}</p>
                      </div>
                    ))}
                    <div className="flex gap-1.5 mt-2">
                      <button className="btn btn-primary !py-1 !text-[11px]" onClick={() => confirmAll(m.actions!)}>Confirm</button>
                      <button className="btn !py-1 !text-[11px]" onClick={() => setMsgs((p) => [...p, { role: "ai", text: "Cancelled — nothing changed." }])}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {busy && <p className="muted">Working…</p>}
          </div>
          <form className="p-2.5 border-t border-line flex gap-1.5" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Waves AI anything or tell it what to do…" className="input min-h-[44px]" />
            <button className="btn btn-primary min-h-[44px]" type="submit">Ask</button>
          </form>
          <div className="px-2.5 pb-2 flex gap-1.5 overflow-auto scroll-thin">
            {EXAMPLES.map((s) => (
              <button key={s} onClick={() => send(s)} className="muted underline underline-offset-4 whitespace-nowrap !text-[11px]">{s}</button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
