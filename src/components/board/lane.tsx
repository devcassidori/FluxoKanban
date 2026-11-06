"use client";
import { clsx } from "clsx";
import { useState } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, GripVertical, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Menu } from "@/components/ui/menu";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { CardTile } from "./card-tile";
import type { Card, CardImage, Column, Profile } from "@/lib/types";

export interface LaneProps {
  column: Column;
  index: number;
  columns: Column[];
  cards: Card[];
  /** total na coluna, sem filtros */
  totalCount: number;
  profiles: Map<string, Profile>;
  imagesByCard: Map<string, CardImage[]>;
  canWrite: boolean;
  canManageColumns: boolean;
  canMarkDone: boolean;
  dragDisabled: boolean;
  mobile?: boolean;
  onOpenCard: (id: string) => void;
  onMoveCard: (id: string, columnId: string, index: number) => void;
  onAddCard: (columnId: string, title: string) => void;
  onRename: (column: Column) => void;
  onMoveColumn: (id: string, index: number) => void;
  onToggleDone: (column: Column) => void;
  onDelete: (column: Column) => void;
}

export function Lane(p: LaneProps) {
  const { t } = useI18n();
  const { column } = p;
  const sortable = useSortable({ id: `col:${column.id}`, data: { type: "column" }, disabled: !p.canManageColumns || p.dragDisabled || p.mobile });
  const style = { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition };
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const headingId = `lane-${column.id}`;

  const submit = () => {
    if (!title.trim()) return;
    p.onAddCard(column.id, title.trim());
    setTitle("");
  };

  return (
    <section
      ref={sortable.setNodeRef}
      style={style}
      aria-labelledby={headingId}
      className={clsx(
        "relative flex max-h-full flex-col rounded-[var(--radius-lane)] bg-sunken/80",
        p.mobile ? "w-full" : "w-[300px] shrink-0",
        sortable.isDragging && "opacity-50",
      )}
    >
      <header className={clsx("flex items-center gap-1 rounded-t-[var(--radius-lane)] px-2 pt-2", column.is_done && "text-done")}>
        {p.canManageColumns && !p.mobile && !p.dragDisabled && (
          <button {...sortable.attributes} {...sortable.listeners} aria-label={t("columns.dragHandle", { name: column.name })}
            className="inline-flex h-11 w-7 cursor-grab touch-none items-center justify-center rounded-md text-muted hover:bg-line/60 active:cursor-grabbing">
            <GripVertical className="size-4" aria-hidden />
          </button>
        )}
        <h2 id={headingId} className="flex min-w-0 flex-1 items-center gap-2 pl-1.5 text-[14.5px] font-semibold text-ink">
          {column.is_done && <CheckCircle2 className="size-4 shrink-0 text-done" aria-hidden />}
          <span className="truncate">{column.name}</span>
          <span className="shrink-0 font-normal tabular-nums text-muted" aria-label={t("columns.count", { n: p.totalCount })}>
            {p.cards.length !== p.totalCount ? `${p.cards.length}/${p.totalCount}` : p.totalCount}
          </span>
          {column.is_done && <span className="sr-only">({t("columns.doneBadge")})</span>}
        </h2>
        {p.canManageColumns && (
          <Menu label={`${t("common.actions")}: ${column.name}`}
            trigger={(tp) => (
              <button {...tp} type="button" className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-line/60 hover:text-ink">
                <MoreHorizontal className="size-4" aria-hidden />
              </button>
            )}
            items={[
              { label: t("columns.rename"), icon: <Pencil />, onSelect: () => p.onRename(column) },
              { label: t("columns.moveLeft"), icon: <ArrowLeft />, disabled: p.index === 0, onSelect: () => p.onMoveColumn(column.id, p.index - 1) },
              { label: t("columns.moveRight"), icon: <ArrowRight />, disabled: p.index >= p.columns.length - 1, onSelect: () => p.onMoveColumn(column.id, p.index + 1) },
              { label: column.is_done ? t("columns.unmarkDone") : t("columns.markDone"), icon: column.is_done ? <Circle /> : <CheckCircle2 />, hidden: !p.canMarkDone, onSelect: () => p.onToggleDone(column) },
              { label: t("columns.delete"), icon: <Trash2 />, danger: true, onSelect: () => p.onDelete(column) },
            ]} />
        )}
      </header>

      <SortableContext items={p.cards.map((c) => `card:${c.id}`)} strategy={verticalListSortingStrategy}>
        <ol className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 pt-2 scrollbar-thin" aria-labelledby={headingId}>
          {p.cards.map((card, i) => (
            <CardTile
              key={card.id}
              card={card}
              index={i}
              total={p.cards.length}
              done={column.is_done}
              assignee={card.assignee_id ? p.profiles.get(card.assignee_id) : undefined}
              imageCount={p.imagesByCard.get(card.id)?.length ?? 0}
              columns={p.columns}
              canWrite={p.canWrite}
              dragDisabled={p.dragDisabled}
              onOpen={() => p.onOpenCard(card.id)}
              onMove={(colId, idx) => p.onMoveCard(card.id, colId, idx)}
            />
          ))}
          {p.cards.length === 0 && (
            <li className="flex min-h-16 items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line-strong text-sm text-muted">
              {t("columns.empty")}
            </li>
          )}
        </ol>
      </SortableContext>

      {p.canWrite && (
        <div className="px-2 pb-2">
          {composing ? (
            <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="rounded-[var(--radius-card)] border border-line bg-surface p-2">
              <label htmlFor={`new-${column.id}`} className="sr-only">{t("cards.titlePlaceholder")}</label>
              <textarea
                id={`new-${column.id}`}
                autoFocus
                rows={2}
                maxLength={200}
                value={title}
                placeholder={t("cards.titlePlaceholder")}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
                  if (e.key === "Escape") { setComposing(false); setTitle(""); }
                }}
                className="block w-full resize-none bg-transparent px-1.5 py-1 text-[14.5px] outline-none placeholder:text-muted"
              />
              <div className="mt-1 flex gap-2">
                <Button type="submit" size="sm" variant="primary" disabled={!title.trim()}>{t("cards.new")}</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setComposing(false); setTitle(""); }}>{t("common.cancel")}</Button>
              </div>
            </form>
          ) : (
            <button onClick={() => setComposing(true)}
              className="flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-medium text-ink-2 hover:bg-line/60 hover:text-ink">
              <Plus className="size-4" aria-hidden />{t("cards.new")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
