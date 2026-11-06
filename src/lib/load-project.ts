import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "./supabase/server";
import type { Member, Project, Role } from "./types";

/** Carrega o projeto respeitando a RLS: quem não é integrante recebe 404. */
export async function loadProject(projectId: string) {
  const { supabase, user } = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) notFound();
  const [{ data: project }, { data: members }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
    supabase.from("project_members")
      .select("project_id, user_id, role, active, created_at, profile:profiles(id, email, name, avatar_url, locale)")
      .eq("project_id", projectId),
  ]);
  if (!project) notFound();
  const list = ((members ?? []) as unknown as Member[]).filter((m) => m.profile)
    .sort((a, b) => ["owner", "admin", "member"].indexOf(a.role) - ["owner", "admin", "member"].indexOf(b.role)
      || a.profile.name.localeCompare(b.profile.name));
  const me = list.find((m) => m.user_id === user.id);
  if (!me || !me.active) notFound();
  const role: Role = me.role;
  const archived = !!project.archived_at;
  return {
    supabase, user, project: project as Project, members: list, role,
    can: {
      admin: !archived && (role === "owner" || role === "admin"),
      write: !archived,
      owner: role === "owner",
    },
  };
}
