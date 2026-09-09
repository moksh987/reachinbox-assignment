import { useSearchParams } from "react-router-dom";
import { authApi } from "../services/api";
import { Button } from "../components/Button";

export function Login() {
  const [params] = useSearchParams();
  const hasError = params.get("error") === "google";

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-lg border border-wire bg-white p-8 text-center shadow-sm">
        <p className="font-display text-2xl font-semibold text-ink">ReachInbox</p>
        <p className="mt-2 text-sm text-ink/60">Scheduled email campaigns, done right.</p>

        {hasError && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Google sign-in failed. Please try again.
          </p>
        )}

        <a href={authApi.googleLoginUrl()} className="mt-6 block">
          <Button className="w-full">Continue with Google</Button>
        </a>
      </div>
    </div>
  );
}
