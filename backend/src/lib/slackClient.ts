import { WebClient } from "@slack/web-api";

// A token-less client is enough for the OAuth code exchange
// (oauth.v2.access doesn't need a bot token — it's how you get one).
// Per-user calls (chat.postMessage, conversations.open) create their own
// WebClient with that user's slackAccessToken — see slack.service.ts.
export const slackOAuthClient = new WebClient();
