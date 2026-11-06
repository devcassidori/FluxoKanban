"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { fail, ok, pgFail, str } from "@/lib/action-utils";
import type { ActionResult, Profile } from "@/lib/types";

export async function updateProfile(input: { name: string }): Promise<ActionResult<Profile>> {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("forbidden");
  const name = str(input.name, 80);
  if (!name) return fail("name_required");
  // A função cria o perfil se ele ainda não existir e devolve a linha salva.
  const { data, error } = await supabase.rpc("update_my_profile", { p_name: name });
  if (error) return pgFail(error);
  revalidatePath("/", "layout");
  return ok(data as Profile);
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
