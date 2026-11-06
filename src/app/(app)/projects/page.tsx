import { requireUser } from "@/lib/supabase/server";
import { ProjectsView } from "./projects-view";
import type { Role } from "@/lib/types";

export const metadata = { title: "Projetos" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ new?: string; reset?: string; confirmed?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireUser();
  const [{ data: projects }, { data: memberships }] = await Promise.all([
    supabase.from("projects")
      .select("id, name, description, owner_id, archived_at, created_at, updated_at, boards(count), project_members(count)")
      .order("updated_at", { ascending: false }),
    supabase.from("project_members").select("project_id, role").eq("user_id", user.id),
  ]);
  const roles = Object.fromEntries((memberships ?? []).map((m) => [m.project_id, m.role as Role]));
  const rows = (projects ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    description: p.description as string,
    archived_at: p.archived_at as string | null,
    updated_at: p.updated_at as string,
    boards: (p.boards as unknown as { count: number }[])?.[0]?.count ?? 0,
    members: (p.project_members as unknown as { count: number }[])?.[0]?.count ?? 0,
    role: roles[p.id] ?? "member",
  }));
  return <ProjectsView projects={rows} openNew={sp.new === "1"} notice={sp.reset ? "reset" : sp.confirmed ? "confirmed" : null} />;
}
