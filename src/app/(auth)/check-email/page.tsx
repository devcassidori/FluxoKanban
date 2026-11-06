import Link from "next/link";
import { MailCheck } from "lucide-react";
import { getT } from "@/lib/i18n/server";

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { t } = await getT();
  const { email } = await searchParams;
  return (
    <div>
      <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent" aria-hidden>
        <MailCheck className="size-6" />
      </div>
      <h1 className="text-[28px] font-semibold leading-tight">{t("auth.checkEmail.title")}</h1>
      {email && <p className="mt-3 font-medium">{email}</p>}
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{t("auth.checkEmail.body")}</p>
      <Link href="/login" className="mt-8 inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline">
        {t("auth.login.title")}
      </Link>
    </div>
  );
}
