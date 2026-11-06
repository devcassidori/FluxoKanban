"use server";
import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import { fail, isUuid, ok, pgFail, str } from "@/lib/action-utils";
import { removeStoragePaths } from "./projects";
import type { ActionResult } from "@/lib/types";

export async function createBoard(projectId: string, input: { name: string; description?: string; columns: string[] }): Promise<ActionResult<string>> {
  const name = str(input.name, 120);
  if (!name) return fail("name_required");
  const columns = (input.columns ?? []).map((c) => str(c, 60)).filter(Boolean).slice(0, 20);
  const supabase = await getServerClient();
  const { data, error } = await supabase.rpc("create_board", {
    p_project: projectId, p_name: name, p_description: str(input.description, 2000), p_columns: columns,
  });
  if (error) return pgFail(error);
  revalidatePath("/", "layout");
  return ok(data as string);
}

export async function updateBoard(boardId: string, input: { name: string; description?: string }): Promise<ActionResult> {
  const name = str(input.name, 120);
  if (!isUuid(boardId)) return fail("not_found");
  if (!name) return fail("name_required");
  const supabase = await getServerClient();
  const { data, error } = await supabase.from("boards")
    .update({ name, description: str(input.description, 2000) }).eq("id", boardId).select("id");
  if (error) return pgFail(error);
  if (!data?.length) return fail("forbidden");
  revalidatePath("/", "layout");
  return ok(null);
}

export async function deleteBoard(boardId: string, confirmName: string): Promise<ActionResult> {
  const supabase = await getServerClient();
  const { data, error } = await supabase.rpc("delete_board", { p_board: boardId, p_confirm_name: confirmName });
  if (error) return pgFail(error);
  await removeStoragePaths((data as string[] | null) ?? []);
  revalidatePath("/", "layout");
  return ok(null);
}
