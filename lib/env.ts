import { z } from "zod";

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20)
});

const parsed = EnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
});

export const env: z.infer<typeof EnvSchema> = parsed.success
  ? parsed.data
  : ({
      // Fallback values to avoid crashing the entire app when env is missing.
      // API calls will fail gracefully; UI should show a helpful error instead of 500.
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "missing_anon_key"
    } as any);

export const envPublicOk = parsed.success;
export const envPublicError = parsed.success ? null : parsed.error.flatten();
