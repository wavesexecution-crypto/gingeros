"use client";

export function AiOpenButton({ label, className }: { label: string; className?: string }) {
  return (
    <button
      type="button"
      className={className ?? "btn btn-primary min-h-[44px]"}
      onClick={() => window.dispatchEvent(new CustomEvent("waves-ai-open"))}
    >
      {label}
    </button>
  );
}
