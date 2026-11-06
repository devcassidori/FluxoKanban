"use client";
import { clsx } from "clsx";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}

/** Menu acessível (botão + role=menu), navegável por setas, Esc e Tab. */
export function Menu({ trigger, items, label, align = "end" }: {
  trigger: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { ref: React.Ref<HTMLButtonElement> }) => React.ReactNode;
  items: MenuItem[];
  label: string;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const visible = items.filter((i) => !i.hidden);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const width = 240;
    let left = align === "end" ? r.right - width : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const estimated = visible.length * 46 + 12;
    const top = r.bottom + estimated > window.innerHeight - 8 ? Math.max(8, r.top - estimated - 4) : r.bottom + 4;
    setPos({ top, left });
  }, [open, align, visible.length]);

  useEffect(() => {
    if (!open) return;
    const first = list.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not([disabled])");
    first?.focus();
    const onDown = (e: PointerEvent) => {
      if (!list.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", onScroll);
    return () => { document.removeEventListener("pointerdown", onDown); window.removeEventListener("resize", onScroll); };
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const els = Array.from(list.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not([disabled])") ?? []);
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); els[els.length - 1]?.focus(); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); btn.current?.focus(); }
    else if (e.key === "Tab") setOpen(false);
  };

  return (
    <>
      {trigger({
        ref: btn,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? id : undefined,
        "aria-label": label,
        onClick: (e) => { e.stopPropagation(); setOpen((o) => !o); },
        onKeyDown: (e) => { if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); } },
      })}
      {open && pos && (
        <div
          ref={list}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          style={{ top: pos.top, left: pos.left, width: 240 }}
          className="fixed z-[70] rounded-[var(--radius-card)] border border-line bg-surface p-1.5 shadow-[var(--shadow-lift)] [animation:rise_140ms_var(--ease-out-soft)]"
        >
          {visible.map((item, i) => (
            <button
              key={i}
              role="menuitem"
              type="button"
              disabled={item.disabled}
              onClick={(e) => { e.stopPropagation(); setOpen(false); btn.current?.focus(); item.onSelect(); }}
              className={clsx(
                "flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 text-left text-sm",
                "focus-visible:outline-none focus-visible:bg-sunken hover:bg-sunken disabled:opacity-45",
                item.danger ? "text-danger" : "text-ink",
              )}
            >
              {item.icon && <span className="shrink-0 [&>svg]:size-4" aria-hidden>{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
