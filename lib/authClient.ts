import { supabaseBrowser } from "@/lib/supabaseBrowser";

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabaseBrowser.auth.getSession();
  return data.session?.access_token ?? null;
}

