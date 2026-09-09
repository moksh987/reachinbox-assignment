import { prisma } from "../lib/prisma";
import { enqueueEmail } from "../queues/email.queue";
import { computeScheduledTimes } from "./scheduler.service";
import { indexEmail } from "./elasticsearch.service";

export interface ScheduleEmailsInput {
  userId: string;
  sender: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: Date;
  delaySeconds: number;
  hourlyLimit: number;
}

export async function scheduleEmails(input: ScheduleEmailsInput) {
  const { userId, sender, subject, body, recipients, startTime, delaySeconds, hourlyLimit } = input;

  const scheduledTimes = computeScheduledTimes(startTime, recipients.length, delaySeconds);

  const campaign = await prisma.emailCampaign.create({
    data: { userId, subject, body, startTime, delaySeconds, hourlyLimit },
  });

  // One transaction for all rows: either the whole campaign's emails land in
  // Postgres (the source of truth) or none do — we never enqueue jobs for
  // rows that didn't actually get committed.
  const emails = await prisma.$transaction(
    recipients.map((recipient, i) =>
      prisma.email.create({
        data: {
          campaignId: campaign.id,
          userId,
          recipient,
          subject,
          body,
          sender,
          scheduledAt: scheduledTimes[i],
        },
      })
    )
  );

  for (const email of emails) {
    await enqueueEmail(email.id, email.scheduledAt);
    await indexEmail(email);
  }

  return { campaign, emails };
}

export function listScheduled(userId: string) {
  return prisma.email.findMany({
    where: { userId, status: { in: ["SCHEDULED", "PROCESSING"] } },
    orderBy: { scheduledAt: "asc" },
  });
}

export function listSent(userId: string) {
  return prisma.email.findMany({
    where: { userId, status: { in: ["SENT", "FAILED", "RATE_LIMITED"] } },
    orderBy: { scheduledAt: "desc" },
  });
}
