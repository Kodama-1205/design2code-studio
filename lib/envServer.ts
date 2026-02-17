import { z } from "zod";

const EnvServerSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  // Server-side encryption key for storing user secrets (base64 recommended)
  // NOTE: This is required for secure secret storage, but should NOT crash the whole app if missing.
  // If omitted, we fall back to a fixed dev key (do not use in production).
  D2C_ENCRYPTION_KEY: z
    .string()
    .min(32)
    .optional()
    .transform((v) => v ?? "dev_fallback_encryption_key__CHANGE_ME__32bytes_min"),
  // Legacy (will be removed): fixed owner id for demo data
  D2C_OWNER_ID: z
    .string()
    .uuid()
    .optional()
    .transform((v) => v ?? "00000000-0000-0000-0000-000000000000"),
  FIGMA_ACCESS_TOKEN: z.string().min(10).optional(),
  D2C_CRON_SECRET: z.string().min(16).optional()
});

const parsed = EnvServerSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  D2C_ENCRYPTION_KEY: process.env.D2C_ENCRYPTION_KEY,
  D2C_OWNER_ID: process.env.D2C_OWNER_ID,
  FIGMA_ACCESS_TOKEN: process.env.FIGMA_ACCESS_TOKEN,
  D2C_CRON_SECRET: process.env.D2C_CRON_SECRET
});

export const envServer: z.infer<typeof EnvServerSchema> = parsed.success
  ? parsed.data
  : ({
      // Fallback values to avoid crashing server rendering when env is missing.
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SERVICE_ROLE_KEY: "missing_service_role_key",
      D2C_ENCRYPTION_KEY: "missing_encryption_key_missing_encryption_key",
      D2C_OWNER_ID: "00000000-0000-0000-0000-000000000000",
      FIGMA_ACCESS_TOKEN: undefined,
      D2C_CRON_SECRET: undefined
    } as any);

export const envServerOk = parsed.success;
export const envServerError = parsed.success ? null : parsed.error.flatten();

