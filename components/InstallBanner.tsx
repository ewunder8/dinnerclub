"use client";

import { useState, useEffect } from "react";

export default function InstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("install-banner-dismissed");
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    if (!standalone && !dismissed) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem("install-banner-dismissed", "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="bg-slate text-white px-4 py-3 flex items-center gap-3">
      <span className="text-xl shrink-0">📲</span>
      <p className="text-sm flex-1 leading-snug">
        Add <strong>dinnerclub</strong> to your home screen — tap the share icon and select{" "}
        <em>Add to Home Screen</em>.
      </p>
      <button
        onClick={dismiss}
        className="text-white/50 hover:text-white text-lg leading-none shrink-0 px-1"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
