import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import type { CurrentUser, EmailRecord } from "../types/email";
import { emailApi } from "../services/api";
import { Header } from "../components/Header";
import { Button } from "../components/Button";
import { EmailTable } from "../components/EmailTable";
import { Loading } from "../components/Loading";
import { ComposeModal } from "../components/ComposeModal";
import { useToast } from "../components/Toast";

type Tab = "scheduled" | "sent";

const POLL_INTERVAL_MS = 4000;

interface DashboardProps {
  user: CurrentUser;
  onUserChange: (user: CurrentUser | null) => void;
}

export function Dashboard({ user, onUserChange }: DashboardProps) {
  const [params, setParams] = useSearchParams();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("scheduled");
  const [scheduled, setScheduled] = useState<EmailRecord[]>([]);
  const [sent, setSent] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<EmailRecord[] | null>(null);
  const [searching, setSearching] = useState(false);

  const notifiedSlack = useRef(false);

  // One-time toast for the Slack OAuth redirect (?slack=connected|error),
  // then strip the param so a refresh doesn't re-fire it.
  useEffect(() => {
    const slackParam = params.get("slack");
    if (slackParam && !notifiedSlack.current) {
      notifiedSlack.current = true;
      if (slackParam === "connected") {
        toast.push("Slack connected");
        onUserChange({ ...user, slackConnected: true });
      } else {
        toast.push("Slack connection failed", "error");
      }
      params.delete("slack");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [scheduledRes, sentRes] = await Promise.all([emailApi.scheduled(), emailApi.sent()]);
      setScheduled(scheduledRes.emails);
      setSent(sentRes.emails);
    } catch {
      // Transient poll failures aren't worth interrupting the dashboard for.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await emailApi.search(searchTerm.trim());
      setSearchResults(res.results);
    } catch {
      toast.push("Search failed", "error");
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setSearchTerm("");
    setSearchResults(null);
  }

  function handleScheduled(count: number) {
    setComposeOpen(false);
    toast.push(`Scheduled ${count} email${count === 1 ? "" : "s"}`);
    refresh();
  }

  const activeEmails = tab === "scheduled" ? scheduled : sent;

  return (
    <div className="min-h-screen bg-paper">
      <Header user={user} onUserChange={onUserChange} />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-1 rounded-md border border-wire bg-white p-1">
            <button
              onClick={() => setTab("scheduled")}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === "scheduled" ? "bg-ink text-paper" : "text-ink/60 hover:text-ink"
              }`}
            >
              Scheduled Emails
            </button>
            <button
              onClick={() => setTab("sent")}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === "sent" ? "bg-ink text-paper" : "text-ink/60 hover:text-ink"
              }`}
            >
              Sent Emails
            </button>
          </div>

          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by recipient, subject, body…"
              className="w-64 rounded-md border border-wire bg-white px-3 py-1.5 text-sm text-ink outline-none focus:border-ink/50"
            />
            <Button type="submit" variant="secondary" className="text-xs">
              {searching ? "Searching\u2026" : "Search"}
            </Button>
            {searchResults !== null && (
              <Button type="button" variant="ghost" className="text-xs" onClick={clearSearch}>
                Clear
              </Button>
            )}
          </form>
        </div>

        <div className="mb-6">
          <Button onClick={() => setComposeOpen(true)}>+ Compose New Email</Button>
        </div>

        {searchResults !== null ? (
          <>
            <p className="mb-3 text-sm text-ink/50">
              {searchResults.length} result{searchResults.length === 1 ? "" : "s"} for &ldquo;{searchTerm}&rdquo;
            </p>
            <EmailTable
              emails={searchResults}
              mode="search"
              emptyTitle="No matching emails"
              emptyDescription="Try a different recipient, subject, or word from the body."
            />
          </>
        ) : loading ? (
          <Loading label="Loading emails…" />
        ) : tab === "scheduled" ? (
          <EmailTable
            emails={activeEmails}
            mode="scheduled"
            emptyTitle="No scheduled emails yet"
            emptyDescription="Compose an email and upload a CSV of recipients to get started."
          />
        ) : (
          <EmailTable
            emails={activeEmails}
            mode="sent"
            emptyTitle="Nothing sent yet"
            emptyDescription="Emails will show up here once they're delivered."
          />
        )}
      </main>

      {composeOpen && (
        <ComposeModal onClose={() => setComposeOpen(false)} onScheduled={handleScheduled} />
      )}
    </div>
  );
}
