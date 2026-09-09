import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth.middleware";
import {
  scheduleEmailsHandler,
  listScheduledHandler,
  listSentHandler,
  searchEmailsHandler,
  getEmailHandler,
} from "../controllers/email.controller";

export const emailRoutes = Router();

emailRoutes.use(requireAuth);

emailRoutes.post("/schedule", asyncHandler(scheduleEmailsHandler));
emailRoutes.get("/scheduled", asyncHandler(listScheduledHandler));
emailRoutes.get("/sent", asyncHandler(listSentHandler));
emailRoutes.get("/search", asyncHandler(searchEmailsHandler));
emailRoutes.get("/:id", asyncHandler(getEmailHandler));
