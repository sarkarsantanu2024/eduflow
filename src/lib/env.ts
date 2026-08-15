import { z } from "zod";

/**
 * Centralised, validated environment access.
 * Server-only secrets are kept out of the client schema so they can never
 * be accidentally bundled into the browser.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("EduFlow"),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional(),
  // GA4 measurement id (G-XXXXXXXXXX). Unset = analytics disabled (e.g. dev).
  NEXT_PUBLIC_GA_ID: z.string().optional(),
});

export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
});

const serverSchema = z.object({
  // Neon Postgres connection string (pooled URL recommended for serverless).
  DATABASE_URL: z.string().min(1, "DATABASE_URL (Neon connection string) is required"),
  // Auth.js session secret — generate with `npx auth secret`.
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  // Google OAuth (optional — login shows the Google button when both are set).
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  // Vercel Blob read/write token for file uploads.
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default("v21.0"),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  CRON_SECRET: z.string().optional(),
});

/**
 * Lazily validated server env. Call only from server code (server actions,
 * route handlers). Throws if required secrets are missing.
 */
export function getServerEnv() {
  return serverSchema.parse(process.env);
}
