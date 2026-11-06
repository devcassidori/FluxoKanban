"use client";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { IconButton } from "./ui/button";

/** Lista editável das colunas iniciais de um quadro novo. */
export function ColumnsEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { t } = useI18n();
  const norm = value.map((v) => v.trim().toLowerCase());
  const move = (i: number, d: number) => {
    const n = [...value]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); onChange(n);
  };
  return (
    <fieldset>
      <legend className="label">{t("boards.suggestedColumns")}</legend>
      <p className="hint -mt-1 mb-3">{t("boards.suggestedHint")}</p>
      <ol className="space-y-2">
        {value.map((name, i) => {
          const dup = name.trim() && norm.indexOf(norm[i]) !== i;
          return (
            <li key={i}>
              <div className="flex items-center gap-1">
                <span className="w-6 shrink-0 text-center text-sm tabular-nums text-muted" aria-hidden>{i + 1}</span>
                <input
                  className="field"
                  value={name}
                  maxLength={60}
                  aria-label={`${t("columns.namePlaceholder")} ${i + 1}`}
                  aria-invalid={dup || undefined}
                  onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
                />
                <IconButton label={t("cards.moveUp")} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" aria-hidden /></IconButton>
                <IconButton label={t("cards.moveDown")} disabled={i === value.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" aria-hidden /></IconButton>
                <IconButton label={t("common.remove")} onClick={() => onChange(value.filter((_, j) => j !== i))}><X className="size-4" aria-hidden /></IconButton>
              </div>
              {dup && <p className="ml-7 mt-1 text-[13px] text-soon" role="status">{t("columns.duplicateWarning")}</p>}
            </li>
          );
        })}
      </ol>
      <button type="button" onClick={() => onChange([...value, ""])}
        className="mt-2 ml-6 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-medium text-accent hover:bg-accent-soft">
        <Plus className="size-4" aria-hidden />{t("boards.addColumnName")}
      </button>
    </fieldset>
  );
}
