import { getServerClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { Brand } from "@/components/brand";
import { InviteAccept } from "./invite-accept";
import type { DictKey } from "@/lib/i18n/dictionaries";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t } = await getT();
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const valid = /^[0-9a-f-]{36}$/i.test(token);
  const { data } = valid ? await supabase.rpc("get_invitation", { p_token: token }) : { data: null };
  const inv = (data as { project_name: string; inviter_name: string; email: string; role: string; status: string }[] | null)?.[0];
  const roleLabel = inv ? t(inv.role === "admin" ? "projects.role.admin" : "projects.role.member").toLowerCase() : "";
  const next = `/invite/${token}`;

  return (
    <div className="flex min-h-dvh flex-col items-center px-5 py-8">
      <Brand />
      <main id="main" className="mt-16 w-full max-w-md rounded-[var(--radius-dialog)] border border-line bg-surface p-6 sm:p-8">
        {!inv ? (
          <p role="alert" className="text-[15px]">{t("invite.notFound")}</p>
        ) : (
          <>
            <h1 className="text-[24px] font-semibold leading-tight">{t("invite.title", { project: inv.project_name })}</h1>
            <p className="mt-2 text-[15px] text-muted">{t("invite.body", { inviter: inv.inviter_name || "—", email: inv.email, role: roleLabel })}</p>
            <div className="mt-6">
              {inv.status !== "pending" ? (
                <p role="alert" className="rounded-[var(--radius-control)] bg-soon-soft px-3 py-2.5 text-sm text-soon">
                  {t(`invite.status.${inv.status}` as DictKey)}
                </p>
              ) : !user ? (
                <div className="space-y-3">
                  <p className="text-sm">{t("invite.loginFirst", { email: inv.email })}</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <a className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-control)] bg-accent px-4 font-medium text-accent-ink"
                      href={`/signup?next=${encodeURIComponent(next)}&email=${encodeURIComponent(inv.email)}`}>{t("auth.signup.title")}</a>
                    <a className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-control)] border border-line-strong px-4 font-medium"
                      href={`/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(inv.email)}`}>{t("auth.login.title")}</a>
                  </div>
                </div>
              ) : user.email?.toLowerCase() !== inv.email ? (
                <p role="alert" className="rounded-[var(--radius-control)] bg-danger-soft px-3 py-2.5 text-sm text-danger">
                  {t("invite.wrongAccount", { current: user.email ?? "", email: inv.email })}
                </p>
              ) : (
                <InviteAccept token={token} />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
