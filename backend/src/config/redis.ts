import IORedis from "ioredis";
import { env } from "./env";

// BullMQ requires maxRetriesPerRequest to be null on the connection it manages.
// Use REDIS_URL in production (Upstash) and REDIS_HOST/REDIS_PORT locally.
export const redisConnection = env.REDIS_URL
  ? new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    })
  : new IORedis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      maxRetriesPerRequest: null,
    });

redisConnection.on("connect", () => {
  console.log("[redis] connected");
});

redisConnection.on("error", (err) => {
  console.error("[redis] connection error", err);
});