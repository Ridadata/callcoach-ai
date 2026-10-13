import "server-only";

// Simple fixed-window rate limiter kept in memory.
// Best-effort only: on serverless platforms (Vercel) each function instance has its
// own memory and is recycled after a while, so a determined client can get more
// requests than the limit. It is enough to stop accidental loops and casual abuse
// of the Gemini quota; a shared store (e.g. Redis) would be needed for strict limits.

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();
const MAX_TRACKED_KEYS = 5_000;

export const RATE_LIMITS = {
  chat: { limit: 30, windowMs: 10 * 60_000 },
  evaluate: { limit: 5, windowMs: 10 * 60_000 },
  log: { limit: 10, windowMs: 10 * 60_000 },
} as const;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

function pruneExpired(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/** Counts one request for this client in the given bucket. */
export function rateLimit(bucket: RateLimitBucket, clientKey: string, now = Date.now()): RateLimitResult {
  const { limit, windowMs } = RATE_LIMITS[bucket];
  const key = `${bucket}:${clientKey}`;
  if (windows.size >= MAX_TRACKED_KEYS) pruneExpired(now);

  const window = windows.get(key);
  if (!window || window.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (window.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((window.resetAt - now) / 1000) };
  }
  window.count++;
  return { ok: true };
}

/** Client IP as seen behind Vercel's proxy (first x-forwarded-for entry). */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

/** 429 response with a French message and a Retry-After header. */
export function rateLimitResponse(retryAfterSec: number, what: string): Response {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return Response.json(
    { error: `Tu as atteint la limite ${what} pour le moment. Réessaie dans ${minutes} min.` },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}
