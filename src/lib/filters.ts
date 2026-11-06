import { dueStatus, type DueOptions } from "./due.ts";

export type DueFilter = "overdue" | "soon" | "none";

export interface CardFilters {
  q: string;
  columnIds: string[];
  /** ids de perfil ou "none" (sem responsável) */
  assignees: string[];
  due: DueFilter[];
  from: string;
  to: string;
  projectIds: string[];
  boardIds: string[];
}

export const emptyFilters: CardFilters = {
  q: "", columnIds: [], assignees: [], due: [], from: "", to: "", projectIds: [], boardIds: [],
};

export interface FilterableCard {
  title: string;
  description_text: string;
  column_id: string;
  assignee_id: string | null;
  due_date: string | null;
  project_id: string;
  board_id: string;
}

export function normalize(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Critérios diferentes combinam com E; valores do mesmo critério com OU. */
export function matchesFilters(
  card: FilterableCard,
  f: CardFilters,
  isDoneColumn: (columnId: string) => boolean,
  dueOpts?: DueOptions,
): boolean {
  if (f.q.trim()) {
    const terms = normalize(f.q).split(/\s+/).filter(Boolean);
    const hay = normalize(`${card.title} ${card.description_text}`);
    if (!terms.every((t) => hay.includes(t))) return false;
  }
  if (f.projectIds.length && !f.projectIds.includes(card.project_id)) return false;
  if (f.boardIds.length && !f.boardIds.includes(card.board_id)) return false;
  if (f.columnIds.length && !f.columnIds.includes(card.column_id)) return false;
  if (f.assignees.length) {
    const key = card.assignee_id ?? "none";
    if (!f.assignees.includes(key)) return false;
  }
  if (f.due.length) {
    const status = dueStatus(card.due_date, isDoneColumn(card.column_id), dueOpts);
    const ok = f.due.some((d) =>
      d === "none" ? !card.due_date : d === status);
    if (!ok) return false;
  }
  if (f.from && (!card.due_date || card.due_date < f.from)) return false;
  if (f.to && (!card.due_date || card.due_date > f.to)) return false;
  return true;
}

export function activeFilterCount(f: CardFilters) {
  return (f.q.trim() ? 1 : 0) + f.columnIds.length + f.assignees.length + f.due.length
    + (f.from ? 1 : 0) + (f.to ? 1 : 0) + f.projectIds.length + f.boardIds.length;
}
