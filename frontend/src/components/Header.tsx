import { useNavigate } from "react-router-dom";
import type { CurrentUser } from "../types/email";
import { authApi, slackApi } from "../services/api";
import { Button } from "./Button";
import { useToast } from "./Toast";

interface HeaderProps {
  user: CurrentUser;
  onUserChange: (user: CurrentUser | null) => void;
}

export function Header({ user, onUserChange }: HeaderProps) {
  const navigate = useNavigate();
  const toast = useToast();

  async function handleLogout() {
    try {
      await authApi.logout();
    } finally {
      onUserChange(null);
      navigate("/login");
    }
  }

  async function handleSlackDisconnect() {
    try {
      await slackApi.disconnect();
      onUserChange({ ...user, slackConnected: false });
      toast.push("Slack disconnected");
    } catch {
      toast.push("Couldn't disconnect Slack", "error");
    }
  }

  return (
    <header className="border-b border-wire bg-paper">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <span className="font-display text-lg font-semibold text-ink">ReachInbox</span>

        <div className="flex items-center gap-4">
          {user.slackConnected ? (
            <Button variant="ghost" className="text-xs" onClick={handleSlackDisconnect}>
              Slack connected {"\u00b7"} disconnect
            </Button>
          ) : (
            <a href={slackApi.connectUrl()}>
              <Button variant="secondary" className="text-xs">
                Connect Slack
              </Button>
            </a>
          )}

          <div className="flex items-center gap-2">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-full" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-medium text-paper">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="hidden text-sm sm:block">
              <p className="font-medium text-ink leading-tight">{user.name}</p>
              <p className="text-xs text-ink/50 leading-tight">{user.email}</p>
            </div>
          </div>

          <Button variant="ghost" className="text-xs" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
