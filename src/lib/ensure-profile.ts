import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAdminClient } from "./supabase/admin";

/**
 * Garante que a conta tenha linha em public.profiles.
 * Contas criadas antes da migração (ou sem o gatilho de auth.users)
 * ficavam sem perfil, o que quebrava criar projeto e salvar o perfil.
 * Funciona mesmo se a migração de correção ainda não foi aplicada.
 */
export async function ensureProfile(supabase: SupabaseClient, user: User) {
  const { data } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (data) return true;
  const email = (user.email ?? "").toLowerCase();
  const meta = (user.user_metadata ?? {}) as { name?: string; locale?: string };
  const row = {
    id: user.id,
    email,
    name: (meta.name?.trim() || email.split("@")[0] || "").slice(0, 80),
    locale: meta.locale === "en" ? "en" : "pt-BR",
  };
  // 1) função do banco (migração 20261106010000)
  const rpc = await supabase.rpc("ensure_profile");
  if (!rpc.error) return true;
  // 2) sem a função: cria pelo servidor com a service role
  try {
    const { error } = await getAdminClient().from("profiles").upsert(row, { onConflict: "id", ignoreDuplicates: true });
    if (error) console.error("[perfil] upsert", error.code, error.message);
    return !error;
  } catch (e) {
    console.error("[perfil] sem service role para criar perfil", e);
    return false;
  }
}
