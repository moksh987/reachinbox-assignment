import { Client } from "@elastic/elasticsearch";
import { env } from "../config/env";

export const esClient = new Client({ node: env.ELASTICSEARCH_URL });

export const EMAIL_INDEX = "emails";

/**
 * PostgreSQL is the source of truth (see prisma/schema.prisma). This index
 * only exists to power `GET /api/emails/search` — losing it never loses data,
 * it just needs to be rebuilt (a `reindex` script would replay from Postgres;
 * not needed for the assignment's scope).
 */
export async function ensureEmailIndex(): Promise<void> {
  const exists = await esClient.indices.exists({ index: EMAIL_INDEX });
  if (exists) return;

  await esClient.indices.create({
    index: EMAIL_INDEX,
    mappings: {
      properties: {
        userId: { type: "keyword" },
        recipient: { type: "text" },
        subject: { type: "text" },
        body: { type: "text" },
        status: { type: "keyword" },
        scheduledAt: { type: "date" },
        sentAt: { type: "date" },
      },
    },
  });

  console.log(`[elasticsearch] created "${EMAIL_INDEX}" index`);
}
