import { createClient } from "@supabase/supabase-js";
import { envServer } from "@/lib/envServer";

export const supabaseAdmin = createClient(envServer.NEXT_PUBLIC_SUPABASE_URL, envServer.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  // Avoid Next.js fetch caching returning stale empty results in route handlers/server code.
  global: {
    fetch: (input: any, init?: RequestInit) => {
      return fetch(input, { ...(init ?? {}), cache: "no-store" });
    }
  }
});
