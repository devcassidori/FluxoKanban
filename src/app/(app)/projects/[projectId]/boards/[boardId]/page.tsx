import { notFound } from "next/navigation";
import { loadProject } from "@/lib/load-project";
import { BoardView } from "@/components/board/board-view";
import type { Board, Card, CardImage, Column } from "@/lib/types";

const CARD_FIELDS = "id, board_id, project_id, column_id, title, description, description_text, assignee_id, due_date, position, version, created_at, updated_at, updated_by";

export default async function BoardPage({ params }: { params: Promise<{ projectId: string; boardId: string }> }) {
  const { projectId, boardId } = await params;
  const { supabase, project, members, role, can } = await loadProject(projectId);
  const { data: board } = await supabase.from("boards").select("*").eq("id", boardId).eq("project_id", projectId).maybeSingle();
  if (!board) notFound();
  const [{ data: columns }, { data: cards }, { data: images }] = await Promise.all([
    supabase.from("board_columns").select("id, board_id, project_id, name, position, is_done").eq("board_id", boardId),
    supabase.from("cards").select(CARD_FIELDS).eq("board_id", boardId),
    supabase.from("card_images").select("id, card_id, project_id, path, mime, size_bytes, created_at, cards!inner(board_id)").eq("cards.board_id", boardId),
  ]);
  // Validação pendente nº 10: permissões de colunas para integrantes comuns
  // (espelha public.perm_members_manage_columns()).
  const membersManageColumns = false;
  return (
    <BoardView
      key={boardId}
      initial={{
        board: board as Board,
        columns: (columns ?? []) as Column[],
        cards: (cards ?? []) as Card[],
        images: ((images ?? []) as unknown as (CardImage & { cards: unknown })[]).map(({ cards: _c, ...i }) => i),
      }}
      project={project}
      members={members}
      canWrite={can.write}
      canAdmin={can.admin}
      canManageColumns={can.admin || (membersManageColumns && can.write && role === "member")}
    />
  );
}
