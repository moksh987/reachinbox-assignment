import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export const EMAIL_QUEUE_NAME = "email-queue";

export interface EmailJobData {
  emailId: string;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 5000,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

/**
 * Schedules the initial send for an email. The email's own UUID is reused as
 * the BullMQ jobId, so calling this twice for the same email (e.g. a retried
 * API request) never creates a second job — BullMQ treats a duplicate jobId
 * as a no-op rather than throwing.
 */
export async function enqueueEmail(emailId: string, scheduledAt: Date): Promise<void> {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  await emailQueue.add("send-email", { emailId }, { jobId: emailId, delay });
}

/**
 * Re-enqueues an email that was deferred because its sender hit the hourly
 * rate limit.
 *
 * This deliberately does NOT reuse `emailId` as the jobId. The call happens
 * from inside the worker while the *original* job (jobId = emailId) is still
 * active and completing — adding another job with that same id at that
 * moment would be ambiguous with BullMQ's dedupe-by-id behavior. The actual
 * "never send twice" guarantee comes from the DB status check in the worker,
 * not from jobId reuse, so a distinct id here is safe.
 */
export async function requeueRateLimitedEmail(emailId: string, scheduledAt: Date): Promise<void> {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  await emailQueue.add(
    "send-email",
    { emailId },
    { jobId: `${emailId}:retry:${scheduledAt.getTime()}`, delay }
  );
}
