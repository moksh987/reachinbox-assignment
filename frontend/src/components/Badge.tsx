import type { EmailStatus } from "../types/email";

const styles: Record<EmailStatus, string> = {
  SCHEDULED: "bg-slate-100 text-slate-600",
  PROCESSING: "bg-amber/10 text-amber",
  SENT: "bg-emerald-50 text-emerald-700",
  FAILED: "bg-red-50 text-red-700",
  RATE_LIMITED: "bg-amber/10 text-amber",
};

const labels: Record<EmailStatus, string> = {
  SCHEDULED: "scheduled",
  PROCESSING: "sending",
  SENT: "sent",
  FAILED: "failed",
  RATE_LIMITED: "rate limited",
};

export function Badge({ status }: { status: EmailStatus }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 font-mono text-xs ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
