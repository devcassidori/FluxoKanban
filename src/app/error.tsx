"use client";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n();
  return (
    <main id="main" role="alert" className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold">{t("error.generic")}</h1>
      <Button variant="primary" className="mt-6" onClick={reset}>{t("common.retry")}</Button>
    </main>
  );
}
