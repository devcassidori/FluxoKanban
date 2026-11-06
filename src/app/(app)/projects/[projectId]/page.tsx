import { loadProject } from "@/lib/load-project";
import { ProjectBoardsView } from "./project-boards-view";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { supabase, project, role, can } = await loadProject(projectId);
  const { data: boards } = await supabase.from("boards")
    .select("id, name, description, created_at, updated_at, cards(count), board_columns(count)")
    .eq("project_id", projectId).order("created_at");
  const rows = (boards ?? []).map((b) => ({
    id: b.id as string, name: b.name as string, description: b.description as string, updated_at: b.updated_at as string,
    cards: (b.cards as unknown as { count: number }[])?.[0]?.count ?? 0,
    columns: (b.board_columns as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));
  return <ProjectBoardsView project={project} role={role} canAdmin={can.admin} boards={rows} />;
}
