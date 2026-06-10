import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Merge Tailwind classes cleanly — use this everywhere instead of template literals
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generate a random invite token — crypto-strong, ~82 bits of entropy.
// Uses Web Crypto so it works in both browser and server runtimes.
export function generateInviteToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const out: string[] = [];
  const buf = new Uint8Array(32);
  while (out.length < 16) {
    crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length; i++) {
      const byte = buf[i];
      // Rejection sampling to avoid modulo bias (252 = 36 * 7)
      if (byte < 252 && out.length < 16) out.push(chars[byte % 36]);
    }
  }
  return out.join("");
}

// Calculate invite link expiry (30 days from now)
export function getInviteExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  return expiry;
}

// Check if an invite link is expired
export function isInviteExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

// Format invite expiry as a readable date: "Valid until May 5"
export function getInviteExpiryLabel(expiresAt: string): string {
  return new Date(expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

// Format date for display
export function formatDinnerDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// Format time for display
export function formatDinnerTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// Get user initials for avatar
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Truncate text
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "…";
}
