"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import type { AuthState } from "@/app/actions/auth";
import type { DictKey } from "@/lib/i18n/dictionaries";

type Mode = "login" | "signup" | "forgot" | "reset";

export function AuthForm({ mode, action, next, notice, initialEmail }: {
  mode: Mode;
  action: (s: AuthState, f: FormData) => Promise<AuthState>;
  next?: string;
  notice?: { kind: "success" | "error"; key: DictKey } | null;
  initialEmail?: string;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, { email: initialEmail });

  const titles: Record<Mode, [DictKey, DictKey | null, DictKey]> = {
    login: ["auth.login.title", "auth.login.subtitle", "auth.login.submit"],
    signup: ["auth.signup.title", "auth.signup.subtitle", "auth.signup.submit"],
    forgot: ["auth.forgot.title", "auth.forgot.subtitle", "auth.forgot.submit"],
    reset: ["auth.reset.title", null, "auth.reset.submit"],
  };
  const [title, subtitle, submit] = titles[mode];
  const q = next && next !== "/projects" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div>
      <h1 className="text-[28px] font-semibold leading-tight">{t(title)}</h1>
      {subtitle && <p className="mt-2 text-[15px] text-muted">{t(subtitle)}</p>}

      {notice && (
        <p role={notice.kind === "error" ? "alert" : "status"}
          className={`mt-6 rounded-[var(--radius-control)] px-3 py-2.5 text-sm ${notice.kind === "error" ? "bg-danger-soft text-danger" : "bg-done-soft text-done"}`}>
          {t(notice.key)}
        </p>
      )}

      {mode === "forgot" && state.ok ? (
        <p role="status" className="mt-6 rounded-[var(--radius-control)] bg-done-soft px-3 py-2.5 text-sm text-done">{t("auth.forgot.sent")}</p>
      ) : (
        <form action={formAction} className="mt-8 space-y-5" noValidate>
          {next && <input type="hidden" name="next" value={next} />}
          {mode === "signup" && (
            <div>
              <label className="label" htmlFor="name">{t("auth.name")}</label>
              <input id="name" name="name" className="field" autoComplete="name" maxLength={80} />
            </div>
          )}
          {mode !== "reset" && (
            <div>
              <label className="label" htmlFor="email">{t("auth.email")}</label>
              <input id="email" name="email" type="email" required autoComplete="email" inputMode="email"
                defaultValue={state.email} className="field"
                aria-invalid={state.error === "auth.error.emailInvalid" || undefined} />
            </div>
          )}
          {mode !== "forgot" && (
            <div>
              <div className="flex items-baseline justify-between">
                <label className="label" htmlFor="password">{t(mode === "reset" ? "auth.newPassword" : "auth.password")}</label>
                {mode === "login" && (
                  <Link href="/forgot-password" className="text-sm font-medium text-accent hover:underline">{t("auth.login.forgot")}</Link>
                )}
              </div>
              <input id="password" name="password" type="password" required minLength={mode === "login" ? undefined : 8}
                autoComplete={mode === "login" ? "current-password" : "new-password"} className="field"
                aria-describedby={mode !== "login" ? "pw-hint" : undefined}
                aria-invalid={state.error === "auth.error.weakPassword" || undefined} />
              {mode !== "login" && <p id="pw-hint" className="hint">{t("auth.passwordHint")}</p>}
            </div>
          )}

          {state.error && (
            <p role="alert" className="rounded-[var(--radius-control)] bg-danger-soft px-3 py-2.5 text-sm text-danger">{t(state.error)}</p>
          )}

          <Button type="submit" variant="primary" loading={pending} className="w-full">{t(submit)}</Button>
        </form>
      )}

      <p className="mt-8 text-sm text-muted">
        {mode === "login" && <>{t("auth.login.noAccount")} <Link className="font-medium text-accent hover:underline" href={`/signup${q}`}>{t("auth.signup.title")}</Link></>}
        {mode === "signup" && <>{t("auth.signup.hasAccount")} <Link className="font-medium text-accent hover:underline" href={`/login${q}`}>{t("auth.login.title")}</Link></>}
        {mode === "forgot" && <Link className="font-medium text-accent hover:underline" href="/login">{t("common.back")}</Link>}
      </p>
    </div>
  );
}
