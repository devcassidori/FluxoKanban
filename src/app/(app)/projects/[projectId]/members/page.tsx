import { loadProject } from "@/lib/load-project";
import { MembersView } from "./members-view";
import type { Invitation } from "@/lib/types";

export default async function MembersPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { supabase, user, project, members, role, can } = await loadProject(projectId);
  let invitations: Invitation[] = [];
  if (can.admin) {
    const { data } = await supabase.from("invitations").select("*")
      .eq("project_id", projectId).is("accepted_at", null).is("canceled_at", null).order("created_at", { ascending: false });
    invitations = (data ?? []) as Invitation[];
  }
  return <MembersView project={project} role={role} meId={user.id} members={members} invitations={invitations} canAdmin={can.admin} siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""} />;
}
