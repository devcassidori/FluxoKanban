"use client";
import { clsx } from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Crown, LogOut, MailPlus, MoreHorizontal, RefreshCw, ShieldCheck, ShieldOff, UserCheck, UserMinus, UserX, XCircle } from "lucide-react";
import { ProjectHeader } from "@/components/project-header";
import { Avatar } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { RoleBadge } from "@/components/role-badge";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { errorKey } from "@/lib/i18n/dictionaries";
import {
  cancelInvitation, createInvitation, leaveProject, removeMember, resendInvitation,
  setMemberActive, setMemberRole, transferOwnership,
} from "@/app/actions/projects";
import type { ActionResult, Invitation, Member, Project, Role } from "@/lib/types";

export function MembersView({ project, role, meId, members, invitations, canAdmin, siteUrl }: {
  project: Project; role: Role; meId: string; members: Member[]; invitations: Invitation[]; canAdmin: boolean; siteUrl: string;
}) {
  const { t, formatDate } = useI18n();
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [sending, setSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [linkToShare, setLinkToShare] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ member: Member; count: number } | null>(null);
  const isOwner = role === "owner";
  const archived = !!project.archived_at;

  const run = async (p: Promise<ActionResult<unknown>>, success = t("common.saved")) => {
    try {
      const res = await p;
      if (res.ok) { toast({ kind: "success", message: success }); router.refresh(); return true; }
      toast({ kind: "error", message: t(errorKey(res.error)) });
    } catch { toast({ kind: "error", message: t("error.network") }); }
    return false;
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null); setLinkToShare(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setInviteError(t("error.invalid_email")); return; }
    setSending(true);
    try {
      const res = await createInvitation(project.id, email, inviteRole);
      if (!res.ok) { setInviteError(t(errorKey(res.error))); return; }
      if (res.data.sent) toast({ kind: "success", message: t("members.inviteSent", { email }) });
      else setLinkToShare(res.data.link);
      setEmail("");
      router.refresh();
    } catch { setInviteError(t("error.network")); }
    finally { setSending(false); }
  };

  const resend = async (inv: Invitation) => {
    try {
      const res = await resendInvitation(project.id, inv.id);
      if (!res.ok) { toast({ kind: "error", message: t(errorKey(res.error)) }); return; }
      if (res.data.sent) toast({ kind: "success", message: t("members.inviteSent", { email: inv.email }) });
      else setLinkToShare(res.data.link);
      router.refresh();
    } catch { toast({ kind: "error", message: t("error.network") }); }
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast({ kind: "success", message: t("common.copied") }); }
    catch { /* área de transferência indisponível: o texto continua visível */ }
  };

  const startRemove = async (m: Member) => {
    const yes = await confirm({ title: t("members.remove"), body: t("members.removeConfirm", { name: m.profile.name }), danger: true, confirmLabel: t("common.remove") });
    if (!yes) return;
    try {
      const res = await removeMember(project.id, m.user_id, null);
      if (res.ok) { toast({ kind: "success", message: t("common.saved") }); router.refresh(); return; }
      if (res.error === "member_has_cards") setRemoving({ member: m, count: Number(res.detail) || 0 });
      else toast({ kind: "error", message: t(errorKey(res.error)) });
    } catch { toast({ kind: "error", message: t("error.network") }); }
  };

  const itemsFor = (m: Member): MenuItem[] => {
    const self = m.user_id === meId;
    const manageable = !archived && !self && m.role !== "owner" && (isOwner || (canAdmin && m.role === "member"));
    return [
      { label: t("members.makeAdmin"), icon: <ShieldCheck />, hidden: !(isOwner && !archived && m.role === "member" && m.active), onSelect: () => run(setMemberRole(project.id, m.user_id, "admin")) },
      { label: t("members.makeMember"), icon: <ShieldOff />, hidden: !(isOwner && !archived && m.role === "admin"), onSelect: () => run(setMemberRole(project.id, m.user_id, "member")) },
      {
        label: t("members.transfer"), icon: <Crown />, hidden: !(isOwner && !archived && !self && m.active),
        onSelect: async () => {
          if (await confirm({ title: t("members.transfer"), body: t("members.transferConfirm", { name: m.profile.name }), confirmLabel: t("members.transfer") }))
            await run(transferOwnership(project.id, m.user_id));
        },
      },
      { label: m.active ? t("members.deactivate") : t("members.activate"), icon: m.active ? <UserX /> : <UserCheck />, hidden: !manageable,
        onSelect: () => run(setMemberActive(project.id, m.user_id, !m.active)) },
      { label: t("members.remove"), icon: <UserMinus />, danger: true, hidden: !manageable, onSelect: () => startRemove(m) },
      {
        label: t("members.leave"), icon: <LogOut />, danger: true, hidden: !(self && m.role !== "owner"),
        onSelect: async () => {
          if (await confirm({ title: t("members.leave"), body: t("members.leaveConfirm"), danger: true, confirmLabel: t("members.leave") })) {
            const res = await leaveProject(project.id);
            if (res.ok) router.push("/projects"); else toast({ kind: "error", message: t(errorKey(res.error)) });
          }
        },
      },
    ];
  };

  return (
    <div className="pb-16">
      <ProjectHeader project={project} role={role} />
      <div className="mx-auto grid max-w-5xl gap-10 px-4 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="members-h" className="min-w-0">
          <h2 id="members-h" className="text-lg font-semibold">{t("members.title")} <span className="font-normal tabular-nums text-muted">{members.length}</span></h2>
          <p className="mt-1 text-sm text-muted">{t("members.deactivateHint")}</p>
          <ul className="mt-4 divide-y divide-line rounded-[var(--radius-lane)] border border-line bg-surface">
            {members.map((m) => {
              const items = itemsFor(m);
              return (
                <li key={m.user_id} className={clsx("flex items-center gap-3 px-4 py-3", !m.active && "opacity-70")}>
                  <Avatar name={m.profile.name} url={m.profile.avatar_url} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{m.profile.name}{m.user_id === meId && <span className="font-normal text-muted"> ({t("common.you")})</span>}</span>
                      <RoleBadge role={m.role} />
                      {!m.active && <span className="rounded-full border border-line-strong px-2 py-0.5 text-[12px] text-muted">{t("members.inactive")}</span>}
                    </div>
                    <span className="block truncate text-sm text-muted">{m.profile.email}</span>
                  </div>
                  {items.some((i) => !i.hidden) && (
                    <Menu label={`${t("common.actions")}: ${m.profile.name}`} items={items}
                      trigger={(p) => <IconButton {...p} label={p["aria-label"] as string}><MoreHorizontal className="size-5" aria-hidden /></IconButton>} />
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {canAdmin && (
          <aside className="space-y-8">
            <section aria-labelledby="invite-h">
              <h2 id="invite-h" className="text-lg font-semibold">{t("members.invite")}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t("members.inviteHint")}</p>
              <form onSubmit={invite} className="mt-4 space-y-3" noValidate>
                <div>
                  <label className="label" htmlFor="inv-email">{t("members.inviteEmail")}</label>
                  <input id="inv-email" type="email" inputMode="email" autoComplete="off" className="field" value={email}
                    aria-invalid={!!inviteError || undefined} aria-describedby={inviteError ? "inv-err" : undefined}
                    onChange={(e) => { setEmail(e.target.value); setInviteError(null); }} />
                </div>
                <div>
                  <label className="label" htmlFor="inv-role">{t("members.inviteRole")}</label>
                  <select id="inv-role" className="field" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
                    <option value="member">{t("projects.role.member")}</option>
                    {isOwner && <option value="admin">{t("projects.role.admin")}</option>}
                  </select>
                </div>
                {inviteError && <p id="inv-err" role="alert" className="text-sm font-medium text-danger">{inviteError}</p>}
                <Button type="submit" variant="primary" loading={sending} icon={<MailPlus className="size-4" aria-hidden />} className="w-full">{t("members.inviteSend")}</Button>
              </form>
              {linkToShare && (
                <div role="status" className="mt-4 rounded-[var(--radius-card)] border border-line bg-accent-soft/50 p-3">
                  <p className="text-sm">{t("members.inviteLink")}</p>
                  <div className="mt-2 flex gap-2">
                    <input readOnly className="field min-h-11 text-sm" value={linkToShare} onFocus={(e) => e.currentTarget.select()} aria-label="Link" />
                    <IconButton variant="secondary" label={t("common.copy")} onClick={() => copy(linkToShare)}><Copy className="size-4" aria-hidden /></IconButton>
                  </div>
                </div>
              )}
            </section>

            <section aria-labelledby="pending-h">
              <h2 id="pending-h" className="text-base font-semibold">{t("members.invitesPending")}</h2>
              {invitations.length === 0 ? (
                <p className="mt-2 text-sm text-muted">{t("members.emptyInvites")}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {invitations.map((inv) => {
                    const expired = new Date(inv.expires_at).getTime() < Date.now();
                    return (
                      <li key={inv.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-3">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{inv.email}</p>
                            <p className={clsx("text-[13px]", expired ? "font-medium text-danger" : "text-muted")}>
                              {t(inv.role === "admin" ? "projects.role.admin" : "projects.role.member")} —{" "}
                              {expired ? t("members.inviteExpired") : t("members.inviteExpires", { date: formatDate(inv.expires_at) })}
                            </p>
                          </div>
                          <Menu label={`${t("common.actions")}: ${inv.email}`}
                            trigger={(p) => <IconButton {...p} label={p["aria-label"] as string}><MoreHorizontal className="size-5" aria-hidden /></IconButton>}
                            items={[
                              { label: t("members.resend"), icon: <RefreshCw />, onSelect: () => resend(inv) },
                              { label: t("common.copy"), icon: <Copy />, hidden: expired, onSelect: () => copy(`${siteUrl || location.origin}/invite/${inv.token}`) },
                              {
                                label: t("members.cancelInvite"), icon: <XCircle />, danger: true,
                                onSelect: async () => {
                                  if (await confirm({ title: t("members.cancelInvite"), body: t("members.cancelInviteConfirm", { email: inv.email }), danger: true, confirmLabel: t("members.cancelInvite") }))
                                    await run(cancelInvitation(project.id, inv.id));
                                },
                              },
                            ]} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </aside>
        )}
      </div>

      {removing && (
        <RemoveWithCardsDialog
          member={removing.member}
          count={removing.count}
          candidates={members.filter((m) => m.active && m.user_id !== removing.member.user_id)}
          onClose={() => setRemoving(null)}
          onConfirm={async (mode, to) => {
            if (await run(removeMember(project.id, removing.member.user_id, mode, to))) setRemoving(null);
          }}
        />
      )}
    </div>
  );
}

function RemoveWithCardsDialog({ member, count, candidates, onClose, onConfirm }: {
  member: Member; count: number; candidates: Member[]; onClose: () => void;
  onConfirm: (mode: "unassign" | "reassign", to: string | null) => Promise<void>;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"unassign" | "reassign">("unassign");
  const [to, setTo] = useState(candidates[0]?.user_id ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onClose={onClose} size="sm" title={t("members.remove")}
      description={t("members.removeHasCards", { name: member.profile.name, n: count })}
      footer={<>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="danger" loading={busy} disabled={mode === "reassign" && !to}
          onClick={async () => { setBusy(true); await onConfirm(mode, mode === "reassign" ? to : null); setBusy(false); }}>
          {t("common.remove")}
        </Button>
      </>}>
      <fieldset className="space-y-2">
        <legend className="sr-only">{t("members.removeHasCards", { name: member.profile.name, n: count })}</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border border-line px-3">
          <input type="radio" name="mode" checked={mode === "unassign"} onChange={() => setMode("unassign")} className="size-4 accent-[var(--color-accent)]" />
          {t("members.removeUnassign")}
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border border-line px-3"
          aria-disabled={!candidates.length}>
          <input type="radio" name="mode" checked={mode === "reassign"} disabled={!candidates.length} onChange={() => setMode("reassign")} className="size-4 accent-[var(--color-accent)]" />
          {t("members.removeReassign")}
        </label>
        {mode === "reassign" && (
          <select className="field mt-2" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t("members.removeReassign")}>
            {candidates.map((c) => <option key={c.user_id} value={c.user_id}>{c.profile.name} — {c.profile.email}</option>)}
          </select>
        )}
      </fieldset>
    </Dialog>
  );
}
