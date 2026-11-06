"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { ProjectHeader } from "@/components/project-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { StorageMeter } from "@/components/storage-meter";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { errorKey } from "@/lib/i18n/dictionaries";
import { appConfig } from "@/lib/config";
import { archiveProject, deleteProject, restoreProject, updateProject } from "@/app/actions/projects";
import type { Project, Role } from "@/lib/types";

export function SettingsView({ project, role, canAdmin, counts, usedBytes }: {
  project: Project; role: Role; canAdmin: boolean; counts: { boards: number; cards: number; images: number }; usedBytes: number;
}) {
  const { t, formatDate } = useI18n();
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = role === "owner";
  const archived = !!project.archived_at;
  const dirty = name !== project.name || description !== project.description;
  const restoreUntil = archived ? new Date(new Date(project.archived_at!).getTime() + appConfig.archiveRestoreDays * 86_400_000) : null;

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError(t("error.name_required")); return; }
    setSaving(true); setError(null);
    try {
      const res = await updateProject(project.id, { name, description });
      if (res.ok) { toast({ kind: "success", message: t("common.saved") }); router.refresh(); }
      else setError(t(errorKey(res.error)));
    } catch { setError(t("error.network")); }
    finally { setSaving(false); }
  };

  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    try {
      const res = await fn();
      if (res.ok) { toast({ kind: "success", message: t("common.saved") }); after ? after() : router.refresh(); }
      else toast({ kind: "error", message: t(errorKey(res.error ?? "generic")) });
    } catch { toast({ kind: "error", message: t("error.network") }); }
  };

  return (
    <div className="pb-16">
      <ProjectHeader project={project} role={role} />
      <div className="mx-auto max-w-3xl space-y-12 px-4 pt-8 sm:px-8">
        <section aria-labelledby="general-h">
          <h2 id="general-h" className="text-lg font-semibold">{t("settings.general")}</h2>
          <form onSubmit={save} className="mt-4 space-y-5" noValidate>
            <Field label={t("common.name")} error={error}>
              {(p) => <input {...p} className="field" value={name} maxLength={120} disabled={!canAdmin} onChange={(e) => { setName(e.target.value); setError(null); }} />}
            </Field>
            <Field label={t("common.description")} optional={t("common.optional")}>
              {(p) => <textarea {...p} className="field min-h-24 py-2.5" value={description} maxLength={2000} disabled={!canAdmin} onChange={(e) => setDescription(e.target.value)} />}
            </Field>
            {canAdmin && <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>{t("common.save")}</Button>}
          </form>
        </section>

        <section aria-labelledby="storage-h">
          <h2 id="storage-h" className="text-lg font-semibold">{t("settings.storage")}</h2>
          <StorageMeter usedBytes={usedBytes} className="mt-4 max-w-md" />
          <p className="hint">{t("cards.imagesHint")}</p>
        </section>

        <section aria-labelledby="danger-h" className="rounded-[var(--radius-lane)] border border-danger/30 p-5">
          <h2 id="danger-h" className="text-lg font-semibold text-danger">{t("settings.danger")}</h2>
          {!isOwner && <p className="mt-2 text-sm text-muted">{t("settings.ownerOnly")}</p>}

          <div className="mt-4 flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-start">
            <div className="flex-1">
              <h3 className="font-medium">{archived ? t("projects.restore") : t("settings.archive")}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {archived
                  ? (restoreUntil!.getTime() > Date.now() ? t("projects.restoreUntil", { date: formatDate(restoreUntil!.toISOString()) }) : t("projects.restoreExpired"))
                  : t("settings.archiveBody")}
              </p>
            </div>
            {isOwner && !archived && (
              <Button icon={<Archive className="size-4" aria-hidden />} onClick={async () => {
                if (await confirm({ title: t("settings.archive"), body: t("settings.archiveConfirm", { name: project.name }), confirmLabel: t("settings.archive") }))
                  await act(() => archiveProject(project.id));
              }}>{t("settings.archive")}</Button>
            )}
            {isOwner && archived && restoreUntil!.getTime() > Date.now() && (
              <Button icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => act(() => restoreProject(project.id))}>{t("projects.restore")}</Button>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex-1">
              <h3 className="font-medium">{t("settings.deleteForever")}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {archived ? t("settings.deleteBody", counts) : t("settings.deleteNeedsArchive")}
              </p>
            </div>
            {isOwner && (
              <Button variant="danger" disabled={!archived} icon={<Trash2 className="size-4" aria-hidden />} onClick={async () => {
                const yes = await confirm({
                  title: t("settings.deleteForever"), body: t("settings.deleteBody", counts), danger: true,
                  confirmLabel: t("settings.deleteForever"), typeToConfirm: project.name, typeLabel: t("boards.typeToConfirm", { name: project.name }),
                });
                if (yes) await act(() => deleteProject(project.id, project.name), () => router.push("/projects"));
              }}>{t("settings.deleteForever")}</Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
