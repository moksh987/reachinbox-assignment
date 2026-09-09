import session from "express-session";
import RedisStore from "connect-redis";
import { redisConnection } from "./redis";
import { env } from "./env";

/**
 * Sessions live in Redis, not memory — consistent with the rest of the app's
 * philosophy (Postgres = source of truth, Redis = fast shared state). This
 * also means an Express restart doesn't log everyone out, which matters
 * during the restart-recovery demo.
 */
export const sessionMiddleware = session({
  store: new RedisStore({ client: redisConnection, prefix: "reachinbox:sess:" }),
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: "reachinbox.sid",
  cookie: {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
});
