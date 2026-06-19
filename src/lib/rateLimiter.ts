// Rate limiting utility using Vercel KV.
// Returns true if the request is allowed, false if rate limited.

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

const maxDailyRequests = 20;
const maxHourlyRequests = 5;

type RateLimitResult = {
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
      kvIncr(dailyKey, 86400),  // 24 hours
      kvIncr(hourlyKey, 3600),  // 1 hour
    ]);

    return {
      allowed: dailyUsed <= maxDailyRequests && hourlyUsed <= maxHourlyRequests,
      dailyUsed,
      hourlyUsed,
    };
  } catch {
    // If KV is down, allow the request rather than breaking the app.
    return { allowed: true, dailyUsed: 0, hourlyUsed: 0 };
  }
}

// --- Vercel KV REST helpers (zero-dependency, uses global fetch) ---

const kvToken = typeof process !== "undefined" ? process.env?.KV_REST_API_TOKEN : undefined;
const kvUrl = typeof process !== "undefined" ? process.env?.KV_REST_API_URL : undefined;

async function kvIncr(key: string, ttlSeconds: number): Promise<number> {
  if (!kvToken || !kvUrl) {
    return 0; // KV not configured — rate limiting disabled.
  }

  const response = await fetch(`${kvUrl.replace(/\/$/, "")}/incr/${key}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${kvToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`KV incr failed: ${response.status}`);
  }

  const body = (await response.json()) as { result: number };
  const count = body.result;

  // Set TTL on first write
  if (count === 1) {
    await fetch(`${kvUrl.replace(/\/$/, "")}/expire/${key}/${ttlSeconds}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${kvToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  return count;
}
