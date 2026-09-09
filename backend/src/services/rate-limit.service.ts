import { redisConnection } from "../config/redis";
import { env } from "../config/env";

function hourBucket(date: Date): string {
  // YYYY-MM-DDTHH — one bucket per sender per calendar hour (UTC).
  return date.toISOString().slice(0, 13);
}

function rateLimitKey(sender: string, date: Date): string {
  return `email-rate-limit:${sender}:${hourBucket(date)}`;
}

/**
 * Atomically increments the per-sender-per-hour counter in Redis and reports
 * whether this send is still under the limit.
 *
 * This is intentionally NOT an in-memory counter (`let emailsSent = 0`) —
 * with multiple worker processes/instances each would keep its own count,
 * so the limit wouldn't actually be enforced globally. INCR is atomic across
 * any number of Redis clients, so every worker sees the same count.
 *
 * EXPIRE is only set on the first increment of a given hour bucket, so the
 * key self-cleans an hour after it's created without needing a cron job.
 */
export async function tryConsumeRateLimit(
  sender: string,
  at: Date = new Date(),
  limit: number = env.MAX_EMAILS_PER_HOUR
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const key = rateLimitKey(sender, at);
  const count = await redisConnection.incr(key);
  if (count === 1) {
    await redisConnection.expire(key, 3600);
  }
  return { allowed: count <= limit, count, limit };
}

/** Start of the next hour after `date` — where a rate-limited email gets rescheduled to. */
export function nextHourBoundary(date: Date): Date {
  const next = new Date(date);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return next;
}
