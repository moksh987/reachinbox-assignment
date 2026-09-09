# ReachInbox Assignment

Scheduled bulk-email platform: React dashboard, Express + PostgreSQL API,
BullMQ + Redis scheduler/worker, Ethereal SMTP sender, Elasticsearch search,
Google + Slack OAuth.

## Status at a glance

| Phase | What it is | Status |
|---|---|---|
| 1 | Backend foundation (Express, TS, Prisma schema, Redis, Docker, `/health`) | ✅ Done |
| 2 | BullMQ queue + worker | ✅ Done |
| 3 | Ethereal sending | ✅ Done |
| 4 | Database + idempotency | ✅ Done |
| 5 | Rate limiting | ✅ Done |
| 6 | Elasticsearch search | ✅ Done |
| 7 | Google OAuth | ✅ Done |
| 8 | React dashboard | ✅ Done |
| 9 | Slack OAuth | ✅ Done |
| 10 | Bull Board + polish | ✅ Done |

**All 10 phases are implemented end to end** — Google-authenticated
dashboard, CSV-driven scheduling, BullMQ-backed delayed sends with
restart-safe persistence, Redis-backed per-sender rate limiting with Slack
notifications on breach, Elasticsearch search, and a live Bull Board queue
view. See [Quick start](#quick-start) to run it and
[Demo script](#demo-script) for how to walk through the requirements.

---

## What's built

### Phase 1 — Backend foundation
- `docker-compose.yml` — Postgres, Redis, Elasticsearch, each with healthchecks.
- `backend/src/config/env.ts` — typed env access with sane dev defaults.
- `backend/src/config/redis.ts` — shared ioredis connection (`maxRetriesPerRequest: null`, required by BullMQ).
- `backend/src/lib/prisma.ts` — Prisma client singleton (survives ts-node-dev hot reloads).
- `backend/prisma/schema.prisma` — `User`, `EmailCampaign`, `Email` models; `EmailStatus` enum (`SCHEDULED`, `PROCESSING`, `SENT`, `FAILED`, `RATE_LIMITED`).
- `backend/src/server.ts` — Express app, `GET /health` (checks Postgres + Redis).

### Phase 2 — BullMQ queue + worker
- `backend/src/queues/email.queue.ts` — the `email-queue` Queue, plus:
  - `enqueueEmail(emailId, scheduledAt)` — initial schedule. Uses the email's own UUID as the BullMQ `jobId`, so a duplicate API call can't double-schedule the same email (BullMQ no-ops on a duplicate id).
  - `requeueRateLimitedEmail(emailId, scheduledAt)` — used only when Phase 5's rate limiter defers an email (see the subtlety note below on why this uses a *different* id).
- `backend/src/queues/email.worker.ts` — a separate process (`npm run worker:dev` / `start:worker`) that:
  1. loads the email from Postgres,
  2. skips it if already `SENT` (idempotency),
  3. checks the Phase 5 rate limiter before touching SMTP,
  4. sends via Ethereal, updates status, indexes into Elasticsearch, and (Phase 9) notifies Slack if it hit the rate limit.
- Runs **as its own process**, deliberately separate from Express — this is what makes the restart-recovery demo meaningful (Redis/Postgres survive even if Express or the worker crashes).

### Phase 3 — Ethereal sending
- `backend/src/lib/smtp.ts` — Nodemailer transporter configured from `SMTP_*` env vars. Wired into the worker's send step.

### Phase 4 — Database + idempotency
- `backend/src/services/email.service.ts` — `scheduleEmails()` creates one `EmailCampaign` + N `Email` rows in a single Prisma transaction, then enqueues a job and indexes each row.
- Worker checks `email.status === "SENT"` before sending — this, not the BullMQ `jobId`, is the actual "never send twice" guarantee (see the [known limitation](#known-limitation-exactly-once-delivery) below).

### Phase 5 — Rate limiting
- `backend/src/services/rate-limit.service.ts` — `tryConsumeRateLimit(sender, at, limit)` does an atomic Redis `INCR` + one-time `EXPIRE` per `sender:hour` bucket. This is deliberately **not** an in-memory counter, since multiple worker processes need to share one count.
- When a send exceeds the limit, the worker marks the email `RATE_LIMITED`, reschedules it to `nextHourBoundary()`, and (Phase 9) sends a real Slack message — jobs are deferred, never dropped.

### Phase 6 — Elasticsearch
- `backend/src/lib/elasticsearch.ts` — client + `ensureEmailIndex()` (creates the `emails` index on boot if missing).
- `backend/src/services/elasticsearch.service.ts` — `indexEmail()` (best-effort, never blocks the send pipeline on failure) and `searchEmails(userId, query)` (multi-match over recipient/subject/body, scoped to the requesting user).
- `GET /api/emails/search?q=...` exposes it. Postgres remains the source of truth — losing the ES index loses search, not data.
- Search results carry `id` (pulled from `hit._id`, since Elasticsearch doesn't store it in `_source`) but not every field on the full `Email` record — `campaignId`, `error`, and `createdAt` were never indexed (see `indexEmail`). The frontend's search view is intentionally a lighter-weight table than the full scheduled/sent views for this reason.

### Phase 7 — Google OAuth
- `backend/src/config/passport.ts` — `passport-google-oauth20` strategy; upserts a `User` by `googleId` on login, storing `name`/`email`/`avatar`.
- `backend/src/config/session.ts` — `express-session` backed by Redis (`connect-redis`), so sessions survive an Express restart the same way BullMQ jobs survive a worker restart.
- `backend/src/routes/auth.routes.ts` — `GET /auth/google`, `GET /auth/google/callback`, `GET /api/auth/me`, `POST /api/auth/logout`.
- `backend/src/middleware/auth.middleware.ts` — `requireAuth` checks `req.isAuthenticated()`; this fully replaced the old dev-header stub, which no longer exists anywhere in the app.

### Phase 8 — React dashboard
- `frontend/` — Vite + React + Tailwind, `react-router-dom` for routing.
- `src/pages/Login.tsx` — "Continue with Google" (full-page redirect to `/auth/google`), surfaces `?error=google` from a failed callback.
- `src/pages/Dashboard.tsx` — Scheduled/Sent tabs (polling every 4s so status changes from the worker show up live), a search box wired to `GET /api/emails/search`, and the compose flow.
- `src/components/`: `Header` (user info, Slack connect/disconnect, logout), `EmailTable` (shared by scheduled/sent/search views), `ComposeModal` (subject/body, CSV upload via Papa Parse with live "N email addresses detected", start time/delay/hourly-limit inputs), `Loading`, `EmptyState`, plus the earlier `Button`/`Input`/`Modal`/`Badge`/`Toast` primitives.
- `src/services/api.ts` — fetch wrapper with `credentials: "include"` so the session cookie from Google OAuth rides along on every request.
- `src/App.tsx` — bootstraps auth via `GET /api/auth/me` on load, then routes between `/login` and `/dashboard` accordingly.

### Phase 9 — Slack OAuth
- `backend/src/lib/slackClient.ts` + `backend/src/controllers/slack.controller.ts` — `GET /auth/slack` (`requireAuth`, so it links to the already-logged-in Google user), `GET /auth/slack/callback` (exchanges the code, saves `slackAccessToken`/`slackTeamId` on that `User`), `POST /api/slack/disconnect`, `GET /api/slack/status`.
- `backend/src/services/slack.service.ts` — `notifyRateLimitReached()` now makes a real `chat.postMessage` call via `@slack/web-api` using the user's stored token; this fully replaced the old `console.log` stub.
- The callback round-trips the user id through OAuth `state` rather than relying solely on the session cookie being present on Slack's redirect back — see the comment in `slack.controller.ts`.

### Phase 10 — Bull Board + polish
- `backend/src/config/bullBoard.ts` — `@bull-board/express` + `@bull-board/api`, mounted at `/admin/queues` in `server.ts`, pointed at the `email-queue` Queue. Shows waiting/delayed/active/completed/failed counts and lets you inspect individual jobs.
- Centralized error handler in `server.ts`; controllers stay free of try/catch via `lib/asyncHandler.ts`.

### API surface
```
GET  /auth/google
GET  /auth/google/callback
GET  /api/auth/me
POST /api/auth/logout

GET  /auth/slack
GET  /auth/slack/callback
POST /api/slack/disconnect
GET  /api/slack/status

POST /api/emails/schedule      { subject, body, recipients[], startTime, delaySeconds, hourlyLimit, sender? }
GET  /api/emails/scheduled
GET  /api/emails/sent
GET  /api/emails/search?q=...
GET  /api/emails/:id

GET  /health
GET  /admin/queues             (Bull Board UI)
```
All `/api/*` routes (other than `/api/auth/me`) require a logged-in session — log in via `/auth/google` first.

---

## Quick start

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Backend
cd backend
npm install
cp .env.example .env
# Fill in GOOGLE_CLIENT_ID/SECRET, SLACK_CLIENT_ID/SECRET, and SMTP_* (see below).
npx prisma generate
npx prisma migrate dev --name init
npm run dev            # terminal 1 - Express API
npm run worker:dev     # terminal 2 - email worker (kept separate on purpose, see restart test)

# 3. Frontend
cd ../frontend
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:5000
npm run dev            # terminal 3 - http://localhost:5173
```

**Getting credentials for the OAuth/SMTP env vars:**
- **Google OAuth** — [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth client ID (Web application). Authorized redirect URI: `http://localhost:5000/auth/google/callback` (matches `GOOGLE_CALLBACK_URL`).
- **Slack OAuth** — [api.slack.com/apps](https://api.slack.com/apps) → create an app → OAuth & Permissions → add the `chat:write` and `im:write` scopes → redirect URL `http://localhost:5000/auth/slack/callback` (matches `SLACK_REDIRECT_URI`).
- **Ethereal** — generate a throwaway inbox at [ethereal.email](https://ethereal.email/create) and drop the host/port/user/password into `SMTP_*`.

```bash
curl http://localhost:5000/health
# { "ok": true, "postgres": "ok", "redis": "ok" }
```

Then open `http://localhost:5173`, sign in with Google, and use the
dashboard directly — see [Demo script](#demo-script) for a suggested walkthrough.

## Demo script

1. **Google login** — sign in, header shows your name/email/avatar.
2. **Connect Slack** — click "Connect Slack" in the header, authorize.
3. **Compose** — click "+ Compose New Email", fill subject/body, upload a
   `leads.csv` (one `email` column), watch "N email addresses detected".
   Set delay = 2s, hourly limit = 2, schedule 5 recipients.
4. **Scheduled tab** — see the rows land as `scheduled`; open
   `http://localhost:5000/admin/queues` in another tab to watch
   waiting/delayed counts on the `email-queue`.
5. **Restart test** — schedule a fresh email a minute or two out. Stop the
   worker process (Ctrl+C in its terminal). Redis keeps running. Wait, then
   restart with `npm run worker:dev` — it reconnects and resumes the
   existing delayed job, and the email still sends on schedule.
6. **Rate limit + Slack** — with hourly limit = 2 and 5 recipients from
   step 3: the first 2 move to `sent`, the rest get marked `rate limited`
   and rescheduled to the next hour, and a Slack message lands in the
   channel/DM tied to your connected workspace.
7. **Sent tab + Ethereal** — check the sent rows, then open the Ethereal
   inbox link (printed by Nodemailer, or via ethereal.email) to see the
   actual emails.
8. **Search** — search by recipient/subject/word-from-body and show the
   Elasticsearch-backed results.

---

## Architecture

```
React UI --REST (session cookie)--> Express+TS Backend --> PostgreSQL (source of truth)
                                            |
                                            +--> Elasticsearch (search index)
                                            |
                                            +--> Passport (Google OAuth, session in Redis)
                                            |
                                            +--> Redis (BullMQ delayed queue + rate-limit counters)
                                                      |
                                                      v
                                                Email Worker (concurrency = N, own process)
                                                      |
                                    +-----------------+-----------------+
                                    v                 v                 v
                              Ethereal SMTP      PostgreSQL      Slack (chat.postMessage)

Bull Board (/admin/queues) reads the same Redis-backed email-queue for a live view.
```

**Scheduling:** each recipient is persisted in PostgreSQL and represented by
a unique BullMQ job, added with a delay calculated from its scheduled send
time (computed up front in `scheduler.service.ts`, not via worker sleeps —
this decouples the minimum-delay guarantee from worker concurrency).

**Persistence:** Redis persists BullMQ's delayed/waiting jobs; PostgreSQL
stores the authoritative email state. On worker restart, BullMQ resumes
existing jobs rather than recreating the schedule. Sessions live in Redis
too, so an Express restart doesn't log anyone out mid-demo.

**Idempotency:** each email's UUID is reused as the initial BullMQ `jobId`.
The worker checks the persisted status before sending and skips anything
already `SENT`.

**Rate limiting:** Redis-backed atomic per-sender-per-hour counters (not an
in-memory counter, since the worker may run as multiple processes). A
breach triggers a real Slack notification via the connected user's OAuth
token, not a log line.

**Search:** Elasticsearch indexes each email on write; Postgres remains the
source of truth, so losing the ES index loses search, not data.

### A subtlety worth knowing: rate-limit reschedule jobId

The original schedule uses the email's own UUID as the BullMQ `jobId`, so a
duplicate API call can never double-schedule the same email. When the worker
defers an email for hitting the rate limit, though, it re-enqueues it under
a **different** id (`${emailId}:retry:${timestamp}`) rather than reusing
`emailId` — the original job is still active/completing at that exact
moment, so reusing its id there would be racy. The real "never send an
already-sent email twice" guarantee comes from the `status === "SENT"` check
in the worker against Postgres, not from jobId reuse — that check is what
actually matters across retries, crashes, and this reschedule path alike.

### Known limitation: exactly-once delivery

If the worker sends an email via SMTP successfully but crashes *before* the
DB update to `SENT` lands, a retry will see `status != "SENT"` and resend.
The unique-`jobId` + DB-status-check design minimizes duplicate risk but
doesn't make it impossible — true exactly-once delivery to an external
provider isn't guaranteed by a DB check alone. Worth saying explicitly in
an interview rather than claiming "exactly once" outright.

---

## Repo layout

```
reachinbox-assignment/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts
│   │   │   ├── redis.ts
│   │   │   ├── session.ts        (Phase 7 - Redis-backed express-session)
│   │   │   ├── passport.ts       (Phase 7 - Google OAuth strategy)
│   │   │   └── bullBoard.ts      (Phase 10 - /admin/queues)
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── email.controller.ts
│   │   │   └── slack.controller.ts
│   │   ├── lib/
│   │   │   ├── asyncHandler.ts
│   │   │   ├── elasticsearch.ts
│   │   │   ├── prisma.ts
│   │   │   ├── smtp.ts
│   │   │   └── slackClient.ts
│   │   ├── middleware/
│   │   │   └── auth.middleware.ts      (session-based requireAuth)
│   │   ├── queues/
│   │   │   ├── email.queue.ts
│   │   │   └── email.worker.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── email.routes.ts
│   │   │   └── slack.routes.ts
│   │   ├── services/
│   │   │   ├── email.service.ts
│   │   │   ├── elasticsearch.service.ts
│   │   │   ├── rate-limit.service.ts
│   │   │   ├── scheduler.service.ts
│   │   │   └── slack.service.ts        (real chat.postMessage)
│   │   ├── types/
│   │   │   └── express.d.ts
│   │   └── server.ts
│   ├── prisma/schema.prisma
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Badge.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── ComposeModal.tsx
│   │   │   ├── EmailTable.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Loading.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Toast.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   └── Dashboard.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── types/
│   │   │   └── email.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   └── .env.example
└── docker-compose.yml   Postgres + Redis + Elasticsearch
```

## Tech stack

| Requirement | Choice |
|---|---|
| Backend | Express + TypeScript |
| ORM | Prisma |
| DB | PostgreSQL |
| Queue | BullMQ |
| Queue storage | Redis |
| SMTP | Ethereal + Nodemailer |
| Search | Elasticsearch |
| Frontend | React + Vite |
| Styling | Tailwind |
| Auth | Google OAuth (Passport, session in Redis) |
| Slack | Slack OAuth + `@slack/web-api` |
| Queue UI | Bull Board |
| CSV | Papa Parse |
| Containers | Docker Compose |

