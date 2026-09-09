import type { Request, Response, NextFunction } from "express";

/**
 * Real auth (Phase 7): Google OAuth (see config/passport.ts + routes/auth.routes.ts)
 * populates req.session via Passport after /auth/google/callback. This guard
 * just checks that a session exists and rejects otherwise.
 *
 * This REPLACES the old `x-dev-user-email` header stub used to build and
 * test Phases 2-6 before OAuth existed - that header is no longer trusted
 * anywhere in the app.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ error: "not authenticated - log in via /auth/google" });
    return;
  }
  next();
}
