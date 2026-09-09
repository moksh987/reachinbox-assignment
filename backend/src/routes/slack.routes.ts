import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth.middleware";
import {
  startSlackOAuth,
  slackOAuthCallback,
  disconnectSlack,
  slackStatus,
} from "../controllers/slack.controller";

export const slackAuthRoutes = Router();
// Must already be logged in via Google to link a Slack account to a User row.
slackAuthRoutes.get("/", requireAuth, startSlackOAuth);
// No requireAuth here: Slack's redirect may arrive without the session in
// scope in some browser setups, so the callback falls back to the `state`
// param (the user id) that was passed into the authorize URL.
slackAuthRoutes.get("/callback", asyncHandler(slackOAuthCallback));

export const apiSlackRoutes = Router();
apiSlackRoutes.use(requireAuth);
apiSlackRoutes.post("/disconnect", asyncHandler(disconnectSlack));
apiSlackRoutes.get("/status", asyncHandler(slackStatus));
