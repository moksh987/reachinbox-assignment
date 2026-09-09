import { Worker, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { transporter } from "../lib/smtp";
import {
  EMAIL_QUEUE_NAME,
  EmailJobData,
  requeueRateLimitedEmail,
} from "./email.queue";
import {
  tryConsumeRateLimit,
  nextHourBoundary,
} from "../services/rate-limit.service";
import { indexEmail } from "../services/elasticsearch.service";
import { notifyRateLimitReached } from "../services/slack.service";

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailId } = job.data;

  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: {
      campaign: {
        select: { hourlyLimit: true },
      },
    },
  });

  if (!email) {
    console.warn(
      `[worker] email ${emailId} not found in DB — skipping (job ${job.id})`
    );
    return;
  }

  // Idempotency guard: if BullMQ ever redelivers this job (crash-then-retry,
  // at-least-once delivery, etc.), the DB status — not the jobId — is what
  // stops a second send.
  if (email.status === "SENT") {
    console.log(
      `[worker] email ${emailId} already SENT — skipping duplicate delivery`
    );
    return;
  }

  const sender = email.sender ?? env.SMTP_USER;

  // Use the hourly limit configured for this campaign.
  // Check the rate limit BEFORE marking PROCESSING or touching SMTP.
  const { allowed, count, limit } = await tryConsumeRateLimit(
    sender,
    new Date(),
    email.campaign.hourlyLimit
  );

  if (!allowed) {
    const rescheduledAt = nextHourBoundary(new Date());

    const updated = await prisma.email.update({
      where: { id: emailId },
      data: {
        status: "RATE_LIMITED",
        scheduledAt: rescheduledAt,
      },
    });

    await indexEmail(updated);

    const owner = await prisma.user.findUnique({
      where: { id: email.userId },
      select: {
        slackAccessToken: true,
        slackUserId: true,
      },
    });

    if (owner) {
      await notifyRateLimitReached(owner, sender, limit);
    }

    // Deferred, not dropped — re-enters the queue for the next hour window.
    await requeueRateLimitedEmail(emailId, rescheduledAt);

    console.log(
      `[worker] rate limit hit for "${sender}" (${count}/${limit}) — ` +
        `rescheduled ${emailId} to ${rescheduledAt.toISOString()}`
    );

    return;
  }

  await prisma.email.update({
    where: { id: emailId },
    data: { status: "PROCESSING" },
  });

  try {
    await transporter.sendMail({
      from: sender,
      to: email.recipient,
      subject: email.subject,
      text: email.body,
    });

    const sent = await prisma.email.update({
      where: { id: emailId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        error: null,
      },
    });

    await indexEmail(sent);

    console.log(
      `[worker] sent email ${emailId} -> ${email.recipient}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    const failed = await prisma.email.update({
      where: { id: emailId },
      data: {
        status: "FAILED",
        error: message,
      },
    });

    await indexEmail(failed);

    console.error(
      `[worker] failed to send email ${emailId}`,
      err
    );

    // Re-throw so BullMQ applies its retry/backoff policy.
    // Note on exactly-once: if the SMTP send actually succeeded but the
    // process crashed before the SENT update landed, a retry would still see
    // status=FAILED (not SENT) and resend. True exactly-once delivery to an
    // external provider isn't guaranteed by a DB check alone — see README.
    throw err;
  }
}

export const emailWorker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  processEmailJob,
  {
    connection: redisConnection,
    concurrency: env.WORKER_CONCURRENCY,
  }
);

emailWorker.on("completed", (job) =>
  console.log(`[worker] job ${job.id} completed`)
);

emailWorker.on("failed", (job, err) =>
  console.error(
    `[worker] job ${job?.id} failed:`,
    err.message
  )
);

emailWorker.on("error", (err) =>
  console.error("[worker] worker-level error", err)
);

console.log(
  `[worker] started — concurrency=${env.WORKER_CONCURRENCY}, queue=${EMAIL_QUEUE_NAME}`
);
