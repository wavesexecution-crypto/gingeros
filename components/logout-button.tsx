"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton({
  variant = "dark",
  compact = false,
}: {
  variant?: "light" | "dark";
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const cls =
    variant === "light"
      ? "text-[12px] text-white/70 underline underline-offset-4 hover:text-white"
      : compact
      ? "btn min-h-[44px] min-w-[44px] justify-center !px-3"
      : "btn";
  async function onClick() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label="Sign out"
      className={cls}
    >
      {busy ? "Signing out…" : compact ? "Sign out" : "Sign out"}
    </button>
  );
}