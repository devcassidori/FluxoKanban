"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Avatar } from "@/components/ui/avatar";
import { LanguageSwitch } from "@/components/language-switch";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { errorKey } from "@/lib/i18n/dictionaries";
import { deleteAccount, updateProfile } from "@/app/actions/account";
import type { Profile } from "@/lib/types";

export function AccountView({ profile }: { profile: Profile }) {
  const { t } = useI18n();
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar_url ?? "");
  const [error, setError] = useState<{ field: "name" | "avatar" | "form"; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [owned, setOwned] = useState<{ id: string; name: string }[] | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const res = await updateProfile({ name, avatar_url: avatar });
      if (res.ok) { toast({ kind: "success", message: t("common.saved") }); router.refresh(); }
      else setError({ field: res.error === "invalid_url" ? "avatar" : res.error === "name_required" ? "name" : "form", msg: t(errorKey(res.error)) });
    } catch { setError({ field: "form", msg: t("error.network") }); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    const yes = await confirm({
      title: t("account.delete"), body: t("account.deleteBody"), danger: true, confirmLabel: t("account.delete"),
      typeToConfirm: profile.email, typeLabel: t("account.deleteConfirm"),
    });
    if (!yes) return;
    try {
      const res = await deleteAccount(profile.email);
      if (!res.ok) {
        if (res.error === "owns_projects") setOwned(JSON.parse(res.detail ?? "[]"));
        else toast({ kind: "error", message: t(errorKey(res.error)) });
      }
    } catch { /* redirecionamento após excluir também cai aqui */ }
  };

  return (
    <div className="pb-16">
      <PageHeader title={t("account.title")} />
      <div className="mx-auto max-w-2xl space-y-12 px-4 pt-6 sm:px-8">
        <section aria-labelledby="profile-h">
          <h2 id="profile-h" className="text-lg font-semibold">{t("account.profile")}</h2>
          <form onSubmit={save} className="mt-4 space-y-5" noValidate>
            <div className="flex items-center gap-4">
              <Avatar name={name || profile.email} url={/^https:\/\//.test(avatar) ? avatar : null} size={56} />
              <div className="min-w-0">
                <p className="truncate font-medium">{profile.email}</p>
                <p className="text-[13px] text-muted">{t("account.emailReadonly")}</p>
              </div>
            </div>
            <Field label={t("auth.name")} error={error?.field === "name" ? error.msg : null}>
              {(p) => <input {...p} className="field" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
            </Field>
            <Field label={t("account.avatar")} optional={t("common.optional")} hint={t("account.avatarHint")} error={error?.field === "avatar" ? error.msg : null}>
              {(p) => <input {...p} className="field" type="url" inputMode="url" value={avatar} maxLength={500} onChange={(e) => setAvatar(e.target.value)} placeholder="https://" />}
            </Field>
            {error?.field === "form" && <p role="alert" className="text-sm text-danger">{error.msg}</p>}
            <Button type="submit" variant="primary" loading={saving}>{t("common.save")}</Button>
          </form>
        </section>

        <section aria-labelledby="lang-h">
          <h2 id="lang-h" className="text-lg font-semibold">{t("common.language")}</h2>
          <div className="mt-2"><LanguageSwitch /></div>
        </section>

        <section aria-labelledby="del-h" className="rounded-[var(--radius-lane)] border border-danger/30 p-5">
          <h2 id="del-h" className="text-lg font-semibold text-danger">{t("account.delete")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{t("account.deleteBody")}</p>
          {owned && owned.length > 0 && (
            <div role="alert" className="mt-4 rounded-[var(--radius-control)] bg-danger-soft p-3 text-sm text-danger">
              <p>{t("account.deleteBlocked")}</p>
              <ul className="mt-2 list-disc pl-5">
                {owned.map((p) => <li key={p.id}><Link className="underline" href={`/projects/${p.id}/members`}>{p.name}</Link></li>)}
              </ul>
            </div>
          )}
          <Button variant="danger" className="mt-4" onClick={remove}>{t("account.delete")}</Button>
        </section>
      </div>
    </div>
  );
}
