export function GradeBadge({ grade, score }: { grade: string; score: number }) {
  const c = grade === "A" ? "badge-a" : grade === "B" ? "badge-b" : "badge-c";
  return <span className={`badge ${c}`}>{grade} · {score}/100</span>;
}
export function LabelBadge({ label }: { label: string }) {
  const map: Record<string, string> = {
    DEMO: "badge-demo",
    VERIFIED: "badge-verified",
    UNVERIFIED: "badge-unverified",
    IMPORTED: "badge-neutral",
    MANUAL: "badge-neutral",
  };
  return <span className={`badge ${map[label] ?? "badge-neutral"}`}>{label}</span>;
}
export function StageBadge({ stage }: { stage: string }) {
  const c = stage === "Won" ? "badge-won" : stage === "Lost" ? "badge-lost" : "badge-neutral";
  return <span className={`badge ${c}`}>{stage}</span>;
}
export function Empty({ title, hint }: { title: string; hint?: string }) {
  return <div className="card card-pad text-center py-10"><p className="text-navy font-semibold text-[13px] tracking-wide uppercase">{title}</p>{hint && <p className="muted mt-1">{hint}</p>}</div>;
}
