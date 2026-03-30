"use client";

import { useRouter } from "next/navigation";

export default function RefreshButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.refresh()}
      className="text-xs text-ink-muted hover:text-ink transition-colors"
    >
      ↺ Refresh
    </button>
  );
}
