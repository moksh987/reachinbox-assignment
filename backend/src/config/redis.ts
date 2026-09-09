import IORedis from "ioredis";
import { env } from "./env";

// BullMQ requires maxRetriesPerRequest to be null on the connection it manages.
// We reuse this single connection across the queue, worker, and rate limiter
// so restarts / reconnects are consistent everywhere.
export const redisConnection = new IORedis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
});

redisConnection.on("connect", () => {
  console.log(`[redis] connected to ${env.REDIS_HOST}:${env.REDIS_PORT}`);
});

redisConnection.on("error", (err) => {
  console.error("[redis] connection error", err);
});
