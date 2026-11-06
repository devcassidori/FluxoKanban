import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import type { ActionResult } from "./types";

const APP_CODE = /^[a-z_]+$/;

/** Converte erros do Postgres/Supabase em códigos estáveis para o front traduzir. */
export function pgFail(err: PostgrestError | { message?: string; code?: string; details?: string } | null): { ok: false; error: string; detail?: string } {
  if (!err) return { ok: false, error: "generic" };
  const msg = err.message ?? "";
  // aparece nos logs do servidor (Vercel → Logs) para diagnóstico
  console.error("[db]", err.code ?? "", msg, err.details ?? "");
  // função/tabela inexistente: migrações não aplicadas no Supabase
  if (err.code === "PGRST202" || err.code === "42883" || err.code === "PGRST205" || err.code === "42P01") return { ok: false, error: "db_outdated", detail: msg };
  if (err.code === "P0001" && APP_CODE.test(msg)) return { ok: false, error: msg, detail: err.details || undefined };
  if (err.code === "42501" || /row-level security|permission denied/i.test(msg)) return { ok: false, error: "forbidden" };
  if (err.code === "23514") return { ok: false, error: /name|title/.test(msg) ? "name_required" : "too_long" };
  if (err.code === "23503" && /owner_id|profiles|user_id/.test(msg + (err.details ?? ""))) return { ok: false, error: "profile_missing", detail: msg };
  if (err.code === "23503") return { ok: false, error: "not_found" };
  if (err.code === "PGRST116") return { ok: false, error: "not_found" };
  return { ok: false, error: "generic", detail: [err.code, msg].filter(Boolean).join(": ").slice(0, 200) };
}

export const ok = <T,>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: string, detail?: string): { ok: false; error: string; detail?: string } => ({ ok: false, error, detail });

export function str(v: unknown, max: number) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
