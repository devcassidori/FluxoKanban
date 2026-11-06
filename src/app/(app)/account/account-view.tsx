"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { LanguageSwitch } from "@/components/language-switch";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { errorKey } from "@/lib/i18n/dictionaries";
import { deleteAccount, updateProfile } from "@/app/actions/account";
import type { Profile } from "@/lib/types";

const AVATAR_MAX = 2 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function AccountView({ profile }: { profile: Profile }) {
  const { t } = useI18n();
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(profile.name);
  const [savedName, setSavedName] = useState(profile.name);
  const [avatar, setAvatar] = useState<string | null>(profile.avatar_url);
  const [error, setError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [owned, setOwned] = useState<{ id: string; name: string }[] | null>(null);
  const dirty = name.trim() !== savedName.trim();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError(t("error.name_required")); return; }
    setSaving(true); setError(null);
    try {
      const res = await updateProfile({ name });
      if (res.ok) {
        setSavedName(res.data.name); setName(res.data.name);
        toast({ kind: "success", message: t("common.saved") });
        router.refresh();
      } else setError(t(errorKey(res.error)) + ((res.error === "generic" || res.error === "db_outdated") && res.detail ? ` (${res.detail})` : ""));
    } catch { setError(t("error.network")); }
    finally { setSaving(false); }
  };

  const upload = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setAvatarError(null);
    if (!AVATAR_TYPES.includes(file.type)) { setAvatarError(t("error.invalid_type")); return; }
    if (file.size > AVATAR_MAX) { setAvatarError(t("error.avatar_too_large")); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/avatar", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setAvatarError(t(errorKey(body.error ?? "generic"))); return; }
      setAvatar(body.url);
      toast({ kind: "success", message: t("account.avatarSaved") });
      router.refresh();
    } catch { setAvatarError(t("error.network")); }
    finally { setUploading(false); }
  };

  const removeAvatar = async () => {
    setUploading(true); setAvatarError(null);
    try {
      const res = await fetch("/api/avatar", { method: "DELETE" });
      if (!res.ok) { setAvatarError(t("error.generic")); return; }
      setAvatar(null);
      toast({ kind: "success", message: t("account.avatarRemoved") });
      router.refresh();
    } catch { setAvatarError(t("error.network")); }
    finally { setUploading(false); }
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

  const displayName = name.trim() || profile.email;

  return (
    <div className="pb-16">
      <PageHeader title={t("account.title")} />
      <div className="mx-auto max-w-2xl space-y-12 px-4 pt-6 sm:px-8">
        <section aria-labelledby="profile-h">
          <h2 id="profile-h" className="text-lg font-semibold">{t("account.profile")}</h2>

          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative w-fit">
              <Avatar name={displayName} url={avatar} size={96} />
              {uploading && (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-surface/70" role="status" aria-label={t("common.saving")}>
                  <Spinner className="size-6 text-accent" />
                </span>
              )}
            </div>
            <div>
              <p className="label mb-1">{t("account.avatar")}</p>
              <div className="flex flex-wrap gap-2">
                <input ref={fileRef} type="file" accept={AVATAR_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-hidden
                  onChange={(e) => upload(e.target.files?.[0])} />
                <Button icon={<Camera className="size-4" aria-hidden />} disabled={uploading} onClick={() => fileRef.current?.click()}>
                  {avatar ? t("account.avatarChange") : t("account.avatarUpload")}
                </Button>
                {avatar && (
                  <Button variant="danger-ghost" icon={<Trash2 className="size-4" aria-hidden />} disabled={uploading} onClick={removeAvatar}>
                    {t("account.avatarRemove")}
                  </Button>
                )}
              </div>
              {avatarError ? <p role="alert" className="mt-1.5 text-[13px] font-medium text-danger">{avatarError}</p>
                : <p className="hint">{t("account.avatarHint")}</p>}
            </div>
          </div>

          <form onSubmit={save} className="mt-8 space-y-5" noValidate>
            <Field label={t("auth.name")} error={error}>
              {(p) => <input {...p} className="field" value={name} maxLength={80} autoComplete="name"
                onChange={(e) => { setName(e.target.value); setError(null); }} />}
            </Field>
            <div>
              <p className="label">{t("auth.email")}</p>
              <p className="flex min-h-11 items-center rounded-[var(--radius-control)] bg-sunken px-3 text-[15px] text-ink-2">{profile.email}</p>
              <p className="hint">{t("account.emailReadonly")}</p>
            </div>

            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
              <p className="text-[13px] text-muted">{t("account.preview")}</p>
              <div className="mt-3 flex items-center gap-3">
                <Avatar name={displayName} url={avatar} size={36} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{displayName}</p>
                  <p className="truncate text-sm text-muted">{profile.email}</p>
                </div>
              </div>
            </div>

            <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>{t("common.save")}</Button>
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
