"use client";
import { clsx } from "clsx";
import { Filter, Search, X } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "./ui/button";
import { useI18n } from "@/lib/i18n/client";
import { activeFilterCount, emptyFilters, type CardFilters, type DueFilter } from "@/lib/filters";

interface Option { id: string; label: string }

export function FilterBar({ value, onChange, columns, assignees, projects, boards, resultCount }: {
  value: CardFilters;
  onChange: (f: CardFilters) => void;
  columns?: Option[];
  assignees: Option[];
  projects?: Option[];
  boards?: Option[];
  resultCount: number;
}) {
  const { t, formatDate } = useI18n();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const count = activeFilterCount({ ...value, q: "" });

  const toggle = <K extends "columnIds" | "assignees" | "due" | "projectIds" | "boardIds">(key: K, id: string) => {
    const list = value[key] as string[];
    onChange({ ...value, [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
  };

  const assigneeOpts: Option[] = [{ id: "none", label: t("cards.unassigned") }, ...assignees];
  const dueOpts: { id: DueFilter; label: string }[] = [
    { id: "overdue", label: t("filters.due.overdue") }, { id: "soon", label: t("filters.due.soon") }, { id: "none", label: t("filters.due.none") },
  ];

  const chips: { key: string; label: string; remove: () => void }[] = [];
  const nameOf = (opts: Option[] | undefined, id: string) => opts?.find((o) => o.id === id)?.label ?? id;
  value.projectIds.forEach((id) => chips.push({ key: `p${id}`, label: `${t("filters.project")}: ${nameOf(projects, id)}`, remove: () => toggle("projectIds", id) }));
  value.boardIds.forEach((id) => chips.push({ key: `b${id}`, label: `${t("filters.board")}: ${nameOf(boards, id)}`, remove: () => toggle("boardIds", id) }));
  value.columnIds.forEach((id) => chips.push({ key: `c${id}`, label: `${t("filters.column")}: ${nameOf(columns, id)}`, remove: () => toggle("columnIds", id) }));
  value.assignees.forEach((id) => chips.push({ key: `a${id}`, label: `${t("filters.assignee")}: ${nameOf(assigneeOpts, id)}`, remove: () => toggle("assignees", id) }));
  value.due.forEach((id) => chips.push({ key: `d${id}`, label: `${t("filters.due")}: ${nameOf(dueOpts, id)}`, remove: () => toggle("due", id) }));
  if (value.from) chips.push({ key: "from", label: `${t("filters.from")} ${formatDate(value.from)}`, remove: () => onChange({ ...value, from: "" }) });
  if (value.to) chips.push({ key: "to", label: `${t("filters.to")} ${formatDate(value.to)}`, remove: () => onChange({ ...value, to: "" }) });
  if (value.q.trim()) chips.unshift({ key: "q", label: `“${value.q.trim()}”`, remove: () => onChange({ ...value, q: "" }) });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" className="field pl-9" placeholder={t("filters.search")} aria-label={t("filters.search")}
            value={value.q} onChange={(e) => onChange({ ...value, q: e.target.value })} />
        </div>
        <Button aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}
          icon={<Filter className="size-4" aria-hidden />} className={clsx(count > 0 && "border-accent text-accent")}>
          {t("filters.open")}{count > 0 && <span className="rounded-full bg-accent px-1.5 text-[12px] tabular-nums text-accent-ink">{count}</span>}
        </Button>
      </div>

      {open && (
        <div id={panelId} className="mt-3 grid gap-5 rounded-[var(--radius-lane)] border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects && projects.length > 1 && <Group legend={t("filters.project")} options={projects} selected={value.projectIds} onToggle={(id) => toggle("projectIds", id)} />}
          {boards && boards.length > 1 && <Group legend={t("filters.board")} options={boards} selected={value.boardIds} onToggle={(id) => toggle("boardIds", id)} />}
          {columns && <Group legend={t("filters.column")} options={columns} selected={value.columnIds} onToggle={(id) => toggle("columnIds", id)} />}
          <Group legend={t("filters.assignee")} options={assigneeOpts} selected={value.assignees} onToggle={(id) => toggle("assignees", id)} />
          <Group legend={t("filters.due")} options={dueOpts} selected={value.due} onToggle={(id) => toggle("due", id)}>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-[13px] text-muted">{t("filters.from")}
                <input type="date" className="field mt-1" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} />
              </label>
              <label className="text-[13px] text-muted">{t("filters.to")}
                <input type="date" className="field mt-1" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} />
              </label>
            </div>
          </Group>
        </div>
      )}

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-label={t("filters.active")} role="group">
          {chips.map((c) => (
            <span key={c.key} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-line-strong bg-surface pl-3 text-[13px]">
              <span className="max-w-[16rem] truncate">{c.label}</span>
              <button onClick={c.remove} aria-label={t("filters.remove", { label: c.label })}
                className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-sunken hover:text-ink">
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          ))}
          <button onClick={() => onChange(emptyFilters)} className="min-h-9 rounded-full px-3 text-[13px] font-medium text-accent hover:underline">
            {t("filters.clear")}
          </button>
          <span className="ml-auto text-[13px] tabular-nums text-muted" role="status">{t("filters.results", { n: resultCount })}</span>
        </div>
      )}
    </div>
  );
}

function Group({ legend, options, selected, onToggle, children }: {
  legend: string; options: Option[]; selected: string[]; onToggle: (id: string) => void; children?: React.ReactNode;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-sm font-medium text-ink-2">{legend}</legend>
      <div className="max-h-48 overflow-y-auto scrollbar-thin">
        {options.map((o) => (
          <label key={o.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 text-[14.5px] hover:bg-sunken">
            <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={selected.includes(o.id)} onChange={() => onToggle(o.id)} />
            <span className="truncate">{o.label}</span>
          </label>
        ))}
      </div>
      {children}
    </fieldset>
  );
}

export function NoResults({ onClear }: { onClear: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center" role="status">
      <Search className="size-6 text-muted" aria-hidden />
      <p className="text-[15px] text-ink-2">{t("filters.noResults")}</p>
      <Button onClick={onClear}>{t("filters.clear")}</Button>
    </div>
  );
}
