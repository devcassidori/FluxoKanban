"use client";
import { clsx } from "clsx";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowRightLeft, ArrowUp, ImageIcon, MoreHorizontal } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { DueBadge } from "@/components/due-badge";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { useI18n } from "@/lib/i18n/client";
import { dueStatus } from "@/lib/due";
import type { Card, Column, Profile } from "@/lib/types";

export interface CardTileProps {
  card: Card;
  done: boolean;
  assignee?: Profile;
  imageCount: number;
  columns: Column[];
  index: number;
  total: number;
  canWrite: boolean;
  dragDisabled: boolean;
  onOpen: () => void;
  onMove: (columnId: string, index: number) => void;
}

export function CardTile(props: CardTileProps) {
  const { card, canWrite, dragDisabled } = props;
  const sortable = useSortable({ id: `card:${card.id}`, data: { type: "card", columnId: card.column_id }, disabled: !canWrite || dragDisabled });
  const style = { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition };
  return (
    <li ref={sortable.setNodeRef} style={style} className={clsx("relative", sortable.isDragging && "opacity-40")}>
      <CardFace {...props} dragProps={{ ...sortable.attributes, ...sortable.listeners }} />
    </li>
  );
}

export function CardFace({ card, done, assignee, imageCount, columns, index, total, canWrite, onOpen, onMove, dragProps, overlay }: CardTileProps & {
  dragProps?: Record<string, unknown>; overlay?: boolean;
}) {
  const { t } = useI18n();
  const status = dueStatus(card.due_date, done);
  const moveItems: MenuItem[] = [
    { label: t("cards.moveUp"), icon: <ArrowUp />, disabled: index === 0, onSelect: () => onMove(card.column_id, index - 1) },
    { label: t("cards.moveDown"), icon: <ArrowDown />, disabled: index >= total - 1, onSelect: () => onMove(card.column_id, index + 1) },
    ...columns.filter((c) => c.id !== card.column_id).map((c) => ({
      label: `${t("cards.moveTo")} ${c.name}`, icon: <ArrowRightLeft />, onSelect: () => onMove(c.id, Number.MAX_SAFE_INTEGER),
    })),
  ];

  return (
    <div
      className={clsx(
        "group relative rounded-[var(--radius-card)] border bg-surface transition-[border-color,box-shadow] duration-150",
        "hover:border-line-strong",
        status === "overdue" ? "border-danger/35" : "border-line",
        overlay && "rotate-[1.5deg] shadow-[var(--shadow-lift)]",
      )}
    >
      {/* faixa lateral: o estado do prazo também vem em texto + ícone */}
      {(status === "overdue" || status === "soon") && (
        <span aria-hidden className={clsx("absolute inset-y-2 left-0 w-[3px] rounded-r-full", status === "overdue" ? "bg-danger" : "bg-soon")} />
      )}
      <button
        type="button"
        {...dragProps}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onOpen(); return; }
          (dragProps?.onKeyDown as ((e: React.KeyboardEvent) => void) | undefined)?.(e);
        }}
        aria-label={t("cards.open", { title: card.title })}
        aria-roledescription={canWrite ? "card" : undefined}
        className="block w-full touch-manipulation rounded-[var(--radius-card)] py-3 pl-3.5 pr-11 text-left focus-visible:outline-offset-[-2px]"
      >
        <span className={clsx("block text-[14.5px] font-medium leading-snug [overflow-wrap:anywhere]", done && "text-ink-2")}>{card.title}</span>
        {(card.due_date || assignee || imageCount > 0 || card.description_text) && (
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <DueBadge due={card.due_date} done={done} />
            {imageCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[12.5px] text-muted">
                <ImageIcon className="size-3.5" aria-hidden /><span className="sr-only">{t("cards.imageCount", { n: imageCount })}</span><span aria-hidden>{imageCount}</span>
              </span>
            )}
            {assignee && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] text-muted">
                <span className="sr-only">{t("cards.assignee")}: {assignee.name}</span>
                <Avatar name={assignee.name} url={assignee.avatar_url} size={22} />
              </span>
            )}
          </span>
        )}
      </button>
      {canWrite && !overlay && (
        <div className="absolute right-0.5 top-0.5">
          <Menu label={`${t("common.more")}: ${card.title}`} items={moveItems}
            trigger={(p) => (
              <button {...p} type="button" className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-sunken hover:text-ink">
                <MoreHorizontal className="size-4" aria-hidden />
              </button>
            )} />
        </div>
      )}
    </div>
  );
}
