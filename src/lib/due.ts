import { appConfig } from "./config.ts";

export type DueStatus = "none" | "ok" | "soon" | "overdue" | "done";

/** Data de hoje (AAAA-MM-DD) no fuso configurado. Prazos são datas sem horário. */
export function todayISO(timeZone: string = appConfig.timeZone, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

function toUTC(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Dias de `from` até `to` (positivo se `to` é depois). */
export function daysUntil(from: string, to: string) {
  return Math.round((toUTC(to) - toUTC(from)) / 86_400_000);
}

export interface DueOptions {
  today?: string;
  soonDays?: number;
  includesDueDate?: boolean;
}

/**
 * - Coluna concluída: nunca alerta.
 * - "vencida": a partir do dia seguinte ao vencimento.
 * - "vence em breve": de N dias antes até a véspera; o próprio dia do
 *   vencimento depende de `includesDueDate` (validação pendente).
 */
export function dueStatus(dueDate: string | null | undefined, inDoneColumn: boolean, opts: DueOptions = {}): DueStatus {
  if (inDoneColumn) return "done";
  if (!dueDate) return "none";
  const today = opts.today ?? todayISO();
  const soonDays = opts.soonDays ?? appConfig.dueSoonDays;
  const includesDueDate = opts.includesDueDate ?? appConfig.dueSoonIncludesDueDate;
  const diff = daysUntil(today, dueDate);
  if (diff < 0) return "overdue";
  if (diff === 0) return includesDueDate ? "soon" : "ok";
  if (diff <= soonDays) return "soon";
  return "ok";
}
