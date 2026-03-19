import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_FACEBOOK_ID: z.string().optional(),
  AUTH_FACEBOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
