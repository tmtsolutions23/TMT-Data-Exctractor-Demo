import { LRUCache } from "lru-cache";
import { NextResponse } from "next/server";

// Rate limiting: 10 requests per minute per IP
const rateLimitCache = new LRUCache<string, number>({
  max: 500,
  ttl: 60_000,
});

// Daily quota: 100 requests per day per IP
const dailyQuotaCache = new LRUCache<string, number>({
  max: 500,
  ttl: 86_400_000,
});

// Note: On Vercel, x-real-ip is set by the edge and is not spoofable.
// x-forwarded-for is used as a fallback only.
export function getClientIP(headers: Headers): string {
  return headers.get("x-real-ip") ?? "unknown";
}

export function checkRateLimit(ip: string): NextResponse | null {
  // Increment both counters first so daily quota always advances
  const minuteCount = (rateLimitCache.get(ip) ?? 0) + 1;
  rateLimitCache.set(ip, minuteCount);

  const dailyCount = (dailyQuotaCache.get(ip) ?? 0) + 1;
  dailyQuotaCache.set(ip, dailyCount);

  if (minuteCount > 10) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again in a minute." },
      { status: 429 }
    );
  }

  if (dailyCount > 100) {
    return NextResponse.json(
      { error: "Daily quota exceeded. Please try again tomorrow." },
      { status: 429 }
    );
  }

  return null;
}
