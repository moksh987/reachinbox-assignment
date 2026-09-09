import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { redisConnection } from "./config/redis";
import { ensureEmailIndex } from "./lib/elasticsearch";
import { sessionMiddleware } from "./config/session";
import { passport } from "./config/passport";
import { bullBoardRouter } from "./config/bullBoard";
import { emailRoutes } from "./routes/email.routes";
import { authRoutes, apiAuthRoutes } from "./routes/auth.routes";
import { slackAuthRoutes, apiSlackRoutes } from "./routes/slack.routes";

const app = express();
app.set("trust proxy", 1);

app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());

// Sessions before passport, passport before any route that reads req.user.
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// Phase 1: proves Postgres + Redis are reachable from the API process. This
// is the basis of the restart-recovery story (Postgres/Redis survive Express
// restarts; BullMQ jobs resume from Redis; sessions resume too, since they
// also live in Redis - see config/session.ts).
app.get("/health", async (_req, res) => {
  const status: {
    ok: boolean;
    postgres: "ok" | "error";
    redis: "ok" | "error";
  } = { ok: true, postgres: "ok", redis: "ok" };

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    status.postgres = "error";
    status.ok = false;
  }

  try {
    await redisConnection.ping();
  } catch (err) {
    status.redis = "error";
    status.ok = false;
  }

  res.status(status.ok ? 200 : 503).json(status);
});

// OAuth (Phase 7 + 9) - top-level, not under /api, matching the routes the
// frontend's "Continue with Google" / "Connect Slack" links point at.
app.use("/auth/google", authRoutes);
app.use("/auth/slack", slackAuthRoutes);

app.use("/api/auth", apiAuthRoutes);
app.use("/api/slack", apiSlackRoutes);
app.use("/api/emails", emailRoutes);

// Phase 10: live view of the email queue (waiting/delayed/active/completed/failed).
app.use("/admin/queues", bullBoardRouter);

// Centralized error handler - keeps controllers free of try/catch boilerplate
// (see lib/asyncHandler.ts, which funnels rejected promises here via next(err)).
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[error]", err);
  res.status(500).json({ error: "internal server error" });
});

ensureEmailIndex().catch((err) => {
  console.error("[elasticsearch] failed to ensure index - search will be degraded until ES is reachable", err);
});

app.listen(env.PORT, () => {
  console.log(`[server] listening on http://localhost:${env.PORT}`);
  console.log(`[server] Bull Board available at http://localhost:${env.PORT}/admin/queues`);
});
