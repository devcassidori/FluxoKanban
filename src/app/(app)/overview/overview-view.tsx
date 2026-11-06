"use client";
import { clsx } from "clsx";
import Link from "next/link";
import { useMemo, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { FilterBar, NoResults } from "@/components/filter-bar";
import { DueBadge } from "@/components/due-badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/lib/i18n/client";
import { dueStatus } from "@/lib/due";
import { emptyFilters, matchesFilters, type CardFilters } from "@/lib/filters";
import type { Profile } from "@/lib/types";

export interface OverviewCard {
  id: string; title: string; description_text: string; column_id: string; assignee_id: string | null;
  due_date: string | null; project_id: string; board_id: string; updated_at: string;
}

export function OverviewView({ projects, boards, columns, cards, profiles }: {
  projects: { id: string; name: string }[];
  boards: { id: string; name: string; project_id: string }[];
  columns: { id: string; name: string; is_done: boolean; board_id: string }[];
  cards: OverviewCard[];
  profiles: Profile[];
}) {
  const { t } = useI18n();
  const [filters, setFilters] = useState<CardFilters>(emptyFilters);
  const colMap = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const boardMap = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const isDone = (id: string) => !!colMap.get(id)?.is_done;

  // Ordem: vencidas, depois por prazo mais próximo, depois sem prazo.
  const rank = (c: OverviewCard) => {
    const s = dueStatus(c.due_date, isDone(c.column_id));
    return s === "overdue" ? 0 : s === "soon" ? 1 : s === "done" ? 4 : c.due_date ? 2 : 3;
  };
  const results = useMemo(() => cards
    .filter((c) => matchesFilters(c, filters, isDone))
    .sort((a, b) => rank(a) - rank(b) || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || b.updated_at.localeCompare(a.updated_at)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [cards, filters, colMap]);

  const stats = useMemo(() => {
    let done = 0, overdue = 0, soon = 0;
    for (const c of results) {
      const s = dueStatus(c.due_date, isDone(c.column_id));
      if (s === "done") done++; else if (s === "overdue") overdue++; else if (s === "soon") soon++;
    }
    return { total: results.length, done, open: results.length - done, overdue, soon };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  const visibleBoards = filters.projectIds.length ? boards.filter((b) => filters.projectIds.includes(b.project_id)) : boards;
  const columnOptions = columns
    .filter((c) => !filters.boardIds.length || filters.boardIds.includes(c.board_id))
    .filter((c) => visibleBoards.some((b) => b.id === c.board_id))
    .map((c) => ({ id: c.id, label: `${boardMap.get(c.board_id)?.name ?? ""} › ${c.name}` }));

  return (
    <div className="pb-16">
      <PageHeader title={t("overview.title")} description={t("overview.subtitle")} />
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        {cards.length === 0 ? (
          <EmptyState icon={<LayoutGrid className="size-6" />} title={t("overview.empty")} />
        ) : (
          <>
            <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lane)] border border-line bg-line sm:grid-cols-4">
              {[
                { label: t("overview.stats.open"), value: stats.open, tone: "" },
                { label: t("overview.group.overdue"), value: stats.overdue, tone: stats.overdue ? "text-danger" : "" },
                { label: t("overview.group.soon"), value: stats.soon, tone: stats.soon ? "text-soon" : "" },
                { label: t("overview.stats.done"), value: stats.done, tone: "" },
              ].map((s) => (
                <div key={s.label} className="bg-surface px-5 py-4">
                  <dt className="text-sm text-muted">{s.label}</dt>
                  <dd className={clsx("mt-0.5 text-[26px] font-semibold tabular-nums", s.tone)}>{s.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6">
              <FilterBar value={filters} onChange={setFilters} resultCount={results.length}
                projects={projects.map((p) => ({ id: p.id, label: p.name }))}
                boards={visibleBoards.map((b) => ({ id: b.id, label: `${projectMap.get(b.project_id)?.name ?? ""} › ${b.name}` }))}
                columns={columnOptions}
                assignees={profiles.map((p) => ({ id: p.id, label: p.name }))} />
            </div>

            {results.length === 0 ? <NoResults onClear={() => setFilters(emptyFilters)} /> : (
              <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[var(--radius-lane)] border border-line bg-surface">
                {results.slice(0, 500).map((c) => {
                  const col = colMap.get(c.column_id);
                  const board = boardMap.get(c.board_id);
                  const assignee = c.assignee_id ? profileMap.get(c.assignee_id) : undefined;
                  return (
                    <li key={c.id}>
                      <Link href={`/projects/${c.project_id}/boards/${c.board_id}?card=${c.id}`}
                        className="grid gap-x-4 gap-y-1.5 px-5 py-3.5 hover:bg-paper/60 sm:grid-cols-[minmax(0,1fr)_180px_150px_32px] sm:items-center focus-visible:-outline-offset-2">
                        <span className="min-w-0">
                          <span className={clsx("block truncate font-medium", col?.is_done && "text-ink-2")}>{c.title}</span>
                          <span className="block truncate text-[13px] text-muted">{projectMap.get(c.project_id)?.name} › {board?.name}</span>
                        </span>
                        <span className="flex items-center gap-2 text-sm text-ink-2">
                          <span className={clsx("size-2 shrink-0 rounded-full", col?.is_done ? "bg-done" : "bg-line-strong")} aria-hidden />
                          <span className="truncate">{col?.name}</span>
                        </span>
                        <span><DueBadge due={c.due_date} done={!!col?.is_done} /></span>
                        <span className="max-sm:hidden">
                          {assignee ? <><span className="sr-only">{t("cards.assignee")}: {assignee.name}</span><Avatar name={assignee.name} url={assignee.avatar_url} size={26} /></> : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
