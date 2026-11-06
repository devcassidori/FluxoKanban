"use client";
import { clsx } from "clsx";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertTriangle, ImagePlus, RotateCcw, Trash2, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RichEditor } from "@/components/rich-editor";
import { DueBadge } from "@/components/due-badge";
import { Spinner } from "@/components/ui/spinner";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { errorKey, type DictKey } from "@/lib/i18n/dictionaries";
import { isNetworkError } from "@/lib/sync";
import { appConfig } from "@/lib/config";
import { deleteCardImage, precheck, uploadCardImage, UploadError } from "@/lib/upload";
import { updateCard, type CardPatch } from "@/app/actions/board-content";
import { ConflictDialog } from "./conflict-dialog";
import type { Card, CardImage, Column, Member } from "@/lib/types";

interface Upload { key: string; file: File; pct: number; error?: string }
interface Draft { form: CardPatch; baseVersion: number; at: number }

const draftKey = (id: string) => `fluxo:draft:card:${id}`;
const toPatch = (c: Card): CardPatch => ({ title: c.title, description: c.description, assignee_id: c.assignee_id, due_date: c.due_date });
const samePatch = (a: CardPatch, b: CardPatch) =>
  a.title.trim() === b.title.trim() && a.description === b.description && a.assignee_id === b.assignee_id && (a.due_date || null) === (b.due_date || null);

