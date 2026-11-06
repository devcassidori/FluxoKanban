"use client";
import { clsx } from "clsx";
import { AlarmClock, CalendarDays, CircleAlert } from "lucide-react";
import { dueStatus } from "@/lib/due";
import { useI18n } from "@/lib/i18n/client";

/** Prazo com texto + ícone (nunca só cor). Colunas concluídas não alertam. */
export function DueBadge({ due, done, compact }: { due: string | null; done: boolean; compact?: boolean }) {
  const { t, formatDate } = useI18n();
  if (!due) return null;
  const status = dueStatus(due, done);
  const date = formatDate(due, { day: "2-digit", month: "short", year: undefined });
  if (status === "overdue" || status === "soon") {
    const Icon = status === "overdue" ? CircleAlert : AlarmClock;
    return (
      <span className={clsx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12.5px] font-medium",
        status === "overdue" ? "bg-danger-soft text-danger" : "bg-soon-soft text-soon")}>
        <Icon className="size-3.5" aria-hidden />
        {t(status === "overdue" ? "cards.due.overdue" : "cards.due.soon")}
        <span className={compact ? "sr-only" : "font-normal opacity-90"}>· {date}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[12.5px] text-muted">
      <CalendarDays className="size-3.5" aria-hidden />
      <span className="sr-only">{t("cards.due.date", { date: "" })}</span>{date}
    </span>
  );
}
