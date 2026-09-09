import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { emailQueue } from "../queues/email.queue";

/**
 * Mounted at /admin/queues in server.ts. Shows live waiting/delayed/active/
 * completed/failed counts for the email queue - handy for the restart and
 * rate-limit demos (Phase 10), and for debugging without querying Redis by
 * hand. This is a read/write admin surface with no auth of its own, so it's
 * fine for local dev/demo but shouldn't be exposed like this in production
 * without putting requireAuth (or IP allowlisting) in front of it.
 */
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(emailQueue) as any],
  serverAdapter,
});

export const bullBoardRouter = serverAdapter.getRouter();
