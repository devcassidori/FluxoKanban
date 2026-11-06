"use server";
// Ações do quadro (colunas e cards). Todas idempotentes ou protegidas por
// versão, para que o reenvio após uma queda de conexão não duplique nada.
import { getServerClient } from "@/lib/supabase/server";
import { DATE_RE, fail, isUuid, ok, pgFail, str } from "@/lib/action-utils";
import { sanitizeDescription } from "@/lib/sanitize";
import { removeStoragePaths } from "./projects";
import type { ActionResult, Card, Column } from "@/lib/types";

const CARD_FIELDS = "id, board_id, project_id, column_id, title, description, description_text, assignee_id, due_date, position, version, created_at, updated_at, updated_by";
const COLUMN_FIELDS = "id, board_id, project_id, name, position, is_done";

// ----- colunas ----------------------------------------------------------
export async function createColumn(input: { id: string; board_id: string; name: string; position: number }): Promise<ActionResult<Column>> {
  const name = str(input.name, 60);
  if (!name) return fail("name_required");
  if (!isUuid(input.id) || !isUuid(input.board_id) || !Number.isFinite(input.position)) return fail("generic");
  const supabase = await getServerClient();
  const { data: existing } = await supabase.from("board_columns").select(COLUMN_FIELDS).eq("id", input.id).maybeSingle();
  if (existing) return ok(existing as Column);
  const { data, error } = await supabase.from("board_columns")
    .insert({ id: input.id, board_id: input.board_id, name, position: input.position })
    .select(COLUMN_FIELDS).single();
  if (error) return pgFail(error);
  return ok(data as Column);
}

export async function updateColumn(id: string, patch: { name?: string; position?: number; is_done?: boolean }): Promise<ActionResult<Column>> {
  if (!isUuid(id)) return fail("not_found");
  const clean: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = str(patch.name, 60);
    if (!name) return fail("name_required");
    clean.name = name;
  }
  if (patch.position !== undefined) {
    if (!Number.isFinite(patch.position)) return fail("generic");
    clean.position = patch.position;
  }
  if (patch.is_done !== undefined) clean.is_done = !!patch.is_done;
  const supabase = await getServerClient();
  const { data, error } = await supabase.from("board_columns").update(clean).eq("id", id).select(COLUMN_FIELDS);
  if (error) return pgFail(error);
  if (!data?.length) return fail("forbidden");
  return ok(data[0] as Column);
}

export async function deleteColumn(id: string, targetId: string | null): Promise<ActionResult> {
  const supabase = await getServerClient();
  const { error } = await supabase.rpc("delete_column", { p_column: id, p_target: targetId });
  if (error) return pgFail(error);
  return ok(null);
}

// ----- cards ------------------------------------------------------------
export async function createCard(input: { id: string; board_id: string; column_id: string; title: string; position: number }): Promise<ActionResult<Card>> {
  const title = str(input.title, 200);
  if (!title) return fail("title_required");
  if (![input.id, input.board_id, input.column_id].every(isUuid) || !Number.isFinite(input.position)) return fail("generic");
  const supabase = await getServerClient();
  // id gerado no cliente: reenvio da mesma ação devolve o card já criado
  const { data: existing } = await supabase.from("cards").select(CARD_FIELDS).eq("id", input.id).maybeSingle();
  if (existing) return ok(existing as Card);
  const { data, error } = await supabase.from("cards")
    .insert({ id: input.id, board_id: input.board_id, column_id: input.column_id, title, position: input.position })
    .select(CARD_FIELDS).single();
  if (error) return pgFail(error);
  return ok(data as Card);
}

export async function moveCard(id: string, columnId: string, position: number): Promise<ActionResult<Card>> {
  if (!isUuid(id) || !isUuid(columnId) || !Number.isFinite(position)) return fail("generic");
  const supabase = await getServerClient();
  const { data, error } = await supabase.from("cards").update({ column_id: columnId, position }).eq("id", id).select(CARD_FIELDS);
  if (error) return pgFail(error);
  if (!data?.length) return fail("not_found");
  return ok(data[0] as Card);
}

export interface CardPatch {
  title: string;
  description: string;
  assignee_id: string | null;
  due_date: string | null;
}

export type UpdateCardResult =
  | { ok: true; data: Card }
  | { ok: false; error: "conflict"; current: Card; sanitized: CardPatch }
  | { ok: false; error: string; detail?: string };

/**
 * Salva só se a versão no banco for a que o cliente editou.
 * Se outra pessoa salvou antes, nada é sobrescrito: devolvemos as duas
 * versões para a pessoa comparar e decidir.
 */
export async function updateCard(id: string, expectedVersion: number, patch: CardPatch): Promise<UpdateCardResult> {
  if (!isUuid(id)) return fail("not_found");
  const title = str(patch.title, 200);
  if (!title) return fail("title_required");
  if (patch.due_date && !DATE_RE.test(patch.due_date)) return fail("generic");
  if (patch.assignee_id && !isUuid(patch.assignee_id)) return fail("generic");
  const { html, text } = sanitizeDescription(String(patch.description ?? "").slice(0, 20000));
  const clean: CardPatch = { title, description: html, assignee_id: patch.assignee_id || null, due_date: patch.due_date || null };

  const supabase = await getServerClient();
  const { data, error } = await supabase.from("cards")
    .update({ ...clean, description_text: text })
    .eq("id", id).eq("version", expectedVersion)
    .select(CARD_FIELDS);
  if (error) return pgFail(error);
  if (data?.length) return { ok: true, data: data[0] as Card };

  const { data: current } = await supabase.from("cards").select(CARD_FIELDS).eq("id", id).maybeSingle();
  if (!current) return fail("not_found");
  const cur = current as Card;
  // Reenvio de algo que já foi salvo (ex.: após reconectar): não é conflito.
  if (cur.title === clean.title && cur.description === clean.description
      && cur.assignee_id === clean.assignee_id && cur.due_date === clean.due_date) {
    return { ok: true, data: cur };
  }
  return { ok: false, error: "conflict", current: cur, sanitized: clean };
}

export async function deleteCard(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return fail("not_found");
  const supabase = await getServerClient();
  const { data: imgs } = await supabase.from("card_images").select("path").eq("card_id", id);
  const { data, error } = await supabase.from("cards").delete().eq("id", id).select("id");
  if (error) return pgFail(error);
  if (!data?.length) {
    const { data: still } = await supabase.from("cards").select("id").eq("id", id).maybeSingle();
    if (still) return fail("forbidden");
  }
  await removeStoragePaths((imgs ?? []).map((i) => i.path as string));
  return ok(null);
}
