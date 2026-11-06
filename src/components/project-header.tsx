"use client";
import { clsx } from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { RoleBadge } from "./role-badge";
import type { Project, Role } from "@/lib/types";

export function ProjectHeader({ project, role, actions }: { project: Project; role: Role; actions?: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const base = `/projects/${project.id}`;
  const tabs = [
    { href: base, label: t("nav.boards") },
    { href: `${base}/members`, label: t("nav.members") },
    { href: `${base}/settings`, label: t("nav.settings") },
  ];
  return (
    <div className="border-b border-line bg-surface/60">
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-8 sm:pt-8">
        {project.archived_at && (
          <p role="status" className="mb-4 inline-flex items-center gap-2 rounded-full bg-soon-soft px-3 py-1.5 text-sm font-medium text-soon">
            <Archive className="size-4" aria-hidden />{t("projects.readOnly")}
          </p>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-[26px] font-semibold leading-tight sm:text-[30px]">{project.name}</h1>
              <RoleBadge role={role} />
            </div>
            {project.description && <p className="mt-1.5 max-w-[65ch] whitespace-pre-line text-[15px] text-muted">{project.description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        <nav aria-label={project.name} className="-mb-px mt-5 flex gap-1 overflow-x-auto scrollbar-thin">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined}
                className={clsx("inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-[15px]",
                  active ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink")}>
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
