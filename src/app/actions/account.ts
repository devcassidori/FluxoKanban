"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { fail, ok, pgFail, str } from "@/lib/action-utils";
import { ensureProfile } from "@/lib/ensure-profile";
import type { ActionResult, Profile } from "@/lib/types";

export async function updateProfile(input: { name: string }): Promise<ActionResult<Profile>> {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("forbidden");
  const name = str(input.name, 80);
  if (!name) return fail("name_required");
  await ensureProfile(supabase, user);
  const { data, error } = await supabase.rpc("update_my_profile", { p_name: name });
  if (!error) { revalidatePath("/", "layout"); return ok(data as Profile); }
  if (error.code !== "PGRST202" && error.code !== "42883") return pgFail(error);
  // migração de correção ainda não aplicada: atualiza direto (RLS: só a própria linha)
  const upd = await supabase.from("profiles").update({ name }).eq("id", user.id)
    .select("id, email, name, avatar_url, locale");
  if (upd.error) return pgFail(upd.error);
  if (!upd.data?.length) return fail("not_found");
  revalidatePath("/", "layout");
  return ok(upd.data[0] as Profile);
}

/** Bloqueia a exclusão enquanto a pessoa for dona de algum projeto (validação pendente nº 7). */
export async function deleteAccount(confirmEmail: string): Promise<ActionResult<{ name: string }[]>> {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("forbidden");
  if (confirmEmail.trim().toLowerCase() !== (user.email ?? "").toLowerCase()) return fail("confirm_name_mismatch");
  const { data: owned, error } = await supabase.rpc("owned_projects");
  if (error) return pgFail(error);
  if ((owned as unknown[])?.length) return { ok: false, error: "owns_projects", detail: JSON.stringify(owned) };
  const admin = getAdminClient();
  await admin.storage.from("avatars").list(user.id).then(({ data }) =>
    data?.length ? admin.storage.from("avatars").remove(data.map((f) => `${user.id}/${f.name}`)) : null).catch(() => undefined);
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return fail("generic");
  await supabase.auth.signOut();
  redirect("/login");
}
