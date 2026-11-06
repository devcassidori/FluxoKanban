import { requireUser } from "@/lib/supabase/server";
import { OverviewView, type OverviewCard } from "./overview-view";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Visão geral" };

export default async function OverviewPage() {
  const { supabase } = await requireUser();
  const [{ data: projects }, { data: cards }, { data: profiles }] = await Promise.all([
    supabase.from("projects").select("id, name, boards(id, name, board_columns(id, name, is_done, position))").is("archived_at", null).order("name"),
    supabase.from("cards")
      .select("id, title, description_text, column_id, assignee_id, due_date, project_id, board_id, updated_at, projects!inner(archived_at)")
      .is("projects.archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(5000),
    supabase.from("profiles").select("id, email, name, avatar_url, locale"),
  ]);
  type P = { id: string; name: string; boards: { id: string; name: string; board_columns: { id: string; name: string; is_done: boolean; position: number }[] }[] };
  const ps = (projects ?? []) as P[];
  return (
    <OverviewView
      projects={ps.map((p) => ({ id: p.id, name: p.name }))}
      boards={ps.flatMap((p) => p.boards.map((b) => ({ id: b.id, name: b.name, project_id: p.id })))}
      columns={ps.flatMap((p) => p.boards.flatMap((b) => [...b.board_columns].sort((x, y) => x.position - y.position)
        .map((c) => ({ id: c.id, name: c.name, is_done: c.is_done, board_id: b.id }))))}
      cards={((cards ?? []) as unknown as (OverviewCard & { projects: unknown })[]).map(({ projects: _p, ...c }) => c)}
      profiles={(profiles ?? []) as Profile[]}
    />
  );
}
