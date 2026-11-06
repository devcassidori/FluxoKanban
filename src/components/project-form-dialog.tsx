"use client";
import { useEffect, useState } from "react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Field } from "./ui/field";
import { useI18n } from "@/lib/i18n/client";
import { errorKey } from "@/lib/i18n/dictionaries";
import type { ActionResult } from "@/lib/types";

/** Formulário simples nome + descrição (projetos e quadros). */
export function NameDescriptionDialog<T>({ open, onClose, title, submitLabel, initial, onSubmit, onDone, extra }: {
  open: boolean;
  onClose: () => void;
  title: string;
  submitLabel: string;
  initial?: { name: string; description: string };
  onSubmit: (v: { name: string; description: string }) => Promise<ActionResult<T>>;
  onDone: (data: T) => void;
  extra?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setName(initial?.name ?? ""); setDescription(initial?.description ?? ""); setError(null); setNameError(null); }
  }, [open, initial?.name, initial?.description]);

  const dirty = name !== (initial?.name ?? "") || description !== (initial?.description ?? "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setNameError(t("error.name_required")); return; }
    setSaving(true); setError(null);
    try {
      const res = await onSubmit({ name, description });
      if (res.ok) onDone(res.data);
      else setError(t(errorKey(res.error)) + (res.error === "generic" && res.detail ? ` (${res.detail})` : ""));
    } catch {
      setError(t("error.network"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      beforeClose={() => !dirty || saving || confirm(t("common.unsavedLeave"))}
      footer={
        <>
          <Button type="button" onClick={onClose}>{t("common.cancel")}</Button>
          <Button type="submit" form="name-desc-form" variant="primary" loading={saving}>{submitLabel}</Button>
        </>
      }
    >
      <form id="name-desc-form" onSubmit={submit} className="space-y-5" noValidate>
        <Field label={t("common.name")} error={nameError}>
          {(p) => <input {...p} className="field" value={name} maxLength={120} autoFocus
            onChange={(e) => { setName(e.target.value); setNameError(null); }} />}
        </Field>
        <Field label={t("common.description")} optional={t("common.optional")}>
          {(p) => <textarea {...p} className="field min-h-24 py-2.5" value={description} maxLength={2000}
            onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        {extra}
        {error && <p role="alert" className="rounded-[var(--radius-control)] bg-danger-soft px-3 py-2.5 text-sm text-danger">{error}</p>}
      </form>
    </Dialog>
  );
}