export function CardDialog({ card, deleted, columns, members, images, canWrite, onClose, onSaved, onMove, onDelete, onImagesChange }: {
  card: Card;
  deleted: boolean;
  columns: Column[];
  members: Member[];
  images: CardImage[];
  canWrite: boolean;
  onClose: () => void;
  onSaved: (c: Card) => void;
  onMove: (columnId: string) => void;
  onDelete: () => Promise<boolean>;
  onImagesChange: (fn: (imgs: CardImage[]) => CardImage[]) => void;
}) {
  const { t, formatDateTime } = useI18n();
  const confirm = useConfirm();
  const { toast } = useToast();
  const titleId = useId();
  const descId = useId();
  const [form, setForm] = useState<CardPatch>(() => toPatch(card));
  const [baseVersion, setBaseVersion] = useState(card.version);
  const [base, setBase] = useState<CardPatch>(() => toPatch(card));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState(false);
  const [restored, setRestored] = useState(false);
  const [conflict, setConflict] = useState<{ current: Card; mine: CardPatch } | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = !samePatch(form, base);
  const column = columns.find((c) => c.id === card.column_id);
  const assignable = members.filter((m) => m.active);
  const currentAssignee = members.find((m) => m.user_id === form.assignee_id);

  // Recupera rascunho salvo neste aparelho (queda de rede, aba fechada).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(card.id));
      if (!raw) return;
      const d = JSON.parse(raw) as Draft;
      if (!samePatch(d.form, toPatch(card))) {
        setForm(d.form); setBaseVersion(d.baseVersion); setRestored(true);
      } else localStorage.removeItem(draftKey(card.id));
    } catch { /* ignora rascunho corrompido */ }
    // só ao abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  // Guarda o rascunho enquanto houver alterações não salvas.
  useEffect(() => {
    try {
      if (dirty) localStorage.setItem(draftKey(card.id), JSON.stringify({ form, baseVersion, at: Date.now() } satisfies Draft));
      else localStorage.removeItem(draftKey(card.id));
    } catch { /* armazenamento indisponível */ }
  }, [form, dirty, baseVersion, card.id]);

  // Se outra pessoa salvou e eu não mexi em nada, mostro a versão nova.
  useEffect(() => {
    if (!dirty && !restored && card.version !== baseVersion) {
      setForm(toPatch(card)); setBase(toPatch(card)); setBaseVersion(card.version);
    }
  }, [card, dirty, restored, baseVersion]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const save = useCallback(async (values: CardPatch, version: number) => {
    if (!values.title.trim()) { setTitleError(true); return; }
    setSaving(true); setError(null);
    try {
      const res = await updateCard(card.id, version, values);
      if (res.ok) {
        localStorage.removeItem(draftKey(card.id));
        onSaved(res.data);
        setForm(toPatch(res.data)); setBase(toPatch(res.data)); setBaseVersion(res.data.version);
        setRestored(false); setConflict(null);
        toast({ kind: "success", message: t("common.saved") });
      } else if (res.error === "conflict" && "current" in res) {
        onSaved(res.current);
        setConflict({ current: res.current, mine: res.sanitized });
      } else {
        setError(t(errorKey(res.error)));
      }
    } catch (e) {
      setError(isNetworkError(e) ? `${t("cards.saveFailed")} ${t("error.network")}` : t("cards.saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [card.id, onSaved, t, toast]);

  const discardDraft = () => {
    localStorage.removeItem(draftKey(card.id));
    setForm(toPatch(card)); setBase(toPatch(card)); setBaseVersion(card.version); setRestored(false);
  };

  const requestClose = () => !dirty || window.confirm(t("common.unsavedLeave"));

  // ----- imagens -----
  const startUpload = useCallback(async (u: Upload) => {
    setUploads((l) => l.map((x) => (x.key === u.key ? { ...x, pct: 0, error: undefined } : x)));
    try {
      const img = await uploadCardImage(card.id, u.file, (pct) => setUploads((l) => l.map((x) => (x.key === u.key ? { ...x, pct } : x))));
      onImagesChange((list) => (list.some((i) => i.id === img.id) ? list : [...list, img]));
      setUploads((l) => l.filter((x) => x.key !== u.key));
      toast({ kind: "success", message: t("upload.done") });
    } catch (e) {
      const code = e instanceof UploadError ? e.code : "generic";
      setUploads((l) => l.map((x) => (x.key === u.key ? { ...x, error: code } : x)));
    }
  }, [card.id, onImagesChange, t, toast]);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    let count = images.length + uploads.filter((u) => !u.error).length;
    for (const file of Array.from(files)) {
      const reason = precheck(file, count);
      if (reason) { toast({ kind: "error", message: `${file.name}: ${t(`upload.error.${reason}` as DictKey)}` }); continue; }
      count++;
      const u: Upload = { key: crypto.randomUUID(), file, pct: 0 };
      setUploads((l) => [...l, u]);
      void startUpload(u);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = async (img: CardImage) => {
    if (!(await confirm({ title: t("cards.removeImage"), body: t("cards.removeImageConfirm"), danger: true, confirmLabel: t("common.remove") }))) return;
    try {
      await deleteCardImage(img.id);
      onImagesChange((l) => l.filter((i) => i.id !== img.id));
    } catch (e) {
      toast({ kind: "error", message: t(errorKey(e instanceof UploadError ? e.code : "generic")) });
    }
  };

  const slotsLeft = appConfig.images.perCard - images.length - uploads.filter((u) => !u.error).length;
  const assigneeOptions = useMemo(() => {
    const opts = assignable.map((m) => ({ id: m.user_id, label: m.profile.name }));
    if (currentAssignee && !currentAssignee.active) opts.push({ id: currentAssignee.user_id, label: `${currentAssignee.profile.name} ${t("cards.inactiveAssignee")}` });
    return opts;
  }, [assignable, currentAssignee, t]);

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        beforeClose={requestClose}
        size="lg"
        fullScreenMobile
        title={<span className="sr-only">{form.title || t("cards.title")}</span>}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            {column && <span>{column.name}</span>}
            <span>{t("cards.updatedAt", { date: formatDateTime(card.updated_at) })}</span>
          </span>
        }
        footer={canWrite && !deleted && (
          <>
            <Button variant="danger-ghost" className="mr-auto px-2 sm:px-3" icon={<Trash2 className="size-4" aria-hidden />}
              onClick={async () => {
                if (await confirm({ title: t("cards.delete"), body: t("cards.deleteConfirm", { title: card.title }), danger: true, confirmLabel: t("common.delete") })) {
                  if (await onDelete()) { localStorage.removeItem(draftKey(card.id)); onClose(); }
                }
              }}>{t("cards.delete")}</Button>
            {dirty && <span className="text-[13px] text-muted max-sm:sr-only" role="status">{t("cards.unsaved")}</span>}
            <Button onClick={() => { if (requestClose()) onClose(); }}>{t("common.close")}</Button>
            <Button variant="primary" loading={saving} disabled={!dirty} onClick={() => save(form, baseVersion)}>{t("common.save")}</Button>
          </>
        )}
      >
        {deleted && (
          <p role="alert" className="mb-4 flex items-center gap-2 rounded-[var(--radius-control)] bg-danger-soft px-3 py-2.5 text-sm text-danger">
            <AlertTriangle className="size-4" aria-hidden />{t("cards.notFound")}
          </p>
        )}
        {restored && (
          <div role="status" className="mb-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] bg-accent-soft px-3 py-2 text-sm">
            <span className="flex-1">{t("cards.draftRestored")}</span>
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-4" aria-hidden />} onClick={discardDraft}>{t("cards.discardDraft")}</Button>
          </div>
        )}
        {error && (
          <div role="alert" className="mb-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] bg-danger-soft px-3 py-2 text-sm text-danger">
            <span className="flex-1">{error}</span>
            <Button size="sm" variant="ghost" onClick={() => save(form, baseVersion)}>{t("common.retry")}</Button>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0 space-y-5">
            <div>
              <label htmlFor={titleId} className="sr-only">{t("cards.title")}</label>
              <textarea
                id={titleId}
                rows={1}
                value={form.title}
                maxLength={200}
                readOnly={!canWrite || deleted}
                aria-invalid={titleError || undefined}
                aria-describedby={titleError ? `${titleId}-err` : undefined}
                onChange={(e) => { setForm((f) => ({ ...f, title: e.target.value.replace(/\n/g, " ") })); setTitleError(false); }}
                className="field min-h-12 resize-none border-transparent px-2 py-2 text-[22px] font-semibold leading-snug hover:border-line-strong [field-sizing:content]"
              />
              {titleError && <p id={`${titleId}-err`} role="alert" className="mt-1 text-[13px] font-medium text-danger">{t("error.title_required")}</p>}
            </div>

            <div>
              <span id={descId} className="label">{t("cards.description")}</span>
              <RichEditor value={form.description} labelledBy={descId} disabled={!canWrite || deleted}
                placeholder={t("cards.descriptionPlaceholder")}
                onChange={(html) => setForm((f) => ({ ...f, description: html }))} />
            </div>

            <section aria-labelledby={`${descId}-img`}>
              <div className="flex items-baseline justify-between">
                <h3 id={`${descId}-img`} className="label mb-0">{t("cards.images")} <span className="font-normal tabular-nums text-muted">{images.length}/{appConfig.images.perCard}</span></h3>
              </div>
              <p className="hint mt-0.5">{t("cards.imagesHint")}</p>
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {images.map((img) => (
                  <li key={img.id} className="group relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-sunken">
                    <a href={`/api/images/${img.id}`} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/images/${img.id}`} alt={`${t("cards.images")} ${images.indexOf(img) + 1}`} loading="lazy" className="size-full object-cover" />
                    </a>
                    {canWrite && !deleted && (
                      <button onClick={() => removeImage(img)} aria-label={t("cards.removeImage")}
                        className="absolute right-1 top-1 inline-flex size-11 items-center justify-center rounded-full bg-surface/90 text-ink shadow hover:text-danger">
                        <X className="size-4" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
                {uploads.map((u) => (
                  <li key={u.key} className={clsx("flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed p-3 text-center text-[13px]",
                    u.error ? "border-danger/50 bg-danger-soft text-danger" : "border-line-strong text-muted")}>
                    {u.error ? (
                      <>
                        <span role="alert">{t("upload.failed", { name: u.file.name })} {u.error !== "generic" && u.error !== "network" ? t(`upload.error.${u.error}` as DictKey) : ""}</span>
                        <span className="flex gap-1">
                          {(u.error === "generic" || u.error === "network") && <Button size="sm" variant="ghost" onClick={() => startUpload(u)}>{t("common.retry")}</Button>}
                          <Button size="sm" variant="ghost" onClick={() => setUploads((l) => l.filter((x) => x.key !== u.key))}>{t("common.close")}</Button>
                        </span>
                      </>
                    ) : (
                      <>
                        <Spinner className="size-5" />
                        <span aria-live="polite">{t("upload.uploading", { name: u.file.name, pct: u.pct })}</span>
                        <span className="h-1.5 w-full overflow-hidden rounded-full bg-sunken" aria-hidden>
                          <span className="block h-full bg-accent transition-[width]" style={{ width: `${u.pct}%` }} />
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {canWrite && !deleted && slotsLeft > 0 && (
                <>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1}
                    aria-hidden onChange={(e) => onFiles(e.target.files)} />
                  <Button className="mt-3" icon={<ImagePlus className="size-4" aria-hidden />} onClick={() => fileRef.current?.click()}>{t("cards.addImage")}</Button>
                </>
              )}
            </section>
          </div>

          <aside className="space-y-5 md:border-l md:border-line md:pl-6">
            <div>
              <label className="label" htmlFor={`${titleId}-col`}>{t("cards.column")}</label>
              <select id={`${titleId}-col`} className="field" value={card.column_id} disabled={!canWrite || deleted}
                onChange={(e) => onMove(e.target.value)}>
                {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor={`${titleId}-as`}>{t("cards.assignee")}</label>
              <select id={`${titleId}-as`} className="field" value={form.assignee_id ?? ""} disabled={!canWrite || deleted}
                onChange={(e) => setForm((f) => ({ ...f, assignee_id: e.target.value || null }))}>
                <option value="">{t("cards.unassigned")}</option>
                {assigneeOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor={`${titleId}-due`}>{t("cards.dueDate")}</label>
              <div className="flex gap-1">
                <input id={`${titleId}-due`} type="date" className="field" value={form.due_date ?? ""} disabled={!canWrite || deleted}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value || null }))} />
                {form.due_date && canWrite && !deleted && (
                  <button type="button" aria-label={t("cards.clearDue")} title={t("cards.clearDue")} onClick={() => setForm((f) => ({ ...f, due_date: null }))}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-sunken">
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </div>
              <div className="mt-2"><DueBadge due={form.due_date} done={!!column?.is_done} /></div>
              {column?.is_done && <p className="hint">{t("columns.doneHint")}</p>}
            </div>
            <dl className="space-y-1 border-t border-line pt-4 text-[13px] text-muted">
              <div><dt className="sr-only">{t("cards.createdAt", { date: "" })}</dt><dd>{t("cards.createdAt", { date: formatDateTime(card.created_at) })}</dd></div>
              <div><dt className="sr-only">{t("cards.updatedAt", { date: "" })}</dt><dd>{t("cards.updatedAt", { date: formatDateTime(card.updated_at) })}</dd></div>
            </dl>
          </aside>
        </div>
      </Dialog>

      {conflict && (
        <ConflictDialog
          mine={conflict.mine}
          current={conflict.current}
          members={members}
          saving={saving}
          onCancel={() => setConflict(null)}
          onResolve={(merged) => save(merged, conflict.current.version)}
        />
      )}
    </>
  );
}
