"use client";
import { clsx } from "clsx";
import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { useI18n } from "@/lib/i18n/client";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** No celular ocupa a tela inteira (detalhes do card). */
  fullScreenMobile?: boolean;
  /** Retorne false para impedir o fechamento (ex.: alterações não salvas). */
  beforeClose?: () => boolean;
  initialFocus?: React.RefObject<HTMLElement | null>;
}

// <dialog> nativo: foco preso, Esc e inert no fundo vêm do navegador.
export function Dialog({ open, onClose, title, description, children, footer, size = "md", fullScreenMobile, beforeClose, initialFocus }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const { t } = useI18n();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      if (initialFocus?.current) initialFocus.current.focus();
    } else if (!open && el.open) el.close();
  }, [open, initialFocus]);

  const requestClose = () => {
    if (beforeClose && !beforeClose()) return;
    onClose();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => { e.preventDefault(); requestClose(); }}
      onClick={(e) => { if (e.target === ref.current) requestClose(); }}
      className={clsx(
        "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-hidden rounded-[var(--radius-dialog)] border border-line bg-surface p-0 shadow-[var(--shadow-dialog)]",
        size === "sm" && "max-w-md",
        size === "md" && "max-w-xl",
        size === "lg" && "max-w-3xl",
        fullScreenMobile && "max-sm:m-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0",
      )}
    >
      {open && (
        <div className={clsx("flex max-h-[inherit] flex-col", fullScreenMobile && "max-sm:h-dvh")}>
          <header className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1 pt-2">
              <h2 id={titleId} className="text-lg font-semibold leading-snug">{title}</h2>
              {description && <p id={descId} className="mt-1 text-sm text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label={t("common.close")}
              className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-sunken hover:text-ink"
            >
              <X className="size-5" aria-hidden />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 scrollbar-thin">{children}</div>
          {footer && (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-paper/60 px-5 py-3 sm:px-6">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
