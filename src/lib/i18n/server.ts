import "server-only";
import { cookies, headers } from "next/headers";
import { dictionaries, translate, type DictKey } from "./dictionaries";
import type { Locale } from "../types";

export const LOCALE_COOKIE = "locale";

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (c === "en" || c === "pt-BR") return c;
  const accept = (await headers()).get("accept-language") ?? "";
  return /^en\b/i.test(accept) ? "en" : "pt-BR";
}

export async function getT() {
  const locale = await getLocale();
  const dict = dictionaries[locale];
  return { locale, t: (key: DictKey, vars?: Record<string, string | number>) => translate(dict, key, vars) };
}
