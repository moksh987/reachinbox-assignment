import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { CurrentUser } from "./types/email";
import { authApi } from "./services/api";
import { ToastProvider } from "./components/Toast";
import { Loading } from "./components/Loading";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";

// `undefined` = still checking the session; `null` = confirmed logged out.
type AuthState = CurrentUser | null | undefined;

function AppRoutes() {
  const [user, setUser] = useState<AuthState>(undefined);

  useEffect(() => {
    authApi
      .me()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <Loading label="Signing you in…" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route
        path="/dashboard"
        element={
          user ? <Dashboard user={user} onUserChange={setUser} /> : <Navigate to="/login" replace />
        }
      />
      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </BrowserRouter>
  );
}
