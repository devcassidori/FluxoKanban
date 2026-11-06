"use client";
/**
 * Fila de alterações offline + estado de conexão.
 * Ações seguras para reenviar (criar com id do cliente, mover, renomear)
 * entram na fila quando a rede cai e são enviadas na reconexão, em ordem,
 * sem duplicar — o servidor trata cada uma como idempotente.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createCard, createColumn, moveCard, updateColumn } from "@/app/actions/board-content";
import type { ActionResult } from "./types";

const executors = { createCard, createColumn, moveCard, updateColumn } as const;
type Kind = keyof typeof executors;
type Args<K extends Kind> = Parameters<(typeof executors)[K]>;

interface Op { id: string; kind: Kind; args: unknown[]; at: number }

export type RealtimeState = "idle" | "connecting" | "live" | "error";

interface SyncValue {
  online: boolean;
  realtime: RealtimeState;
  setRealtime: (s: RealtimeState) => void;
  pending: number;
  flushing: boolean;
  /** Executa já; se a rede falhar, guarda na fila e devolve { queued: true }. */
  perform: <K extends Kind>(kind: K, ...args: Args<K>) => Promise<{ queued: true } | Awaited<ReturnType<(typeof executors)[K]>>>;
  onFlushError: (fn: (error: string) => void) => () => void;
  onFlushed: (fn: () => void) => () => void;
}

const KEY = "fluxo:outbox:v1";
const Ctx = createContext<SyncValue | null>(null);

function load(): Op[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
function save(ops: Op[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ops)); } catch { /* armazenamento indisponível */ }
}

export function isNetworkError(e: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const m = e instanceof Error ? e.message : String(e);
  return e instanceof TypeError || /fetch|network|load failed|connection/i.test(m);
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  const [realtime, setRealtime] = useState<RealtimeState>("idle");
  const [pending, setPending] = useState(0);
  const [flushing, setFlushing] = useState(false);
  const busy = useRef(false);
  const errorListeners = useRef(new Set<(e: string) => void>());
  const flushedListeners = useRef(new Set<() => void>());

  const flush = useCallback(async () => {
    if (busy.current || !navigator.onLine) return;
    let ops = load();
    if (!ops.length) return;
    busy.current = true;
    setFlushing(true);
    let sentAny = false;
    try {
      while (ops.length) {
        const op = ops[0];
        let res: ActionResult<unknown>;
        try {
          res = await (executors[op.kind] as (...a: unknown[]) => Promise<ActionResult<unknown>>)(...op.args);
        } catch (e) {
          if (isNetworkError(e)) break; // tenta de novo na próxima reconexão
          res = { ok: false, error: "generic" };
        }
        if (!res.ok) errorListeners.current.forEach((fn) => fn(res.ok ? "" : res.error));
        sentAny = true;
        ops = ops.slice(1);
        save(ops);
        setPending(ops.length);
      }
    } finally {
      busy.current = false;
      setFlushing(false);
      if (sentAny && !load().length) flushedListeners.current.forEach((fn) => fn());
    }
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    setPending(load().length);
    const up = () => { setOnline(true); void flush(); };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    const timer = setInterval(() => void flush(), 15_000);
    void flush();
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); clearInterval(timer); };
  }, [flush]);

  const perform = useCallback(async (kind: Kind, ...args: unknown[]) => {
    const enqueue = () => {
      const ops = [...load(), { id: crypto.randomUUID(), kind, args, at: Date.now() }];
      save(ops);
      setPending(ops.length);
      return { queued: true as const };
    };
    // Se já há fila, mantém a ordem: entra no fim.
    if (!navigator.onLine || load().length) {
      const r = enqueue();
      void flush();
      return r;
    }
    try {
      return await (executors[kind] as (...a: unknown[]) => Promise<ActionResult<unknown>>)(...args);
    } catch (e) {
      if (isNetworkError(e)) { setOnline(navigator.onLine); return enqueue(); }
      throw e;
    }
  }, [flush]) as SyncValue["perform"];

  const value = useMemo<SyncValue>(() => ({
    online, realtime, setRealtime, pending, flushing, perform,
    onFlushError: (fn) => { errorListeners.current.add(fn); return () => { errorListeners.current.delete(fn); }; },
    onFlushed: (fn) => { flushedListeners.current.add(fn); return () => { flushedListeners.current.delete(fn); }; },
  }), [online, realtime, pending, flushing, perform]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSync() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSync fora do SyncProvider");
  return v;
}
