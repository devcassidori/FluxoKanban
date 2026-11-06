"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getBrowserClient } from "@/lib/supabase/client";
import { useSync } from "@/lib/sync";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { errorKey } from "@/lib/i18n/dictionaries";
import { byPosition, positionAt, STEP } from "@/lib/position";
import { deleteCard as deleteCardAction, deleteColumn as deleteColumnAction } from "@/app/actions/board-content";
import type { Board, Card, CardImage, Column } from "@/lib/types";

export interface BoardData { board: Board; columns: Column[]; cards: Card[]; images: CardImage[] }

const CARD_FIELDS = "id, board_id, project_id, column_id, title, description, description_text, assignee_id, due_date, position, version, created_at, updated_at, updated_by";

function upsert<T extends { id: string }>(list: T[], row: T) {
  const i = list.findIndex((x) => x.id === row.id);
  if (i === -1) return [...list, row];
  const copy = [...list]; copy[i] = row; return copy;
}

export function useBoard(initial: BoardData) {
  const [board, setBoard] = useState(initial.board);
  const [columns, setColumns] = useState(initial.columns);
  const [cards, setCards] = useState(initial.cards);
  const [images, setImages] = useState(initial.images);
  const { perform, setRealtime, onFlushError, onFlushed } = useSync();
  const { toast, announce } = useToast();
  const { t } = useI18n();
  const supabase = getBrowserClient();
  const boardId = initial.board.id;
  const projectId = initial.board.project_id;
  const hadError = useRef(false);

  const sortedColumns = useMemo(() => [...columns].sort(byPosition), [columns]);
  const cardsByColumn = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const c of sortedColumns) map.set(c.id, []);
    for (const card of cards) map.get(card.column_id)?.push(card);
    for (const list of map.values()) list.sort(byPosition);
    return map;
  }, [cards, sortedColumns]);
  const imagesByCard = useMemo(() => {
    const map = new Map<string, CardImage[]>();
    for (const img of images) map.set(img.card_id, [...(map.get(img.card_id) ?? []), img]);
    return map;
  }, [images]);

  const fail = useCallback((code: string) => toast({ kind: "error", message: t(errorKey(code)) }), [t, toast]);

  // Recarrega tudo do servidor (após reconectar, para recuperar eventos perdidos).
  const refetch = useCallback(async () => {
    const [b, cols, cs, imgs] = await Promise.all([
      supabase.from("boards").select("*").eq("id", boardId).maybeSingle(),
      supabase.from("board_columns").select("id, board_id, project_id, name, position, is_done").eq("board_id", boardId),
      supabase.from("cards").select(CARD_FIELDS).eq("board_id", boardId),
      supabase.from("card_images").select("id, card_id, project_id, path, mime, size_bytes, created_at, cards!inner(board_id)").eq("cards.board_id", boardId),
    ]);
    if (b.data) setBoard(b.data as Board);
    if (cols.data) setColumns(cols.data as Column[]);
    if (cs.data) setCards(cs.data as Card[]);
    if (imgs.data) setImages((imgs.data as unknown as (CardImage & { cards: unknown })[]).map(({ cards: _c, ...img }) => img));
  }, [boardId, supabase]);

  useEffect(() => onFlushError((code) => { fail(code); void refetch(); }), [onFlushError, fail, refetch]);
  useEffect(() => onFlushed(() => { toast({ kind: "success", message: t("sync.reconnected") }); void refetch(); }), [onFlushed, refetch, t, toast]);

  // Tempo real: o Supabase só entrega linhas que a pessoa pode ler (RLS).
  useEffect(() => {
    setRealtime("connecting");
    const onCard = (p: RealtimePostgresChangesPayload<Card>) => {
      if (p.eventType === "DELETE") { const id = (p.old as Partial<Card>).id; if (id) setCards((l) => l.filter((c) => c.id !== id)); return; }
      const row = p.new as Card;
      if (row.board_id !== boardId) return;
      setCards((l) => {
        const cur = l.find((c) => c.id === row.id);
        if (cur && cur.updated_at > row.updated_at) return l;
        return upsert(l, row);
      });
    };
    const onColumn = (p: RealtimePostgresChangesPayload<Column>) => {
      if (p.eventType === "DELETE") { const id = (p.old as Partial<Column>).id; if (id) setColumns((l) => l.filter((c) => c.id !== id)); return; }
      const row = p.new as Column;
      if (row.board_id === boardId) setColumns((l) => upsert(l, row));
    };
    const onImage = (p: RealtimePostgresChangesPayload<CardImage>) => {
      if (p.eventType === "DELETE") { const id = (p.old as Partial<CardImage>).id; if (id) setImages((l) => l.filter((c) => c.id !== id)); return; }
      const row = p.new as CardImage;
      setImages((l) => upsert(l, row));
    };

    const channel = supabase.channel(`board:${boardId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cards", filter: `board_id=eq.${boardId}` }, onCard)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cards", filter: `board_id=eq.${boardId}` }, onCard)
      // eventos DELETE não aceitam filtro; só trazem o id
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "cards" }, onCard)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "board_columns", filter: `board_id=eq.${boardId}` }, onColumn)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "board_columns", filter: `board_id=eq.${boardId}` }, onColumn)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "board_columns" }, onColumn)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "card_images", filter: `project_id=eq.${projectId}` }, onImage)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "card_images" }, onImage)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "boards", filter: `id=eq.${boardId}` },
        (p: RealtimePostgresChangesPayload<Board>) => setBoard(p.new as Board))
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          setRealtime("live");
          if (hadError.current) { hadError.current = false; void refetch(); }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          hadError.current = true;
          setRealtime("error");
        }
      });
    return () => { void supabase.removeChannel(channel); setRealtime("idle"); };
  }, [boardId, projectId, refetch, setRealtime, supabase]);

  // ----- operações --------------------------------------------------------
  const addCard = useCallback(async (columnId: string, title: string) => {
    const list = cardsByColumn.get(columnId) ?? [];
    const position = (list[list.length - 1]?.position ?? 0) + STEP;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const optimistic: Card = {
      id, board_id: boardId, project_id: projectId, column_id: columnId, title: title.trim(), description: "", description_text: "",
      assignee_id: null, due_date: null, position, version: 1, created_at: now, updated_at: now, updated_by: null,
    };
    setCards((l) => [...l, optimistic]);
    const res = await perform("createCard", { id, board_id: boardId, column_id: columnId, title, position });
    if ("queued" in res) return;
    if (res.ok) setCards((l) => upsert(l, res.data));
    else { setCards((l) => l.filter((c) => c.id !== id)); fail(res.error); }
  }, [boardId, cardsByColumn, fail, perform, projectId]);

  /** Move o card para `index` dentro da coluna (lista sem o próprio card). */
  const moveCard = useCallback(async (cardId: string, columnId: string, index: number, opts?: { announce?: boolean }) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const others = (cardsByColumn.get(columnId) ?? []).filter((c) => c.id !== cardId);
    const position = positionAt(others, Math.max(0, Math.min(index, others.length)));
    if (card.column_id === columnId && card.position === position) return;
    const before = card;
    setCards((l) => l.map((c) => (c.id === cardId ? { ...c, column_id: columnId, position } : c)));
    if (opts?.announce) {
      const col = columns.find((c) => c.id === columnId);
      announce(t("cards.moved", { column: col?.name ?? "" }));
    }
    const res = await perform("moveCard", cardId, columnId, position);
    if ("queued" in res) return;
    if (res.ok) setCards((l) => upsert(l, res.data));
    else { setCards((l) => upsert(l, before)); fail(res.error); void refetch(); }
  }, [announce, cards, cardsByColumn, columns, fail, perform, refetch, t]);

  const addColumn = useCallback(async (name: string) => {
    const id = crypto.randomUUID();
    const position = (sortedColumns[sortedColumns.length - 1]?.position ?? 0) + STEP;
    const optimistic: Column = { id, board_id: boardId, project_id: projectId, name: name.trim(), position, is_done: false };
    setColumns((l) => [...l, optimistic]);
    const res = await perform("createColumn", { id, board_id: boardId, name, position });
    if ("queued" in res) return;
    if (res.ok) setColumns((l) => upsert(l, res.data));
    else { setColumns((l) => l.filter((c) => c.id !== id)); fail(res.error); }
  }, [boardId, fail, perform, projectId, sortedColumns]);

  const updateColumn = useCallback(async (id: string, patch: Partial<Pick<Column, "name" | "position" | "is_done">>) => {
    const before = columns.find((c) => c.id === id);
    if (!before) return;
    setColumns((l) => l.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const res = await perform("updateColumn", id, patch);
    if ("queued" in res) return;
    if (res.ok) setColumns((l) => upsert(l, res.data));
    else { setColumns((l) => upsert(l, before)); fail(res.error); }
  }, [columns, fail, perform]);

  const moveColumn = useCallback((id: string, index: number) => {
    const others = sortedColumns.filter((c) => c.id !== id);
    const position = positionAt(others, Math.max(0, Math.min(index, others.length)));
    return updateColumn(id, { position });
  }, [sortedColumns, updateColumn]);

  /** Exclusão é atômica no servidor; só aplicamos localmente depois do sucesso. */
  const deleteColumn = useCallback(async (id: string, target: string | null) => {
    try {
      const res = await deleteColumnAction(id, target);
      if (!res.ok) { fail(res.error); return false; }
    } catch { fail("network"); return false; }
    if (target) {
      const base = cardsByColumn.get(target)?.at(-1)?.position ?? 0;
      const moving = cardsByColumn.get(id) ?? [];
      setCards((l) => l.map((c) => {
        const i = moving.findIndex((m) => m.id === c.id);
        return i === -1 ? c : { ...c, column_id: target, position: base + (i + 1) * STEP };
      }));
    }
    setColumns((l) => l.filter((c) => c.id !== id));
    void refetch();
    return true;
  }, [cardsByColumn, fail, refetch]);

  const deleteCard = useCallback(async (id: string) => {
    try {
      const res = await deleteCardAction(id);
      if (!res.ok) { fail(res.error); return false; }
    } catch { fail("network"); return false; }
    setCards((l) => l.filter((c) => c.id !== id));
    setImages((l) => l.filter((i) => i.card_id !== id));
    return true;
  }, [fail]);

  return {
    board, setBoard, columns: sortedColumns, cards, cardsByColumn, images, imagesByCard,
    setCards, setImages, upsertCard: (c: Card) => setCards((l) => upsert(l, c)),
    addCard, moveCard, addColumn, updateColumn, moveColumn, deleteColumn, deleteCard, refetch,
  };
}

export type BoardState = ReturnType<typeof useBoard>;
