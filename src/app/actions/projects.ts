"use server";
import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient, IMAGE_BUCKET } from "@/lib/supabase/admin";
import { ensureProfile } from "@/lib/ensure-profile";
import { fail, isUuid, ok, pgFail, str } from "@/lib/action-utils";
import { sendInviteEmail } from "@/lib/email";
import { appConfig } from "@/lib/config";
import { getLocale } from "@/lib/i18n/server";
import type { ActionResult, Invitation, Role } from "@/lib/types";

async function client() {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function removeStoragePaths(paths: string[]) {
  if (!paths.length) return;
  try {
    const admin = getAdminClient();
    for (let i = 0; i < paths.length; i += 100) {
      await admin.storage.from(IMAGE_BUCKET).remove(paths.slice(i, i + 100));
    }
  } catch (e) {
    console.error("[storage] falha ao remover arquivos", e);
  }
}

export async function createProject(input: { name: string; description?: string }): Promise<ActionResult<string>> {
  const name = str(input.name, 120);
  if (!name) return fail("name_required");
  const { supabase, user } = await client();
  if (!user) return fail("forbidden");
  await ensureProfile(supabase, user);
  const { data, error } = await supabase.rpc("create_project", { p_name: name, p_description: str(input.description, 2000) });
  if (error) return pgFail(error);
  revalidatePath("/", "layout");
  return ok(data as string);
}

export async function updateProject(id: string, input: { name: string; description?: string }): Promise<ActionResult> {
  const name = str(input.name, 120);
  if (!isUuid(id)) return fail("not_found");
  if (!name) return fail("name_required");
  const { supabase } = await client();
  const { data, error } = await supabase.from("projects")
    .update({ name, description: str(input.description, 2000) }).eq("id", id).select("id");
  if (error) return pgFail(error);
  if (!data?.length) return fail("forbidden");
  revalidatePath("/", "layout");
  return ok(null);
}

export async function archiveProject(id: string): Promise<ActionResult> {
  const { supabase } = await client();
  const { error } = await supabase.rpc("archive_project", { p_project: id });
  if (error) return pgFail(error);
  revalidatePath("/", "layout");
  return ok(null);
}

export async function restoreProject(id: string): Promise<ActionResult> {
  const { supabase } = await client();
  const { error } = await supabase.rpc("restore_project", { p_project: id });
  if (error) return pgFail(error);
  revalidatePath("/", "layout");
  return ok(null);
}

export async function deleteProject(id: string, confirmName: string): Promise<ActionResult> {
  const { supabase } = await client();
  const { data, error } = await supabase.rpc("delete_project", { p_project: id, p_confirm_name: confirmName });
  if (error) return pgFail(error);
  await removeStoragePaths((data as string[] | null) ?? []);
  revalidatePath("/", "layout");
  return ok(null);
}

export async function transferOwnership(projectId: string, userId: string): Promise<ActionResult> {
  const { supabase } = await client();
  const { error } = await supabase.rpc("transfer_ownership", { p_project: projectId, p_new_owner: userId });
  if (error) return pgFail(error);
  revalidatePath("/", "layout");
  return ok(null);
}

export async function setMemberRole(projectId: string, userId: string, role: Role): Promise<ActionResult> {
  if (role !== "admin" && role !== "member") return fail("forbidden");
  const { supabase } = await client();
  const { error } = await supabase.rpc("set_member_role", { p_project: projectId, p_user: userId, p_role: role });
  if (error) return pgFail(error);
  revalidatePath(`/projects/${projectId}`, "layout");
  return ok(null);
}

export async function setMemberActive(projectId: string, userId: string, active: boolean): Promise<ActionResult> {
  const { supabase } = await client();
  const { error } = await supabase.rpc("set_member_active", { p_project: projectId, p_user: userId, p_active: active });
  if (error) return pgFail(error);
  revalidatePath(`/projects/${projectId}`, "layout");
  return ok(null);
}

export async function removeMember(projectId: string, userId: string, mode: "unassign" | "reassign" | null, reassignTo?: string | null): Promise<ActionResult> {
  const { supabase } = await client();
  const { error } = await supabase.rpc("remove_member", {
    p_project: projectId, p_user: userId, p_mode: mode, p_reassign_to: reassignTo ?? null,
  });
  if (error) return pgFail(error);
  revalidatePath(`/projects/${projectId}`, "layout");
  return ok(null);
}

export async function leaveProject(projectId: string): Promise<ActionResult> {
  const { supabase } = await client();
  const { error } = await supabase.rpc("leave_project", { p_project: projectId });
  if (error) return pgFail(error);
  revalidatePath("/", "layout");
  return ok(null);
}

async function deliverInvite(inv: Invitation, projectId: string) {
  const { supabase, user } = await client();
  const link = `${appConfig.siteUrl}/invite/${inv.token}`;
  const [{ data: project }, { data: me }] = await Promise.all([
    supabase.from("projects").select("name").eq("id", projectId).single(),
    supabase.from("profiles").select("name").eq("id", user!.id).single(),
  ]);
  const sent = await sendInviteEmail({
    to: inv.email, projectName: project?.name ?? "", inviterName: me?.name ?? "", link, locale: await getLocale(),
  });
  return { sent, link };
}

export async function createInvitation(projectId: string, email: string, role: Role): Promise<ActionResult<{ sent: boolean; link: string }>> {
  const { supabase, user } = await client();
  if (!user) return fail("forbidden");
  const { data, error } = await supabase.rpc("create_invitation", {
    p_project: projectId, p_email: str(email, 254).toLowerCase(), p_role: role,
  });
  if (error) return pgFail(error);
  const result = await deliverInvite(data as Invitation, projectId);
  revalidatePath(`/projects/${projectId}/members`);
  return ok(result);
}

export async function resendInvitation(projectId: string, invitationId: string): Promise<ActionResult<{ sent: boolean; link: string }>> {
  const { supabase } = await client();
  const { data, error } = await supabase.rpc("resend_invitation", { p_invitation: invitationId });
  if (error) return pgFail(error);
  const result = await deliverInvite(data as Invitation, projectId);
  revalidatePath(`/projects/${projectId}/members`);
  return ok(result);
}

export async function cancelInvitation(projectId: string, invitationId: string): Promise<ActionResult> {
  const { supabase } = await client();
  const { error } = await supabase.rpc("cancel_invitation", { p_invitation: invitationId });
  if (error) return pgFail(error);
  revalidatePath(`/projects/${projectId}/members`);
  return ok(null);
}

export async function acceptInvitation(token: string): Promise<ActionResult<string>> {
  if (!isUuid(token)) return fail("invitation_not_found");
  const { supabase, user } = await client();
  if (!user) return fail("forbidden");
  await ensureProfile(supabase, user);
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return pgFail(error);
  revalidatePath("/", "layout");
  return ok(data as string);
}
