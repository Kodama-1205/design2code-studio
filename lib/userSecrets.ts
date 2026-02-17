import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { decryptSecret, encryptSecret } from "@/lib/secretsCrypto";

export async function getUserFigmaPat(ownerId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("d2c_user_secrets")
    .select("figma_pat_enc")
    .eq("owner_id", ownerId)
    .single();
  if (error) return null;
  const enc = (data as any)?.figma_pat_enc as string | undefined;
  if (!enc) return null;
  try {
    return decryptSecret(enc);
  } catch {
    return null;
  }
}

export async function hasUserFigmaPat(ownerId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("d2c_user_secrets")
    .select("owner_id,updated_at")
    .eq("owner_id", ownerId)
    .single();
  if (error) return false;
  return Boolean((data as any)?.owner_id);
}

export async function upsertUserFigmaPat(ownerId: string, token: string) {
  const enc = encryptSecret(token.trim());
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("d2c_user_secrets")
    .upsert({ owner_id: ownerId, figma_pat_enc: enc, updated_at: now }, { onConflict: "owner_id" });
  if (error) throw new Error(error.message);
}

export async function deleteUserFigmaPat(ownerId: string) {
  const { error } = await supabaseAdmin.from("d2c_user_secrets").delete().eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
}

