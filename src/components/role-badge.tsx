"use client";
import { clsx } from "clsx";
import { Crown, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import type { Role } from "@/lib/types";

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  const { t } = useI18n();
  if (role === "member") return null;
  const Icon = role === "owner" ? Crown : ShieldCheck;
  return (
    <span className={clsx("inline-flex shrink-0 items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-[12px] font-medium text-ink-2", className)}>
      <Icon className="size-3.5" aria-hidden />{t(role === "owner" ? "projects.role.owner" : "projects.role.admin")}
    </span>
  );
}
