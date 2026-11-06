"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Columns3, LayoutDashboard, Plus } from "lucide-react";
import { ProjectHeader } from "@/components/project-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NameDescriptionDialog } from "@/components/project-form-dialog";
import { ColumnsEditor } from "@/components/columns-editor";
import { useI18n } from "@/lib/i18n/client";
import { createBoard } from "@/app/actions/boards";
import type { Project, Role } from "@/lib/types";

interface BoardRow { id: string; name: string; description: string; updated_at: string; cards: number; columns: number }

export function ProjectBoardsView({ project, role, canAdmin, boards }: { project: Project; role: Role; canAdmin: boolean; boards: BoardRow[] }) {
  const { t, formatDate } = useI18n();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);

  const openCreate = () => { setColumns(t("boards.defaultColumns").split("|")); setCreating(true); };

  return (
    <div className="pb-16">
      <ProjectHeader project={project} role={role}
        actions={canAdmin && boards.length > 0 && <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={openCreate}>{t("boards.new")}</Button>} />

      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-8">
        {boards.length === 0 ? (
          <EmptyState
            icon={<LayoutDashboard className="size-6" />}
            title={t("boards.emptyTitle")}
            body={canAdmin ? t("boards.emptyBody") : t("boards.emptyMember")}
            action={canAdmin && <Button variant="primary" onClick={openCreate}>{t("boards.new")}</Button>}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {boards.map((b) => (
              <li key={b.id}>
                <Link href={`/projects/${project.id}/boards/${b.id}`}
                  className="flex h-full flex-col rounded-[var(--radius-lane)] border border-line bg-surface p-5 transition-colors hover:border-line-strong">
                  <span className="text-[16px] font-semibold">{b.name}</span>
                  {b.description && <span className="mt-1 line-clamp-2 text-sm text-muted">{b.description}</span>}
                  <span className="mt-auto flex items-center gap-4 pt-4 text-sm tabular-nums text-muted">
                    <span className="inline-flex items-center gap-1.5"><Columns3 className="size-4" aria-hidden />{b.columns}</span>
                    <span>{t("boards.cards", { n: b.cards })}</span>
                    <span className="ml-auto">{formatDate(b.updated_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <NameDescriptionDialog
        open={creating}
        onClose={() => setCreating(false)}
        title={t("boards.new")}
        submitLabel={t("common.create")}
        onSubmit={(v) => createBoard(project.id, { ...v, columns })}
        onDone={(id) => { setCreating(false); router.push(`/projects/${project.id}/boards/${id}`); }}
        extra={<ColumnsEditor value={columns} onChange={setColumns} />}
      />
    </div>
  );
}
