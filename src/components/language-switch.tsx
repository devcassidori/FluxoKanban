"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { setLocaleAction } from "@/app/actions/auth";
import { useI18n } from "@/lib/i18n/client";

export function LanguageSwitch({ compact }: { compact?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-2">
      <Languages className="size-4 text-muted" aria-hidden />
      <span className={compact ? "sr-only" : undefined}>{t("common.language")}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => start(async () => { await setLocaleAction(e.target.value); router.refresh(); })}
        className="min-h-11 rounded-[var(--radius-control)] bg-transparent px-1 font-medium text-ink hover:bg-sunken"
      >
        <option value="pt-BR">{compact ? "PT-BR" : "Português (BR)"}</option>
        <option value="en">{compact ? "EN" : "English"}</option>
      </select>
    </label>
  );
}
