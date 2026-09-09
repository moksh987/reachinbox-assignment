import { WebClient } from "@slack/web-api";
import type { User } from "@prisma/client";

/**
 * Real implementation (Phase 9) - replaces the Phase 2-6 console.log stub.
 *
 * Sends a DM (not a channel post) to the user who owns the rate-limited
 * sender, using their own OAuth-connected Slack workspace token. If the user
 * never connected Slack, this is a no-op - the rate limiter still defers the
 * email either way, so a missing Slack connection never blocks sending.
 */
export async function notifyRateLimitReached(
  user: Pick<User, "slackAccessToken" | "slackUserId">,
  sender: string,
  limit: number
): Promise<void> {
  if (!user.slackAccessToken || !user.slackUserId) {
    console.log(
      `[slack] no Slack connection for this user - skipping notification (sender="${sender}", limit=${limit}/hr)`
    );
    return;
  }

  try {
    const client = new WebClient(user.slackAccessToken);
    const opened = await client.conversations.open({ users: user.slackUserId });
    const channel = opened.channel?.id;
    if (!channel) {
      console.error("[slack] conversations.open did not return a channel id");
      return;
    }

    await client.chat.postMessage({
      channel,
      text: `:warning: Hourly email limit reached for sender *${sender}* (${limit}/hr). Remaining emails have been rescheduled to the next hour.`,
    });
  } catch (err) {
    // Slack failures should never take down the send pipeline - the email
    // itself has already been rescheduled by the time this is called.
    console.error("[slack] failed to send rate-limit notification", err);
  }
}
