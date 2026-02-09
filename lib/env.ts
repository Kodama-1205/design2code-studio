import { z } from "zod";

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  D2C_OWNER_ID: z.string().uuid().optional().transform((v) => v ?? "00000000-0000-0000-0000-000000000000")
});

const parsed = EnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  D2C_OWNER_ID: process.env.D2C_OWNER_ID
});

export const env: z.infer<typeof EnvSchema> = parsed.success
  ? parsed.data
  : ({
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "missing_anon_key",
      D2C_OWNER_ID: "00000000-0000-0000-0000-000000000000"
    } as any);

export const envPublicOk = parsed.success;
export const envPublicError = parsed.success ? null : parsed.error.flatten();
