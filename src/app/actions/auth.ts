"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { appConfig } from "@/lib/config";
import { LOCALE_COOKIE } from "@/lib/i18n/server";
import type { DictKey } from "@/lib/i18n/dictionaries";
import { safeNext } from "@/lib/safe-next";

export interface AuthState { error?: DictKey; ok?: boolean; email?: string }

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// VALIDAÇÃO PENDENTE nº 6: critérios de senha. Regra inicial: ≥ 8, letras e números.
const strongEnough = (p: string) => p.length >= 8 && p.length <= 72 && /[A-Za-z]/.test(p) && /\d/.test(p);

function mapAuthError(message: string | undefined, status?: number): DictKey {
  const m = (message ?? "").toLowerCase();
  if (status === 429 || m.includes("rate limit") || m.includes("too many")) return "auth.error.rateLimit";
  if (m.includes("not confirmed")) return "auth.error.notConfirmed";
  if (m.includes("invalid login") || m.includes("invalid credentials")) return "auth.error.invalid";
  if (m.includes("password")) return "auth.error.weakPassword";
  if (m.includes("email")) return "auth.error.emailInvalid";
  return "error.generic";
}

export async function signInAction(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!EMAIL_RE.test(email)) return { error: "auth.error.emailInvalid", email };
  const supabase = await getServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: mapAuthError(error.message, error.status), email };
  redirect(safeNext(form.get("next")));
}

export async function signUpAction(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const next = safeNext(form.get("next"));
  if (!EMAIL_RE.test(email)) return { error: "auth.error.emailInvalid", email };
  if (!strongEnough(password)) return { error: "auth.error.weakPassword", email };
  const locale = (await cookies()).get(LOCALE_COOKIE)?.value === "en" ? "en" : "pt-BR";
  const supabase = await getServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, locale },
      emailRedirectTo: `${appConfig.siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: mapAuthError(error.message, error.status), email };
  // Mesma resposta para e-mail novo ou já cadastrado (não revela contas).
  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}

export async function forgotPasswordAction(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "auth.error.emailInvalid", email };
  const supabase = await getServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appConfig.siteUrl}/auth/confirm?next=/reset-password`,
  });
  if (error && (error.status === 429)) return { error: "auth.error.rateLimit", email };
  return { ok: true, email };
}

export async function resetPasswordAction(_: AuthState, form: FormData): Promise<AuthState> {
  const password = String(form.get("password") ?? "");
  if (!strongEnough(password)) return { error: "auth.error.weakPassword" };
  const supabase = await getServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: mapAuthError(error.message, error.status) };
  redirect("/projects?reset=1");
}

export async function signOutAction() {
  const supabase = await getServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setLocaleAction(locale: string) {
  const value = locale === "en" ? "en" : "pt-BR";
  (await cookies()).set(LOCALE_COOKIE, value, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from("profiles").update({ locale: value }).eq("id", user.id);
}
