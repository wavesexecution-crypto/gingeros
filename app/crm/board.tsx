"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface Card {
  id: number;
  name: string;
  country: string;
  grade: string;
  score: number;
  value: number;
}

export default function Board({ initial, stages }: { initial: Record<string, Card[]>; stages: string[] }) {
  const [data, setData] = useState(initial);
  const [drag, setDrag] = useState<{ id: number; from: string } | null>(null);
  const [mStage, setMStage] = useState(0);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function drop(to: string) {
    if (!drag || drag.from === to) return;
    const card = data[drag.from]?.find((c) => c.id === drag.id);
    if (!card) return;
    setData((d) => ({
      ...d,
      [drag.from]: d[drag.from].filter((c) => c.id !== drag.id),
      [to]: [...(d[to] ?? []), card],
    }));
    setDrag(null);
    try {
      const r = await fetch("/api/companies/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: drag.id, stage: to }),
      });
      if (!r.ok) throw new Error(await r.text());
      router.refresh();
    } catch (e) {
      setErr(`Move failed — ${(e as Error).message}. Refresh to resync.`);
    }
  }

  function CardView({ c, from }: { c: Card; from: string }) {
    return (
      <div
        draggable
        onDragStart={() => setDrag({ id: c.id, from })}
        className="border border-line rounded-[2px] p-2 bg-white cursor-grab active:cursor-grabbing"
      >
        <Link href={`/buyers/${c.id}`} className="text-navy text-[13px] font-medium underline decoration-line underline-offset-4 min-h-[44px] inline-flex items-center">
          {c.name}
        </Link>
        <p className="muted mt-0.5">{c.country} · Grade {c.grade} · {c.score}/100</p>
        <p className="muted">{c.value > 0 ? `Open dry ginger value: ${c.value.toLocaleString()}` : "No open dry ginger enquiries"}</p>
      </div>
    );
  }

  const prev = () => setMStage((i) => (i - 1 + stages.length) % stages.length);
  const next = () => setMStage((i) => (i + 1) % stages.length);
  const cur = stages[mStage] ?? stages[0];

  return (
    <div>
      {err && <p className="card card-pad text-[13px] text-danger mb-3">{err}</p>}
      {/* Mobile: one stage column at a time with selector + prev/next */}
      <div className="md:hidden space-y-2">
        <div className="flex gap-2">
          <button type="button" onClick={prev} aria-label="Previous stage" className="btn min-h-[44px] px-4 shrink-0">‹</button>
          <select
            aria-label="Dry ginger buyer stage"
            value={cur}
            onChange={(e) => setMStage(Math.max(0, stages.indexOf(e.target.value)))}
            className="select min-h-[44px] flex-1"
          >
            {stages.map((s) => (
              <option key={s} value={s}>{s} ({data[s]?.length ?? 0})</option>
            ))}
          </select>
          <button type="button" onClick={next} aria-label="Next stage" className="btn min-h-[44px] px-4 shrink-0">›</button>
        </div>
        <div className="card">
          <div className="px-3 py-2 border-b border-line flex justify-between items-center">
            <p className="text-[11px] font-semibold text-navy uppercase tracking-[0.08em]">{cur}</p>
            <span className="badge badge-neutral">{data[cur]?.length ?? 0}</span>
          </div>
          <div className="p-2 space-y-2">
            {(data[cur] ?? []).map((c) => (
              <CardView key={c.id} c={c} from={cur} />
            ))}
            {(data[cur] ?? []).length === 0 && <p className="muted px-1 py-3 text-center">No dry ginger buyers in this stage</p>}
          </div>
        </div>
      </div>
      {/* Desktop kanban — unchanged */}
      <div className="hidden md:flex gap-3 overflow-auto pb-4 scroll-thin">
        {stages.map((s) => (
          <div
            key={s}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop(s)}
            className="w-[240px] shrink-0 card"
          >
            <div className="px-3 py-2 border-b border-line flex justify-between items-center">
              <p className="text-[11px] font-semibold text-navy uppercase tracking-[0.08em]">{s}</p>
              <span className="badge badge-neutral">{data[s]?.length ?? 0}</span>
            </div>
            <div className="p-2 space-y-2 min-h-[80px]">
              {(data[s] ?? []).map((c) => (
                <CardView key={c.id} c={c} from={s} />
              ))}
              {(data[s] ?? []).length === 0 && <p className="muted px-1 py-3 text-center">Drop dry ginger buyer here</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
