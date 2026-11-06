// Configurações de produto que ainda dependem de validação.
// Mantidas explícitas e em um só lugar para ajuste fácil.

function envInt(v: string | undefined, fallback: number) {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const appConfig = {
  /** VALIDAÇÃO PENDENTE nº 9 — America/Sao_Paulo é só a recomendação inicial. */
  timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || "America/Sao_Paulo",
  /** Janela de "vence em breve", em dias antes do prazo (decisão: 3). */
  dueSoonDays: envInt(process.env.NEXT_PUBLIC_DUE_SOON_DAYS, 3),
  /** VALIDAÇÃO PENDENTE nº 8 — o dia do vencimento conta como "vence em breve"? */
  dueSoonIncludesDueDate: (process.env.NEXT_PUBLIC_DUE_SOON_INCLUDES_DUE_DATE ?? "true") !== "false",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  images: {
    maxBytes: 10 * 1024 * 1024,
    perCard: 3,
    projectQuotaBytes: 1000 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  },
  archiveRestoreDays: 30,
  inviteValidityDays: 7,
} as const;
