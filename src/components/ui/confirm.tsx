"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Dialog } from "./dialog";
import { Button } from "./button";
import { useI18n } from "@/lib/i18n/client";

interface ConfirmOptions {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** Exige digitar este texto para habilitar a confirmação. */
  typeToConfirm?: string;
  typeLabel?: string;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;
const Ctx = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [typed, setTyped] = useState("");
  const resolver = useRef<(v: boolean) => void>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    setTyped("");
    setOpts(o);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  const done = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  const blocked = !!opts?.typeToConfirm && typed.trim() !== opts.typeToConfirm;

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Dialog
        open={!!opts}
        onClose={() => done(false)}
        title={opts?.title ?? ""}
        size="sm"
        initialFocus={opts?.typeToConfirm ? undefined : cancelRef}
        footer={
          <>
            <Button ref={cancelRef} onClick={() => done(false)}>{t("common.cancel")}</Button>
            <Button variant={opts?.danger ? "danger" : "primary"} disabled={blocked} onClick={() => done(true)}>
              {opts?.confirmLabel ?? t("common.confirm")}
            </Button>
          </>
        }
      >
        {opts?.body && <div className="text-[15px] leading-relaxed text-ink-2">{opts.body}</div>}
        {opts?.typeToConfirm && (
          <div className="mt-4">
            <label className="label" htmlFor="confirm-type">{opts.typeLabel}</label>
            <input id="confirm-type" className="field" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </div>
        )}
      </Dialog>
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useConfirm fora do ConfirmProvider");
  return c;
}
