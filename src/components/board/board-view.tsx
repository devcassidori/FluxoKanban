"use client";
import { clsx } from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  closestCenter, closestCorners, DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor,
  useSensor, useSensors, type Announcements, type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ChevronLeft, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useBoard, type BoardData } from "./use-board";
import { Lane } from "./lane";
import { CardFace } from "./card-tile";
import { CardDialog } from "./card-dialog";
import { ColumnNameDialog, DeleteColumnDialog } from "./column-dialogs";
import { FilterBar, NoResults } from "@/components/filter-bar";
import { NameDescriptionDialog } from "@/components/project-form-dialog";
import { Button, IconButton } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { EmptyState } from "@/components/ui/empty-state";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { errorKey } from "@/lib/i18n/dictionaries";
import { activeFilterCount, emptyFilters, matchesFilters, type CardFilters } from "@/lib/filters";
import { deleteBoard, updateBoard } from "@/app/actions/boards";
import type { Card, Column, Member, Profile, Project } from "@/lib/types";

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setMobile(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

export function BoardView({ initial, project, members, canWrite, canAdmin, canManageColumns }: {
  initial: BoardData; project: Project; members: Member[]; canWrite: boolean; canAdmin: boolean; canManageColumns: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const b = useBoard(initial);
  const mobile = useIsMobile();
  const [filters, setFilters] = useState<CardFilters>(emptyFilters);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const lastOpenCard = useRef<Card | null>(null);
  const [activeDrag, setActiveDrag] = useState<string | null>(null);
  const [mobileColumn, setMobileColumn] = useState<string | null>(null);
  const [naming, setNaming] = useState<{ column: Column | null } | null>(null);
  const [deleting, setDeleting] = useState<Column | null>(null);
  const [editingBoard, setEditingBoard] = useState(false);
  const dndId = useId();

  const profiles = useMemo(() => new Map<string, Profile>(members.map((m) => [m.user_id, m.profile])), [members]);
  const doneIds = useMemo(() => new Set(b.columns.filter((c) => c.is_done).map((c) => c.id)), [b.columns]);
  const filtering = activeFilterCount(filters) > 0;
  const visible = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const [col, list] of b.cardsByColumn) map.set(col, filtering ? list.filter((c) => matchesFilters(c, filters, (id) => doneIds.has(id))) : list);
    return map;
  }, [b.cardsByColumn, doneIds, filters, filtering]);
  const resultCount = [...visible.values()].reduce((n, l) => n + l.length, 0);

  const shownColumn = b.columns.find((c) => c.id === mobileColumn) ?? b.columns[0];
  const openCard = openCardId ? b.cards.find((c) => c.id === openCardId) ?? null : null;
  if (openCard) lastOpenCard.current = openCard;

  // abre card pelo link (?card=…), útil vindo da visão geral
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("card");
    if (id && b.cards.some((c) => c.id === id)) setOpenCardId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- arrastar e soltar (mouse, toque com pressão longa e teclado com Espaço) -----
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] } }),
  );
  const collision: CollisionDetection = (args) => {
    if (String(args.active.id).startsWith("col:")) {
      return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((d) => String(d.id).startsWith("col:")) });
    }
    return closestCorners(args);
  };
  const columnOf = (id: string) => (id.startsWith("col:") ? id.slice(4) : b.cards.find((c) => c.id === id.slice(5))?.column_id);
  const nameOfDrag = (id: string) => id.startsWith("col:") ? b.columns.find((c) => c.id === id.slice(4))?.name ?? "" : b.cards.find((c) => c.id === id.slice(5))?.title ?? "";

  const announcements: Announcements = {
    onDragStart: ({ active }) => `${nameOfDrag(String(active.id))}`,
    onDragOver: ({ over }) => (over ? b.columns.find((c) => c.id === columnOf(String(over.id)))?.name ?? "" : ""),
    onDragEnd: ({ active, over }) => (over ? t("cards.moved", { column: b.columns.find((c) => c.id === columnOf(String(over.id)))?.name ?? "" }) : nameOfDrag(String(active.id))),
    onDragCancel: ({ active }) => nameOfDrag(String(active.id)),
  };

  const onDragStart = (e: DragStartEvent) => setActiveDrag(String(e.active.id));

  const onDragOver = (e: DragOverEvent) => {
    const a = String(e.active.id);
    if (!a.startsWith("card:") || !e.over) return;
    const cardId = a.slice(5);
    const target = columnOf(String(e.over.id));
    const card = b.cards.find((c) => c.id === cardId);
    if (!card || !target || card.column_id === target) return;
    // mostra o card na nova coluna enquanto arrasta
    const list = b.cardsByColumn.get(target) ?? [];
    const overCard = String(e.over.id).startsWith("card:") ? list.find((c) => c.id === String(e.over!.id).slice(5)) : undefined;
    const position = overCard ? overCard.position - 0.001 : (list.at(-1)?.position ?? 0) + 1;
    b.setCards((l) => l.map((c) => (c.id === cardId ? { ...c, column_id: target, position } : c)));
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    const a = String(e.active.id);
    const o = e.over ? String(e.over.id) : null;
    if (!o) { void b.refetch(); return; }
    if (a.startsWith("col:")) {
      if (!o.startsWith("col:") || o === a) return;
      const newIndex = b.columns.findIndex((c) => c.id === o.slice(4));
      void b.moveColumn(a.slice(4), newIndex);
      return;
    }
    const cardId = a.slice(5);
    const col = columnOf(o);
    if (!col) return;
    const list = b.cardsByColumn.get(col) ?? [];
    const oldIndex = list.findIndex((c) => c.id === cardId);
    const newIndex = o.startsWith("card:") ? list.findIndex((c) => c.id === o.slice(5)) : list.length - 1;
    const reordered = oldIndex === -1 ? list : arrayMove(list, oldIndex, Math.max(0, newIndex));
    void b.moveCard(cardId, col, reordered.findIndex((c) => c.id === cardId));
  };

  const dragged = activeDrag?.startsWith("card:") ? b.cards.find((c) => c.id === activeDrag.slice(5)) : null;
  const draggedCol = activeDrag?.startsWith("col:") ? b.columns.find((c) => c.id === activeDrag.slice(4)) : null;

  const laneProps = (column: Column, index: number) => ({
    column, index, columns: b.columns,
    cards: visible.get(column.id) ?? [],
    totalCount: b.cardsByColumn.get(column.id)?.length ?? 0,
    profiles, imagesByCard: b.imagesByCard, canWrite, canManageColumns, canMarkDone: canAdmin,
    dragDisabled: filtering,
    onOpenCard: setOpenCardId,
    onMoveCard: (id: string, colId: string, idx: number) => void b.moveCard(id, colId, idx, { announce: true }),
    onAddCard: (colId: string, title: string) => void b.addCard(colId, title),
    onRename: (c: Column) => setNaming({ column: c }),
    onMoveColumn: (id: string, idx: number) => void b.moveColumn(id, idx),
    onToggleDone: (c: Column) => void b.updateColumn(c.id, { is_done: !c.is_done }),
    onDelete: (c: Column) => setDeleting(c),
  });

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-[560px] flex-col">
      <div className="border-b border-line px-4 pb-4 pt-4 sm:px-6">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Link href={`/projects/${project.id}`} className="inline-flex min-h-9 items-center gap-1 text-sm text-muted hover:text-ink">
              <ChevronLeft className="size-4" aria-hidden />{project.name}
            </Link>
            <h1 className="truncate text-[22px] font-semibold leading-tight sm:text-[24px]">{b.board.name}</h1>
            {b.board.description && <p className="mt-1 line-clamp-2 max-w-[70ch] text-sm text-muted">{b.board.description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1 pt-6">
            {canManageColumns && (
              <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setNaming({ column: null })} className="max-sm:hidden">{t("columns.new")}</Button>
            )}
            {canAdmin && (
              <Menu label={t("common.more")}
                trigger={(p) => <IconButton {...p} label={p["aria-label"] as string} variant="secondary"><MoreHorizontal className="size-5" aria-hidden /></IconButton>}
                items={[
                  { label: t("columns.new"), icon: <Plus />, hidden: !canManageColumns, onSelect: () => setNaming({ column: null }) },
                  { label: t("boards.edit"), icon: <Pencil />, onSelect: () => setEditingBoard(true) },
                  {
                    label: t("boards.delete"), icon: <Trash2 />, danger: true,
                    onSelect: async () => {
                      const yes = await confirm({
                        title: t("boards.delete"), danger: true, confirmLabel: t("boards.delete"),
                        body: t("boards.deleteBody", { name: b.board.name, cols: b.columns.length, cards: b.cards.length }),
                        typeToConfirm: b.board.name, typeLabel: t("boards.typeToConfirm", { name: b.board.name }),
                      });
                      if (!yes) return;
                      const res = await deleteBoard(b.board.id, b.board.name);
                      if (res.ok) router.push(`/projects/${project.id}`);
                      else toast({ kind: "error", message: t(errorKey(res.error)) });
                    },
                  },
                ]} />
            )}
          </div>
        </div>
        <div className="mt-4">
          <FilterBar value={filters} onChange={setFilters} resultCount={resultCount}
            columns={b.columns.map((c) => ({ id: c.id, label: c.name }))}
            assignees={members.map((m) => ({ id: m.user_id, label: m.active ? m.profile.name : `${m.profile.name} ${t("cards.inactiveAssignee")}` }))} />
        </div>
      </div>

      {b.columns.length === 0 ? (
        <EmptyState title={t("columns.empty")} body={canManageColumns ? undefined : t("boards.emptyMember")}
          action={canManageColumns && <Button variant="primary" onClick={() => setNaming({ column: null })}>{t("columns.new")}</Button>} />
      ) : filtering && resultCount === 0 ? (
        <NoResults onClear={() => setFilters(emptyFilters)} />
      ) : (
        <DndContext id={dndId} sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragOver={onDragOver}
          onDragEnd={onDragEnd} onDragCancel={() => { setActiveDrag(null); void b.refetch(); }}
          accessibility={{ announcements, screenReaderInstructions: { draggable: t("cards.dragHandle", { title: "" }) } }}>
          {mobile ? (
            // Celular: uma coluna por vez, troca pelas abas (sem rolagem horizontal da página)
            <div className="flex min-h-0 flex-1 flex-col">
              <div role="tablist" aria-label={t("columns.select")} className="flex gap-1.5 overflow-x-auto px-3 py-3 scrollbar-thin">
                {b.columns.map((c) => {
                  const selected = c.id === shownColumn?.id;
                  return (
                    <button key={c.id} role="tab" aria-selected={selected} aria-controls="mobile-lane" onClick={() => setMobileColumn(c.id)}
                      className={clsx("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm",
                        selected ? "border-accent bg-accent-soft font-medium text-accent" : "border-line-strong text-ink-2")}>
                      {c.name}<span className="tabular-nums opacity-70">{visible.get(c.id)?.length ?? 0}</span>
                    </button>
                  );
                })}
              </div>
              {shownColumn && (
                <div id="mobile-lane" role="tabpanel" className="flex min-h-0 flex-1 px-3 pb-6">
                  <Lane {...laneProps(shownColumn, b.columns.indexOf(shownColumn))} mobile />
                </div>
              )}
              {canManageColumns && (
                <div className="px-3 pb-6">
                  <Button className="w-full" icon={<Plus className="size-4" aria-hidden />} onClick={() => setNaming({ column: null })}>{t("columns.new")}</Button>
                </div>
              )}
            </div>
          ) : (
            <div className="relative min-h-0 flex-1 overflow-x-auto scrollbar-thin" tabIndex={-1}>
              <SortableContext items={b.columns.map((c) => `col:${c.id}`)} strategy={horizontalListSortingStrategy}>
                <div className="flex h-full items-start gap-3 p-4 sm:p-6">
                  {b.columns.map((c, i) => <Lane key={c.id} {...laneProps(c, i)} />)}
                  {canManageColumns && (
                    <button onClick={() => setNaming({ column: null })}
                      className="flex min-h-12 w-[260px] shrink-0 items-center gap-2 rounded-[var(--radius-lane)] border border-dashed border-line-strong px-4 text-sm font-medium text-ink-2 hover:border-accent hover:text-accent">
                      <Plus className="size-4" aria-hidden />{t("columns.new")}
                    </button>
                  )}
                </div>
              </SortableContext>
            </div>
          )}
          <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.2,0.8,0.2,1)" }}>
            {dragged ? (
              <div className="w-[284px]">
                <CardFace card={dragged} done={doneIds.has(dragged.column_id)} assignee={dragged.assignee_id ? profiles.get(dragged.assignee_id) : undefined}
                  imageCount={b.imagesByCard.get(dragged.id)?.length ?? 0} columns={b.columns} index={0} total={1}
                  canWrite={false} dragDisabled onOpen={() => undefined} onMove={() => undefined} overlay />
              </div>
            ) : draggedCol ? (
              <div className="w-[300px] rounded-[var(--radius-lane)] bg-sunken p-3 text-[14.5px] font-semibold shadow-[var(--shadow-lift)]">{draggedCol.name}</div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {openCardId && lastOpenCard.current && (
        <CardDialog
          key={openCardId}
          card={openCard ?? lastOpenCard.current}
          deleted={!openCard}
          columns={b.columns}
          members={members}
          images={b.imagesByCard.get(openCardId) ?? []}
          canWrite={canWrite}
          onClose={() => { setOpenCardId(null); lastOpenCard.current = null; }}
          onSaved={b.upsertCard}
          onMove={(colId) => void b.moveCard(openCardId, colId, Number.MAX_SAFE_INTEGER, { announce: true })}
          onDelete={() => b.deleteCard(openCardId)}
          onImagesChange={(fn) => b.setImages((all) => {
            const mine = all.filter((i) => i.card_id === openCardId);
            return [...all.filter((i) => i.card_id !== openCardId), ...fn(mine)];
          })}
        />
      )}

      <ColumnNameDialog
        open={!!naming}
        column={naming?.column ?? null}
        existing={b.columns}
        onClose={() => setNaming(null)}
        onSubmit={(name) => {
          if (naming?.column) void b.updateColumn(naming.column.id, { name });
          else void b.addColumn(name);
          setNaming(null);
        }}
      />
      {deleting && (
        <DeleteColumnDialog column={deleting} columns={b.columns} cardCount={b.cardsByColumn.get(deleting.id)?.length ?? 0}
          onClose={() => setDeleting(null)} onConfirm={(target) => b.deleteColumn(deleting.id, target)} />
      )}
      <NameDescriptionDialog
        open={editingBoard}
        onClose={() => setEditingBoard(false)}
        title={t("boards.edit")}
        submitLabel={t("common.save")}
        initial={{ name: b.board.name, description: b.board.description }}
        onSubmit={(v) => updateBoard(b.board.id, v)}
        onDone={() => { setEditingBoard(false); router.refresh(); }}
      />
    </div>
  );
}
