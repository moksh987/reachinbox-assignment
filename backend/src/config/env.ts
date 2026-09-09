import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  PORT: Number(process.env.PORT ?? 5000),
  NODE_ENV: process.env.NODE_ENV ?? "development",

  DATABASE_URL: required("DATABASE_URL", "postgresql://reachinbox:reachinbox@localhost:5432/reachinbox"),

  REDIS_HOST: process.env.REDIS_HOST ?? "localhost",
  REDIS_PORT: Number(process.env.REDIS_PORT ?? 6379),

  ELASTICSEARCH_URL: process.env.ELASTICSEARCH_URL ?? "http://localhost:9200",

  SMTP_HOST: process.env.SMTP_HOST ?? "",
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 587),
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASSWORD: process.env.SMTP_PASSWORD ?? "",

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:5000/auth/google/callback",

  SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID ?? "",
  SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET ?? "",
  SLACK_REDIRECT_URI: process.env.SLACK_REDIRECT_URI ?? "http://localhost:5000/auth/slack/callback",

  WORKER_CONCURRENCY: Number(process.env.WORKER_CONCURRENCY ?? 5),
  MIN_DELAY_MS: Number(process.env.MIN_DELAY_MS ?? 2000),
  MAX_EMAILS_PER_HOUR: Number(process.env.MAX_EMAILS_PER_HOUR ?? 100),

  SESSION_SECRET: process.env.SESSION_SECRET ?? "dev-secret-change-me",

  FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:5173",
};
