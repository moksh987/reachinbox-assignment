import type { Request, Response } from "express";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { slackOAuthClient } from "../lib/slackClient";

const SLACK_SCOPES = ["chat:write", "im:write"].join(",");

export function startSlackOAuth(req: Request, res: Response): void {
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: SLACK_SCOPES,
    redirect_uri: env.SLACK_REDIRECT_URI,
    // The signed-in user's id is round-tripped through `state` so the
    // callback (which Slack redirects to with no session guarantee beyond
    // the cookie) can attribute the token to the right row even if the
    // session cookie were somehow missing.
    state: req.user!.id,
  });
  res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
}

export async function slackOAuthCallback(req: Request, res: Response): Promise<void> {
  const code = String(req.query.code ?? "");
  const userId = String(req.query.state ?? req.user?.id ?? "");

  if (!code || !userId) {
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error`);
    return;
  }

  const result = await slackOAuthClient.oauth.v2.access({
    client_id: env.SLACK_CLIENT_ID,
    client_secret: env.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: env.SLACK_REDIRECT_URI,
  });

  if (!result.ok || !result.access_token) {
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error`);
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      slackAccessToken: result.access_token,
      slackTeamId: result.team?.id,
      slackUserId: (result as { authed_user?: { id?: string } }).authed_user?.id,
    },
  });

  res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
}

export async function disconnectSlack(req: Request, res: Response): Promise<void> {
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { slackAccessToken: null, slackTeamId: null, slackUserId: null },
  });
  res.json({ ok: true });
}

export async function slackStatus(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  res.json({ connected: Boolean(user.slackAccessToken), teamId: user.slackTeamId ?? null });
}
