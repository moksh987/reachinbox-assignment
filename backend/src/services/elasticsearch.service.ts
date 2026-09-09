import type { Email } from "@prisma/client";
import { esClient, EMAIL_INDEX } from "../lib/elasticsearch";

/**
 * Best-effort indexing. Elasticsearch is a search index, not the source of
 * truth (Postgres is) — an indexing failure should never block scheduling or
 * sending, so this only logs on error rather than throwing.
 */
export async function indexEmail(email: Email): Promise<void> {
  try {
    await esClient.index({
      index: EMAIL_INDEX,
      id: email.id,
      document: {
        userId: email.userId,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt,
        sentAt: email.sentAt,
      },
    });
  } catch (err) {
    console.error(`[elasticsearch] failed to index email ${email.id}`, err);
  }
}

export async function searchEmails(userId: string, query: string) {
  const result = await esClient.search({
    index: EMAIL_INDEX,
    query: {
      bool: {
        filter: [{ term: { userId } }],
        must: [
          {
            multi_match: {
              query,
              fields: ["recipient", "subject", "body"],
              operator: "and",
            },
          },
        ],
      },
    },
  });

  // hit._source doesn't include the document id (that lives on hit._id),
  // but callers/consumers (including the frontend's EmailRecord type)
  // expect every email to carry its id — e.g. for React keys and follow-up
  // GET /api/emails/:id lookups. campaignId/error/createdAt aren't stored in
  // the index at all (see indexEmail above), so search results are a subset
  // of the full record.
  return result.hits.hits.map((hit) => ({
    id: hit._id,
    ...(hit._source as object),
  }));
}