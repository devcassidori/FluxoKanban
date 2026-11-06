"use client";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import type { Column } from "@/lib/types";

export function ColumnNameDialog({ open, column, existing, onClose, onSubmit }: {
  open: boolean; column: Column | null; existing: Column[]; onClose: () => void; onSubmit: (name: string) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => { if (open) { setName(column?.name ?? ""); setError(false); } }, [open, column]);
  const dup = !!name.trim() && existing.some((c) => c.id !== column?.id && c.name.trim().toLowerCase() === name.trim().toLowerCase());

  return (
    <Dialog open={open} onClose={onClose} size="sm" title={column ? t("columns.rename") : t("columns.new")}
      footer={<>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="primary" type="submit" form="col-name-form">{column ? t("common.save") : t("common.create")}</Button>
      </>}>
      <form id="col-name-form" noValidate onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) { setError(true); return; }
        onSubmit(name.trim());
      }}>
        <label className="label" htmlFor="col-name">{t("common.name")}</label>
        <input id="col-name" className="field" autoFocus maxLength={60} value={name} placeholder={t("columns.namePlaceholder")}
          aria-invalid={error || undefined} aria-describedby={error ? "col-err" : dup ? "col-dup" : undefined}
          onChange={(e) => { setName(e.target.value); setError(false); }} />
        {error && <p id="col-err" role="alert" className="mt-1.5 text-[13px] font-medium text-danger">{t("error.name_required")}</p>}
        {dup && !error && <p id="col-dup" role="status" className="mt-1.5 text-[13px] text-soon">{t("columns.duplicateWarning")}</p>}
      </form>
    </Dialog>
  );
}

export function DeleteColumnDialog({ column, columns, cardCount, onClose, onConfirm }: {
  column: Column; columns: Column[]; cardCount: number; onClose: () => void; onConfirm: (target: string | null) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const others = columns.filter((c) => c.id !== column.id);
  const [target, setTarget] = useState(others[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const blocked = cardCount > 0 && others.length === 0;

  return (
    <Dialog open onClose={onClose} size="sm" title={t("columns.delete")}
      footer={<>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="danger" loading={busy} disabled={blocked || (cardCount > 0 && !target)}
          onClick={async () => { setBusy(true); const ok = await onConfirm(cardCount > 0 ? target : null); setBusy(false); if (ok) onClose(); }}>
          {t("columns.delete")}
        </Button>
      </>}>
      {blocked ? (
        <p className="text-[15px] leading-relaxed text-ink-2" role="alert">{t("columns.deleteLastWithCards")}</p>
      ) : cardCount > 0 ? (
        <>
          <p className="text-[15px] leading-relaxed text-ink-2">{t("columns.deleteWithCards", { name: column.name, n: cardCount })}</p>
          <label className="label mt-4" htmlFor="del-target">{t("columns.deleteTarget")}</label>
          <select id="del-target" className="field" value={target} onChange={(e) => setTarget(e.target.value)}>
            {others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </>
      ) : (
        <p className="text-[15px] leading-relaxed text-ink-2">{t("columns.deleteEmpty", { name: column.name })}</p>
      )}
    </Dialog>
  );
}
