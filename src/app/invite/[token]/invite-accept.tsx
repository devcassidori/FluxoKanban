"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { errorKey } from "@/lib/i18n/dictionaries";
import { acceptInvitation } from "@/app/actions/projects";

export function InviteAccept({ token }: { token: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <Button variant="primary" className="w-full" loading={busy} onClick={async () => {
        setBusy(true); setError(null);
        try {
          const res = await acceptInvitation(token);
          if (res.ok) router.push(`/projects/${res.data}`);
          else setError(t(errorKey(res.error)));
        } catch { setError(t("error.network")); }
        finally { setBusy(false); }
      }}>{t("invite.accept")}</Button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
