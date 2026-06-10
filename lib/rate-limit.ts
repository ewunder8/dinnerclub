// Simple in-memory fixed-window rate limiter.
// Note: per serverless instance — counters are not shared across instances and
// reset on cold start. Good enough to stop casual abuse at hobby scale.

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/**
 * Returns true if the request is allowed, false if rate-limited.
 * @param key   unique key, e.g. `places-search:${userId}`
 * @param limit max requests per window
 * @param windowMs window length in ms (default 60s)
 */
export function rateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();

  // Opportunistic cleanup of expired windows to bound memory
  if (windows.size > 1000) {
    windows.forEach((w, k) => {
      if (w.resetAt <= now) windows.delete(k);
    });
  }

  const window = windows.get(key);
  if (!window || window.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (window.count >= limit) return false;

  window.count += 1;
  return true;
}
