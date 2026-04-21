/**
 * Simple in-memory rate limiter for API routes.
 * For production scale, consider @upstash/ratelimit with Redis.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 60_000);

interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  limit: 10,
  windowSeconds: 60,
};

const AI_CONFIG: RateLimitConfig = {
  limit: 5,
  windowSeconds: 60,
};

/**
 * Check rate limit for a given identifier (usually IP or user ID).
 * Returns { success, remaining, resetAt } or throws Response with 429.
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const key = `${identifier}`;
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, {
      count: 1,
      resetAt: now + config.windowSeconds * 1000,
    });
    return { success: true, remaining: config.limit - 1, resetAt: now + config.windowSeconds * 1000 };
  }

  if (entry.count >= config.limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { success: true, remaining: config.limit - entry.count, resetAt: entry.resetAt };
}

/**
 * Enforce rate limit — returns a 429 Response if exceeded, or null if OK.
 * Usage in route handlers:
 *   const limited = enforceRateLimit(request);
 *   if (limited) return limited;
 */
export function enforceRateLimit(
  request: Request,
  config: RateLimitConfig = DEFAULT_CONFIG,
): Response | null {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const result = checkRateLimit(ip, config);

  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
        },
      },
    );
  }

  return null;
}

/**
 * Stricter rate limit for AI/expensive endpoints.
 */
export function enforceAiRateLimit(request: Request): Response | null {
  return enforceRateLimit(request, AI_CONFIG);
}
