export type EmailStatus = "SCHEDULED" | "PROCESSING" | "SENT" | "FAILED" | "RATE_LIMITED";

export interface EmailRecord {
  id: string;
  campaignId: string;
  userId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt: string | null;
  status: EmailStatus;
  sender: string | null;
  error: string | null;
  createdAt: string;
}

export interface EmailCampaign {
  id: string;
  userId: string;
  subject: string;
  body: string;
  startTime: string;
  delaySeconds: number;
  hourlyLimit: number;
  createdAt: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  slackConnected: boolean;
}

export interface ScheduleEmailsPayload {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delaySeconds: number;
  hourlyLimit: number;
  sender?: string;
}
