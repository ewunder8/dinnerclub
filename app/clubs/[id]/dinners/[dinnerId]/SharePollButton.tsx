"use client";

import ShareButton from "./ShareButton";

export default function SharePollButton({ dinnerLabel }: { dinnerLabel: string }) {
  const url = typeof window !== "undefined" ? window.location.href : "";
  return (
    <ShareButton
      label="Share poll"
      message={`Vote on where we're eating — ${dinnerLabel}`}
      url={url}
    />
  );
}
