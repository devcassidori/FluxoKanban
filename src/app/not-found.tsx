import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <main id="main" className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-[64px] font-semibold leading-none tracking-tight text-line-strong" aria-hidden>404</p>
      <h1 className="mt-4 text-xl font-semibold">{t("error.notFoundPage")}</h1>
      <p className="mt-2 text-[15px] text-muted">{t("error.notFoundBody")}</p>
      <Link href="/projects" className="mt-6 inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-accent px-4 font-medium text-accent-ink">{t("error.goHome")}</Link>
    </main>
  );
}
