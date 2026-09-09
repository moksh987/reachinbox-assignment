import type { CurrentUser, EmailRecord, EmailCampaign, ScheduleEmailsPayload } from "../types/email";

const API_URL = import.meta.env.VITE_API_URL;

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include", // send the session cookie set by Google OAuth
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {
      // response wasn't JSON — fall back to statusText
    }
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

export { ApiError };

export const authApi = {
  googleLoginUrl: () => `${API_URL}/auth/google`,
  me: () => request<{ user: CurrentUser }>("/api/auth/me"),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
};

export const slackApi = {
  connectUrl: () => `${API_URL}/auth/slack`,
  status: () => request<{ connected: boolean; teamId: string | null }>("/api/slack/status"),
  disconnect: () => request<{ ok: true }>("/api/slack/disconnect", { method: "POST" }),
};

export const emailApi = {
  schedule: (payload: ScheduleEmailsPayload) =>
    request<{ campaign: EmailCampaign; emails: EmailRecord[] }>("/api/emails/schedule", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  scheduled: () => request<{ emails: EmailRecord[] }>("/api/emails/scheduled"),
  sent: () => request<{ emails: EmailRecord[] }>("/api/emails/sent"),
  search: (q: string) => request<{ results: EmailRecord[] }>(`/api/emails/search?q=${encodeURIComponent(q)}`),
};
