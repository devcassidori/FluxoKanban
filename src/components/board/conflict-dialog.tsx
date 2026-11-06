"use client";
import { clsx } from "clsx";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import type { CardPatch } from "@/app/actions/board-content";
import type { Card, Member } from "@/lib/types";

type FieldKey = keyof CardPatch;

/**
 * Mostra as duas versões lado a lado, campo a campo. Nada é descartado
 * até a pessoa escolher; por padrão, mantém o que ela escreveu.
 */
export function ConflictDialog({ mine, current, members, saving, onCancel, onResolve }: {
  mine: CardPatch; current: Card; members: Member[]; saving: boolean;
  onCancel: () => void; onResolve: (merged: CardPatch) => void;
}) {
  const { t, formatDate, formatDateTime } = useI18n();
  const theirs: CardPatch = { title: current.title, description: current.description, assignee_id: current.assignee_id, due_date: current.due_date };
  const fields = (["title", "description", "assignee_id", "due_date"] as FieldKey[]).filter((k) => (mine[k] ?? null) !== (theirs[k] ?? null));
  const [choice, setChoice] = useState<Record<string, "mine" | "theirs">>(() => Object.fromEntries(fields.map((f) => [f, "mine"])));
  const editor = members.find((m) => m.user_id === current.updated_by)?.profile.name ?? "—";

  const label: Record<FieldKey, string> = {
    title: t("cards.title"), description: t("cards.description"), assignee_id: t("cards.assignee"), due_date: t("cards.dueDate"),
  };

  const render = (k: FieldKey, v: CardPatch) => {
    const empty = <span className="italic text-muted">{t("conflict.empty")}</span>;
    if (k === "description") return v.description
      // conteúdo já higienizado no servidor
      ? <div className="prose-card max-h-48 overflow-y-auto" dangerouslySetInnerHTML={{ __html: v.description }} />
      : empty;
    if (k === "assignee_id") return v.assignee_id ? members.find((m) => m.user_id === v.assignee_id)?.profile.name ?? "—" : t("cards.unassigned");
    if (k === "due_date") return v.due_date ? formatDate(v.due_date) : t("cards.noDue");
    return v.title || empty;
  };

  const merged = (): CardPatch => {
    const out = { ...theirs };
    for (const f of fields) if (choice[f] === "mine") (out as Record<FieldKey, unknown>)[f] = mine[f];
    return out;
  };

  return (
    <Dialog open onClose={onCancel} size="lg" title={t("conflict.title")}
      description={<>{t("conflict.body")} {t("conflict.by", { name: editor, date: formatDateTime(current.updated_at) })}</>}
      footer={<>
        <Button onClick={onCancel}>{t("common.cancel")}</Button>
        <Button variant="primary" loading={saving} onClick={() => onResolve(merged())}>{t("conflict.apply")}</Button>
      </>}>
      <div className="space-y-6">
        {fields.map((f) => (
          <fieldset key={f}>
            <legend className="label">{label[f]}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["mine", "theirs"] as const).map((side) => (
                <label key={side} className={clsx(
                  "flex cursor-pointer flex-col gap-2 rounded-[var(--radius-card)] border p-3 transition-colors",
                  choice[f] === side ? "border-accent bg-accent-soft/40" : "border-line hover:border-line-strong",
                )}>
                  <span className="flex min-h-6 items-center gap-2 text-sm font-medium">
                    <input type="radio" name={`c-${f}`} checked={choice[f] === side} className="size-4 accent-[var(--color-accent)]"
                      onChange={() => setChoice((c) => ({ ...c, [f]: side }))} />
                    {side === "mine" ? t("conflict.keepMine") : t("conflict.keepTheirs")}
                    <span className="font-normal text-muted">— {side === "mine" ? t("conflict.yours") : t("conflict.theirs")}</span>
                  </span>
                  <div className="text-[14.5px] [overflow-wrap:anywhere]">{render(f, side === "mine" ? mine : theirs)}</div>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </Dialog>
  );
}
