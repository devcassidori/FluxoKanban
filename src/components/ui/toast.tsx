"use client";
import { clsx } from "clsx";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type Kind = "success" | "error" | "info";
interface Toast { id: number; kind: Kind; message: string; action?: { label: string; onClick: () => void } }

interface ToastApi {
  toast: (t: Omit<Toast, "id">) => void;
  /** Anúncio só para leitores de tela (ex.: card movido). */
  announce: (message: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [polite, setPolite] = useState("");
  const seq = useRef(0);

  const dismiss = (id: number) => setToasts((l) => l.filter((x) => x.id !== id));

  const toast = useCallback<ToastApi["toast"]>((t) => {
    const id = ++seq.current;
    setToasts((l) => [...l.slice(-3), { ...t, id }]);
    if (!t.action) setTimeout(() => dismiss(id), t.kind === "error" ? 8000 : 4000);
  }, []);

  const announce = useCallback((m: string) => {
    setPolite("");
    requestAnimationFrame(() => setPolite(m));
  }, []);

  return (
    <Ctx.Provider value={{ toast, announce }}>
      {children}
      <div className="sr-only" aria-live="polite" aria-atomic="true">{polite}</div>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
        aria-live="polite"
        role="status"
      >
        {toasts.map((t) => {
          const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertTriangle : Info;
          return (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : undefined}
              className={clsx(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[var(--radius-card)] border bg-surface px-4 py-3 shadow-[var(--shadow-lift)] [animation:rise_200ms_var(--ease-out-soft)]",
                t.kind === "error" ? "border-danger/40" : "border-line",
              )}
            >
              <Icon aria-hidden className={clsx("mt-0.5 size-5 shrink-0",
                t.kind === "success" && "text-done", t.kind === "error" && "text-danger", t.kind === "info" && "text-accent")} />
              <p className="flex-1 pt-px text-sm leading-snug">{t.message}</p>
              {t.action && (
                <button className="min-h-11 -my-2 rounded px-2 text-sm font-semibold text-accent hover:underline"
                  onClick={() => { t.action!.onClick(); dismiss(t.id); }}>
                  {t.action.label}
                </button>
              )}
              <button aria-label="Fechar" onClick={() => dismiss(t.id)}
                className="-my-2 -mr-2 inline-flex size-11 items-center justify-center rounded text-muted hover:text-ink">
                <X className="size-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast fora do ToastProvider");
  return c;
}
