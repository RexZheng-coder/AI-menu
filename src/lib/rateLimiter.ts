// Rate limiting utility using Upstash Redis (via REST API).
// Returns true if the request is allowed, false if rate limited.
//
// To enable:
//   Set KV_REST_API_URL and KV_REST_API_TOKEN in Vercel environment variables.
//   These are provided when you create an Upstash Redis DB from the Vercel marketplace.

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

const maxDailyRequests = 20;
const maxHourlyRequests = 5;

export type RateLimitResult = {
  allowed: boolean;
  dailyUsed: number;
  hourlyUsed: number;
};

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  const today = new Date().toISOString().slice(0, 10); // "2026-06-19"
  const hour = today + "-" + new Date().getHours().toString().padStart(2, "0"); // "2026-06-19-14"

  const dailyKey = `rate_limit:${ip}:${today}`;
  const hourlyKey = `rate_limit:${ip}:${hour}`;

  try {
    const [dailyUsed, hourlyUsed] = await Promise.all([
      redisIncr(dailyKey, 86400),  // 24 hours
      redisIncr(hourlyKey, 3600),  // 1 hour
    ]);

    return {
      allowed: dailyUsed <= maxDailyRequests && hourlyUsed <= maxHourlyRequests,
      dailyUsed,
      hourlyUsed,
    };
  } catch {
    // If Redis is unavailable, allow the request rather than breaking the app.
    return { allowed: true, dailyUsed: 0, hourlyUsed: 0 };
  }
}

// --- Upstash Redis REST helpers (zero dependencies) ---

const redisToken =
  typeof process !== "undefined" ? process.env?.KV_REST_API_TOKEN : undefined;
const redisUrl =
  typeof process !== "undefined" ? process.env?.KV_REST_API_URL : undefined;

async function redisIncr(key: string, ttlSeconds: number): Promise<number> {
  if (!redisToken || !redisUrl) {
    return 0; // Redis not configured — rate limiting disabled.
  }

  const base = redisUrl.replace(/\/+$/, "");

  const response = await fetch(`${base}/incr/${key}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${redisToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Redis incr failed: ${response.status}`);
  }

  const body = (await response.json()) as { result: string };
  // Upstash returns result as a string like "1"
  const count = Number(body.result);

  // Set TTL on first write — subsequent INCR calls won't reset it
  if (count === 1) {
    await fetch(`${base}/expire/${key}/${ttlSeconds}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${redisToken}`,
      },
    });
  }

  return count;
}
