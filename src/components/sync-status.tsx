"use client";
import { clsx } from "clsx";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { useSync } from "@/lib/sync";
import { useI18n } from "@/lib/i18n/client";

export function SyncStatus() {
  const { online, realtime, pending, flushing } = useSync();
  const { t } = useI18n();

  let tone: "ok" | "warn" | "off" = "ok";
  let label = t("sync.online");
  let Icon = Wifi;
  if (!online) { tone = "off"; label = t("sync.offline"); Icon = CloudOff; }
  else if (flushing || pending > 0) { tone = "warn"; label = pending ? t("sync.pending", { n: pending }) : t("sync.syncing"); Icon = RefreshCw; }
  else if (realtime === "connecting" || realtime === "error") { tone = "warn"; label = t("sync.connecting"); Icon = RefreshCw; }

  return (
    <div role="status" aria-live="polite"
      className={clsx("inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-[13px] font-medium",
        tone === "ok" && "text-muted",
        tone === "warn" && "bg-soon-soft text-soon",
        tone === "off" && "bg-danger-soft text-danger")}>
      <Icon aria-hidden className={clsx("size-4", (flushing || realtime === "connecting") && online && "animate-spin [animation-duration:2s]")} />
      <span className={clsx(tone === "ok" && "max-sm:sr-only")}>{label}</span>
    </div>
  );
}
