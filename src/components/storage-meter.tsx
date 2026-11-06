"use client";
import { clsx } from "clsx";
import { useI18n } from "@/lib/i18n/client";
import { appConfig } from "@/lib/config";

export function StorageMeter({ usedBytes, className }: { usedBytes: number; className?: string }) {
  const { t, formatBytes } = useI18n();
  const total = appConfig.images.projectQuotaBytes;
  const pct = Math.min(100, (usedBytes / total) * 100);
  const free = Math.max(0, total - usedBytes);
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{t("upload.storage")}</span>
        <span className="tabular-nums text-muted">{Math.round(pct)}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken" role="meter" aria-valuemin={0} aria-valuemax={total} aria-valuenow={usedBytes}
        aria-label={t("upload.storage")} aria-valuetext={t("upload.storageUsage", { used: formatBytes(usedBytes), total: formatBytes(total), free: formatBytes(free) })}>
        <div className={clsx("h-full rounded-full", pct > 90 ? "bg-danger" : pct > 75 ? "bg-soon" : "bg-accent")} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-[13px] tabular-nums text-muted">
        {t("upload.storageUsage", { used: formatBytes(usedBytes), total: formatBytes(total), free: formatBytes(free) })}
      </p>
    </div>
  );
}
