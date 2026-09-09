import { Router } from "express";
import { passport } from "../config/passport";
import { env } from "../config/env";
import { asyncHandler } from "../lib/asyncHandler";
import { meHandler, logoutHandler } from "../controllers/auth.controller";

export const authRoutes = Router();

authRoutes.get("/", passport.authenticate("google", { scope: ["profile", "email"] }));

authRoutes.get(
  "/callback",
  passport.authenticate("google", {
    failureRedirect: `${env.FRONTEND_URL}/login?error=google`,
  }),
  (_req, res) => {
    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  }
);

export const apiAuthRoutes = Router();

apiAuthRoutes.get("/me", asyncHandler(meHandler));
apiAuthRoutes.post("/logout", asyncHandler(logoutHandler));
