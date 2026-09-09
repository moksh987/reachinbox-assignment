import { useState, type FormEvent } from "react";
import Papa from "papaparse";
import { Modal } from "./Modal";
import { Input, Textarea } from "./Input";
import { Button } from "./Button";
import { emailApi, ApiError } from "../services/api";
import type { ScheduleEmailsPayload } from "../types/email";

interface ComposeModalProps {
  onClose: () => void;
  onScheduled: (recipientCount: number) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function defaultStartTime(): string {
  // datetime-local input value, defaulted to 2 minutes from now (local time,
  // no seconds) so a fresh compose is ready for the restart-test demo.
  const d = new Date(Date.now() + 2 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ComposeModal({ onClose, onScheduled }: ComposeModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [csvError, setCsvError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(defaultStartTime());
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setFileName(file.name);
    setCsvError(null);
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (results) => {
        const found = new Set<string>();
        for (const row of results.data) {
          for (const cell of row) {
            const trimmed = typeof cell === "string" ? cell.trim() : "";
            if (EMAIL_REGEX.test(trimmed)) found.add(trimmed);
          }
        }
        if (found.size === 0) {
          setCsvError("No email addresses found in that file.");
        }
        setRecipients([...found]);
      },
      error: () => setCsvError("Couldn't parse that CSV."),
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (recipients.length === 0) {
      setError("Upload a CSV with at least one email address.");
      return;
    }

    const payload: ScheduleEmailsPayload = {
      subject,
      body,
      recipients,
      startTime: new Date(startTime).toISOString(),
      delaySeconds,
      hourlyLimit,
    };

    setSubmitting(true);
    try {
      await emailApi.schedule(payload);
      onScheduled(recipients.length);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to schedule emails.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Compose new email" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          placeholder="Quick intro"
        />

        <Textarea
          label="Body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={5}
          placeholder="Write the email body…"
        />

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Recipients (CSV)</span>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              className="block w-full cursor-pointer rounded-md border border-wire bg-white px-3 py-2 text-sm text-ink file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-wire/60 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink"
            />
          </div>
          {fileName && !csvError && (
            <p className="mt-1 text-xs text-ink/60">
              {fileName} · {recipients.length} email address{recipients.length === 1 ? "" : "es"} detected
            </p>
          )}
          {csvError && <p className="mt-1 text-xs text-red-600">{csvError}</p>}
        </label>

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Start time"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
          <Input
            label="Delay (seconds)"
            type="number"
            min={0}
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(Number(e.target.value))}
          />
          <Input
            label="Hourly limit"
            type="number"
            min={1}
            value={hourlyLimit}
            onChange={(e) => setHourlyLimit(Number(e.target.value))}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Scheduling\u2026" : "Schedule"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
