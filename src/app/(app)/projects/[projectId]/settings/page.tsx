import { loadProject } from "@/lib/load-project";
import { SettingsView } from "./settings-view";

export default async function SettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { supabase, project, role, can } = await loadProject(projectId);
  const [boards, cards, images, used] = await Promise.all([
    supabase.from("boards").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("cards").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("card_images").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.rpc("project_storage_used", { p_project: projectId }),
  ]);
  return (
    <SettingsView project={project} role={role} canAdmin={can.admin}
      counts={{ boards: boards.count ?? 0, cards: cards.count ?? 0, images: images.count ?? 0 }}
      usedBytes={Number(used.data ?? 0)} />
  );
}
