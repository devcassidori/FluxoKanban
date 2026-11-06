import "server-only";

/**
 * Envia o e-mail de convite via Resend quando RESEND_API_KEY está configurada.
 * Sem chave, devolve false e a interface mostra o link para copiar.
 */
export async function sendInviteEmail(opts: { to: string; projectName: string; inviterName: string; link: string; locale: "pt-BR" | "en" }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const pt = opts.locale === "pt-BR";
  const subject = pt ? `Convite para o projeto ${opts.projectName}` : `Invitation to ${opts.projectName}`;
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#161920">
      <p>${esc(opts.inviterName)} ${pt ? "convidou você para o projeto" : "invited you to the project"} <strong>${esc(opts.projectName)}</strong>.</p>
      <p><a href="${esc(opts.link)}" style="display:inline-block;background:#2c46cc;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">
        ${pt ? "Ver convite" : "View invitation"}</a></p>
      <p style="color:#5b6272;font-size:13px">${pt ? "O convite expira em 7 dias." : "This invitation expires in 7 days."}</p>
    </div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.INVITE_FROM_EMAIL, to: opts.to, subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
