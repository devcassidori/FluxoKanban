"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Archive, FolderPlus, Layers, RotateCcw, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NameDescriptionDialog } from "@/components/project-form-dialog";
import { RoleBadge } from "@/components/role-badge";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { errorKey } from "@/lib/i18n/dictionaries";
import { appConfig } from "@/lib/config";
import { createProject, deleteProject, restoreProject } from "@/app/actions/projects";
import type { Role } from "@/lib/types";

interface Row { id: string; name: string; description: string; archived_at: string | null; updated_at: string; boards: number; members: number; role: Role }

export function ProjectsView({ projects, openNew, notice }: { projects: Row[]; openNew: boolean; notice: "reset" | "confirmed" | null }) {
  const { t, formatDate } = useI18n();
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [creating, setCreating] = useState(openNew);
  const active = projects.filter((p) => !p.archived_at);
  const archived = projects.filter((p) => p.archived_at);

  useEffect(() => { if (openNew) setCreating(true); }, [openNew]);
  useEffect(() => {
    if (notice === "reset") toast({ kind: "success", message: t("auth.reset.done") });
    if (notice === "confirmed") toast({ kind: "success", message: t("auth.confirmed") });
  }, [notice, t, toast]);

  const restore = async (p: Row) => {
    const res = await restoreProject(p.id);
    if (res.ok) { toast({ kind: "success", message: t("common.saved") }); router.refresh(); }
    else toast({ kind: "error", message: t(errorKey(res.error)) });
  };

  const remove = async (p: Row) => {
    const yes = await confirm({
      title: t("settings.deleteForever"),
      body: t("settings.deleteBodyShort"),
      danger: true,
      confirmLabel: t("settings.deleteForever"),
      typeToConfirm: p.name,
      typeLabel: t("boards.typeToConfirm", { name: p.name }),
    });
    if (!yes) return;
    const res = await deleteProject(p.id, p.name);
    if (res.ok) { toast({ kind: "success", message: t("common.saved") }); router.refresh(); }
    else toast({ kind: "error", message: t(errorKey(res.error)) });
  };

  return (
    <div className="pb-16">
      <PageHeader
        title={t("projects.title")}
        actions={active.length > 0 && <Button variant="primary" icon={<FolderPlus className="size-4" aria-hidden />} onClick={() => setCreating(true)}>{t("projects.new")}</Button>}
      />

      <div className="mx-auto max-w-5xl px-4 sm:px-8">
        {active.length === 0 ? (
          <EmptyState
            icon={<FolderPlus className="size-6" />}
            title={t("projects.emptyTitle")}
            body={t("projects.emptyBody")}
            action={<Button variant="primary" onClick={() => setCreating(true)}>{t("projects.new")}</Button>}
          />
        ) : (
          <ul className="mt-6 divide-y divide-line overflow-hidden rounded-[var(--radius-lane)] border border-line bg-surface">
            {active.map((p) => (
              <li key={p.id} className="group relative">
                <Link href={`/projects/${p.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-paper/60 sm:flex-row sm:items-center sm:gap-6 focus-visible:-outline-offset-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[16px] font-semibold">{p.name}</span>
                      <RoleBadge role={p.role} />
                    </div>
                    {p.description && <p className="mt-0.5 line-clamp-1 text-sm text-muted">{p.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-5 text-sm tabular-nums text-muted">
                    <span className="inline-flex items-center gap-1.5"><Layers className="size-4" aria-hidden />{t("projects.boardsCount", { n: p.boards })}</span>
                    <span className="inline-flex items-center gap-1.5"><Users className="size-4" aria-hidden />{t("projects.membersCount", { n: p.members })}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {archived.length > 0 && (
          <section className="mt-12" aria-labelledby="archived-h">
            <h2 id="archived-h" className="flex items-center gap-2 text-base font-semibold text-ink-2">
              <Archive className="size-4" aria-hidden />{t("projects.archived")}
            </h2>
            <ul className="mt-3 divide-y divide-line rounded-[var(--radius-lane)] border border-dashed border-line-strong">
              {archived.map((p) => {
                const until = new Date(new Date(p.archived_at!).getTime() + appConfig.archiveRestoreDays * 86_400_000);
                const canRestore = until.getTime() > Date.now();
                return (
                  <li key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <Link href={`/projects/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                      <p className="mt-0.5 text-sm text-muted">
                        {t("projects.archivedOn", { date: formatDate(p.archived_at) })} —{" "}
                        {canRestore ? t("projects.restoreUntil", { date: formatDate(until.toISOString()) }) : t("projects.restoreExpired")}
                      </p>
                    </div>
                    {p.role === "owner" && (
                      <div className="flex gap-2">
                        {canRestore && <Button size="sm" icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => restore(p)}>{t("projects.restore")}</Button>}
                        <Button size="sm" variant="danger-ghost" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => remove(p)}>{t("settings.deleteForever")}</Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      <NameDescriptionDialog
        open={creating}
        onClose={() => { setCreating(false); if (openNew) router.replace("/projects"); }}
        title={t("projects.new")}
        submitLabel={t("common.create")}
        onSubmit={(v) => createProject(v)}
        onDone={(id) => { setCreating(false); toast({ kind: "success", message: t("projects.created") }); router.push(`/projects/${id}`); }}
      />
    </div>
  );
}
