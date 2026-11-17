import { z } from "zod";
import firebaseConfig from "../../firebase-applet-config.json";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  FIREBASE_PROJECT_ID: z.string().default(firebaseConfig.projectId || ""),
  FIREBASE_DATABASE_ID: z.string().default(firebaseConfig.firestoreDatabaseId || "(default)"),
  FIREBASE_STORAGE_BUCKET: z.string().default(firebaseConfig.storageBucket || ""),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().default("*"),
  // Third-party API keys (loaded safely on server only)
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  ADMIN_NOTIFICATION_EMAIL: z.string().optional(),
  // Google Calendar API (for real Google Meet creation)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().optional(),
  GOOGLE_CALENDAR_IMPERSONATE_EMAIL: z.string().optional(),
  // Microsoft Graph API (for real Microsoft Teams onlineMeetings creation)
  AZURE_TENANT_ID: z.string().optional(),
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_CLIENT_SECRET: z.string().optional(),
  MS_TEAMS_ORGANIZER_USER_ID: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof envSchema>;

let parsedEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (!parsedEnv) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.warn("Environment configuration warning:", result.error.format());
      parsedEnv = envSchema.parse({});
    } else {
      parsedEnv = result.data;
    }
  }
  return parsedEnv;
}
