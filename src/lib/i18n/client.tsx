"use client";
import { createContext, useCallback, useContext, useMemo } from "react";
import { dictionaries, translate, type DictKey } from "./dictionaries";
import type { Locale } from "../types";
import { appConfig } from "../config";

interface I18nValue {
  locale: Locale;
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
  formatDate: (iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (iso: string | null | undefined) => string;
  formatBytes: (n: number) => string;
}

const Ctx = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const dict = dictionaries[locale];
  const t = useCallback((key: DictKey, vars?: Record<string, string | number>) => translate(dict, key, vars), [dict]);
  const value = useMemo<I18nValue>(() => ({
    locale,
    t,
    // Prazos são datas sem horário: formatamos em UTC para não "voltar um dia".
    formatDate: (iso, opts) => {
      if (!iso) return "";
      const d = iso.length === 10 ? new Date(`${iso}T00:00:00Z`) : new Date(iso);
      return new Intl.DateTimeFormat(locale, {
        day: "2-digit", month: "short", year: "numeric",
        timeZone: iso.length === 10 ? "UTC" : appConfig.timeZone, ...opts,
      }).format(d);
    },
    formatDateTime: (iso) => iso
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: appConfig.timeZone }).format(new Date(iso))
      : "",
    formatBytes: (n) => {
      const units = ["B", "KB", "MB", "GB"];
      let i = 0; let v = n;
      while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: v < 10 && i > 0 ? 1 : 0 }).format(v)} ${units[i]}`;
    },
  }), [locale, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n fora do I18nProvider");
  return v;
}
