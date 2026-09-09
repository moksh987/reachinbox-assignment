import type { EmailRecord } from "../types/email";
import { Badge } from "./Badge";
import { EmptyState } from "./EmptyState";

interface EmailTableProps {
  emails: EmailRecord[];
  mode: "scheduled" | "sent" | "search";
  emptyTitle: string;
  emptyDescription?: string;
}

function formatTime(value: string | null): string {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EmailTable({ emails, mode, emptyTitle, emptyDescription }: EmailTableProps) {
  if (emails.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const timeLabel = mode === "sent" ? "Sent time" : "Scheduled time";

  return (
    <div className="overflow-x-auto rounded-lg border border-wire">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-wire bg-wire/20 text-xs uppercase tracking-wide text-ink/50">
            <th className="px-4 py-3 font-medium">Recipient</th>
            <th className="px-4 py-3 font-medium">Subject</th>
            <th className="px-4 py-3 font-medium">{timeLabel}</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-wire">
          {emails.map((email, index) => (
            <tr key={email.id ?? index} className="text-ink">
              <td className="px-4 py-3 font-mono text-xs">{email.recipient}</td>
              <td className="px-4 py-3">{email.subject}</td>
              <td className="px-4 py-3 text-ink/60">
                {formatTime(mode === "sent" ? email.sentAt ?? email.scheduledAt : email.scheduledAt)}
              </td>
              <td className="px-4 py-3">
                <Badge status={email.status} />
                {email.status === "FAILED" && email.error && (
                  <span className="ml-2 text-xs text-red-600" title={email.error}>
                    {email.error.length > 40 ? `${email.error.slice(0, 40)}\u2026` : email.error}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
