import type { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { scheduleEmails, listScheduled, listSent } from "../services/email.service";
import { searchEmails } from "../services/elasticsearch.service";

export async function scheduleEmailsHandler(req: Request, res: Response): Promise<void> {
  const { subject, body, recipients, startTime, delaySeconds, hourlyLimit, sender } = req.body ?? {};

  if (!subject || !body || !Array.isArray(recipients) || recipients.length === 0 || !startTime) {
    res.status(400).json({
      error: "subject, body, recipients (non-empty string[]), and startTime are required",
    });
    return;
  }

  const user = req.user!;

  const { campaign, emails } = await scheduleEmails({
    userId: user.id,
    sender: sender ?? user.email,
    subject,
    body,
    recipients,
    startTime: new Date(startTime),
    delaySeconds: Number(delaySeconds ?? 2),
    hourlyLimit: Number(hourlyLimit ?? 100),
  });

  res.status(201).json({ campaign, emails });
}

export async function listScheduledHandler(req: Request, res: Response): Promise<void> {
  const emails = await listScheduled(req.user!.id);
  res.json({ emails });
}

export async function listSentHandler(req: Request, res: Response): Promise<void> {
  const emails = await listSent(req.user!.id);
  res.json({ emails });
}

export async function searchEmailsHandler(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? "").trim();
  if (!q) {
    res.status(400).json({ error: "q query param is required" });
    return;
  }
  const results = await searchEmails(req.user!.id, q);
  res.json({ results });
}

export async function getEmailHandler(req: Request, res: Response): Promise<void> {
  const email = await prisma.email.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
  });
  if (!email) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({ email });
}
