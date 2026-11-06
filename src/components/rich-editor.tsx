"use client";
import { clsx } from "clsx";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Link2, Link2Off, List, ListOrdered } from "lucide-react";
import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/client";

/** Editor com a formatação básica pedida: negrito, itálico, listas e links. */
export function RichEditor({ value, onChange, labelledBy, disabled, placeholder }: {
  value: string; onChange: (html: string) => void; labelledBy: string; disabled?: boolean; placeholder?: string;
}) {
  const { t } = useI18n();
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: false, codeBlock: false, blockquote: false, horizontalRule: false, code: false, strike: false, underline: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["http", "https", "mailto"] },
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "prose-card px-3 py-2.5",
        "aria-labelledby": labelledBy,
        "aria-multiline": "true",
        role: "textbox",
        ...(placeholder ? { "aria-placeholder": placeholder } : {}),
      },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });

  // Mantém o editor em sincronia quando o valor muda por fora (rascunho, conflito).
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value !== current) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  useEffect(() => { editor?.setEditable(!disabled); }, [disabled, editor]);

  return (
    <div className={clsx("rounded-[var(--radius-control)] border border-line-strong bg-surface focus-within:outline-2 focus-within:outline-[var(--color-focus)]", disabled && "opacity-70")}>
      {!disabled && <Toolbar editor={editor} t={t} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, t }: { editor: Editor | null; t: ReturnType<typeof useI18n>["t"] }) {
  if (!editor) return <div className="h-11 border-b border-line" />;
  const btn = (label: string, active: boolean, onClick: () => void, icon: React.ReactNode) => (
    <button type="button" aria-label={label} title={label} aria-pressed={active} onClick={onClick}
      className={clsx("inline-flex size-11 items-center justify-center rounded-md", active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-sunken")}>
      {icon}
    </button>
  );
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(t("editor.linkPrompt"), prev ?? "https://");
    if (url === null) return;
    if (!url.trim() || url.trim() === "https://") { editor.chain().focus().unsetLink().run(); return; }
    if (!/^(https?:\/\/|mailto:)/i.test(url.trim())) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };
  return (
    <div role="toolbar" aria-label={t("editor.toolbar")} className="flex flex-wrap gap-0.5 border-b border-line p-0.5">
      {btn(t("editor.bold"), editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), <Bold className="size-4" aria-hidden />)}
      {btn(t("editor.italic"), editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), <Italic className="size-4" aria-hidden />)}
      {btn(t("editor.bulletList"), editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), <List className="size-4" aria-hidden />)}
      {btn(t("editor.orderedList"), editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered className="size-4" aria-hidden />)}
      {btn(t("editor.link"), editor.isActive("link"), setLink, <Link2 className="size-4" aria-hidden />)}
      {editor.isActive("link") && btn(t("editor.removeLink"), false, () => editor.chain().focus().unsetLink().run(), <Link2Off className="size-4" aria-hidden />)}
    </div>
  );
}
