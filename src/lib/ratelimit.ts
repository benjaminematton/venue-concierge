import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Per-IP sliding-window limit on the public /api/chat endpoint. The demo
// runs on free-tier Anthropic credits and a free-tier Upstash Redis; the
// cap is the cheapest way to keep a curious recruiter from draining either
// budget.
//
// When the Upstash env vars are absent (local dev or self-host), the
// limiter is a no-op. Production deploys should set them.

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const ratelimit =
  url && token
    ? new Ratelimit({
        redis: new Redis({ url, token }),
        limiter: Ratelimit.slidingWindow(30, "24 h"),
        analytics: true,
        prefix: "concierge",
      })
    : null;

export interface RateLimitDecision {
  allowed: boolean;
  // When denied, a Unix-ms timestamp the client can retry after.
  resetAt?: number;
  limit?: number;
}

export async function checkRateLimit(
  identifier: string,
): Promise<RateLimitDecision> {
  if (!ratelimit) return { allowed: true };
  const r = await ratelimit.limit(identifier);
  return {
    allowed: r.success,
    resetAt: r.reset,
    limit: r.limit,
  };
}

export function getClientIp(req: Request): string {
  // Vercel / Cloudflare / most proxies set x-forwarded-for with the
  // original client first, comma-separated. Trust the first hop.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "anonymous";
}
