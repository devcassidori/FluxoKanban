"use client";
import { clsx } from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, FolderKanban, LayoutGrid, LogOut, Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, Plus, UserRound, X } from "lucide-react";
import { Brand, BrandMark } from "./brand";
import { Avatar } from "./ui/avatar";
import { LanguageSwitch } from "./language-switch";
import { SyncStatus } from "./sync-status";
import { SyncProvider } from "@/lib/sync";
import { useI18n } from "@/lib/i18n/client";
import { signOutAction } from "@/app/actions/auth";
import type { Profile } from "@/lib/types";

export interface NavProject { id: string; name: string; boards: { id: string; name: string }[] }

export function AppShell({ profile, projects, children }: { profile: Profile; projects: NavProject[]; children: React.ReactNode }) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDialogElement>(null);

  // Tablet começa recolhido; desktop expandido. A escolha manual é lembrada.
  useEffect(() => {
    const saved = localStorage.getItem("fluxo:nav-collapsed");
    setCollapsed(saved ? saved === "1" : window.innerWidth < 1024);
  }, []);
  const toggle = () => setCollapsed((c) => { localStorage.setItem("fluxo:nav-collapsed", c ? "0" : "1"); return !c; });

  useEffect(() => { setDrawer(false); }, [pathname]);
  useEffect(() => {
    const d = drawerRef.current;
    if (!d) return;
    if (drawer && !d.open) d.showModal();
    if (!drawer && d.open) d.close();
  }, [drawer]);

  return (
    <SyncProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-md focus:bg-surface focus:px-4 focus:py-3 focus:shadow-[var(--shadow-lift)]">
        {t("common.skipToContent")}
      </a>
      <div className="flex min-h-dvh">
        {/* Navegação lateral: tablet e desktop */}
        <aside
          className={clsx(
            "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 md:flex",
            collapsed ? "w-[72px]" : "w-[264px]",
          )}
          aria-label={t("nav.projects")}
        >
          <div className={clsx("flex h-16 items-center border-b border-line", collapsed ? "justify-center" : "justify-between pl-5 pr-2")}>
            {collapsed ? <BrandMark className="text-accent" /> : <Brand />}
            {!collapsed && (
              <button onClick={toggle} aria-label={t("nav.collapse")} title={t("nav.collapse")}
                className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-sunken hover:text-ink">
                <PanelLeftClose className="size-5" aria-hidden />
              </button>
            )}
          </div>
          {collapsed ? (
            <nav className="flex flex-1 flex-col items-center gap-1 py-3">
              <button onClick={toggle} aria-label={t("nav.expand")} title={t("nav.expand")}
                className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-sunken hover:text-ink">
                <PanelLeftOpen className="size-5" aria-hidden />
              </button>
              <RailLink href="/projects" label={t("nav.projects")} active={pathname.startsWith("/projects")}><FolderKanban className="size-5" /></RailLink>
              <RailLink href="/overview" label={t("nav.overview")} active={pathname === "/overview"}><LayoutGrid className="size-5" /></RailLink>
              <div className="mt-auto pb-1">
                <RailLink href="/account" label={t("nav.account")} active={pathname === "/account"}>
                  <Avatar name={profile.name} url={profile.avatar_url} size={30} />
                </RailLink>
              </div>
            </nav>
          ) : (
            <NavContent profile={profile} projects={projects} pathname={pathname} />
          )}
        </aside>

        {/* Gaveta: celular */}
        <dialog
          ref={drawerRef}
          aria-label={t("nav.projects")}
          onCancel={(e) => { e.preventDefault(); setDrawer(false); }}
          onClick={(e) => { if (e.target === drawerRef.current) setDrawer(false); }}
          className="m-0 h-dvh max-h-none w-[min(320px,88vw)] max-w-none border-0 bg-surface p-0 [&[open]]:[animation:drawer-in_220ms_var(--ease-out-soft)] md:hidden"
        >
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center justify-between border-b border-line pl-5 pr-2">
              <Brand />
              <button onClick={() => setDrawer(false)} aria-label={t("nav.closeMenu")}
                className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-sunken">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <NavContent profile={profile} projects={projects} pathname={pathname} />
          </div>
        </dialog>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-paper/85 px-3 backdrop-blur sm:px-5">
            <button onClick={() => setDrawer(true)} aria-label={t("nav.openMenu")} aria-expanded={drawer}
              className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-ink-2 hover:bg-sunken md:hidden">
              <MenuIcon className="size-5" aria-hidden />
            </button>
            <span className="md:hidden"><BrandMark className="text-accent" /></span>
            <div className="ml-auto flex items-center gap-1">
              <SyncStatus />
            </div>
          </header>
          <main id="main" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col focus:outline-none">{children}</main>
        </div>
      </div>
    </SyncProvider>
  );
}

function RailLink({ href, label, active, children }: { href: string; label: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-label={label} title={label} aria-current={active ? "page" : undefined}
      className={clsx("inline-flex size-11 items-center justify-center rounded-[var(--radius-control)]",
        active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-sunken hover:text-ink")}>
      <span aria-hidden className="contents">{children}</span>
    </Link>
  );
}

function NavContent({ profile, projects, pathname }: { profile: Profile; projects: NavProject[]; pathname: string }) {
  const { t } = useI18n();
  const current = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const [open, setOpen] = useState<Set<string>>(() => new Set(current ? [current] : []));
  useEffect(() => { if (current) setOpen((s) => new Set(s).add(current)); }, [current]);

  const link = (href: string, active: boolean) => clsx(
    "flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-[15px]",
    active ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:bg-sunken hover:text-ink",
  );

  return (
    <>
      <nav className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
        <ul className="space-y-0.5">
          <li><Link href="/projects" className={link("/projects", pathname === "/projects")} aria-current={pathname === "/projects" ? "page" : undefined}><FolderKanban className="size-[18px]" aria-hidden />{t("nav.projects")}</Link></li>
          <li><Link href="/overview" className={link("/overview", pathname === "/overview")} aria-current={pathname === "/overview" ? "page" : undefined}><LayoutGrid className="size-[18px]" aria-hidden />{t("nav.overview")}</Link></li>
        </ul>

        <div className="mt-6 flex items-center justify-between px-3">
          <h2 className="text-[13px] font-medium text-muted">{t("nav.projects")}</h2>
          <Link href="/projects?new=1" aria-label={t("projects.new")} title={t("projects.new")}
            className="-mr-2 inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-sunken hover:text-ink">
            <Plus className="size-4" aria-hidden />
          </Link>
        </div>
        {projects.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted">{t("nav.noProjects")}</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {projects.map((p) => {
              const expanded = open.has(p.id);
              const activeProject = pathname === `/projects/${p.id}`;
              return (
                <li key={p.id}>
                  <div className="flex items-center">
                    <button
                      aria-expanded={expanded}
                      aria-label={`${p.name}: ${t("nav.boards")}`}
                      onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-sunken"
                    >
                      <ChevronDown className={clsx("size-4 transition-transform", !expanded && "-rotate-90")} aria-hidden />
                    </button>
                    <Link href={`/projects/${p.id}`} aria-current={activeProject ? "page" : undefined}
                      className={clsx("flex min-h-11 min-w-0 flex-1 items-center rounded-[var(--radius-control)] px-2 text-[15px]",
                        activeProject || current === p.id ? "font-medium text-ink" : "text-ink-2", "hover:bg-sunken")}>
                      <span className="truncate">{p.name}</span>
                    </Link>
                  </div>
                  {expanded && (
                    <ul className="ml-[22px] border-l border-line pl-3">
                      {p.boards.map((b) => {
                        const href = `/projects/${p.id}/boards/${b.id}`;
                        const active = pathname === href;
                        return (
                          <li key={b.id}>
                            <Link href={href} aria-current={active ? "page" : undefined}
                              className={clsx("flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-sm",
                                active ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:bg-sunken hover:text-ink")}>
                              <span className="truncate">{b.name}</span>
                            </Link>
                          </li>
                        );
                      })}
                      {p.boards.length === 0 && <li className="px-3 py-2 text-sm text-muted">{t("boards.emptyTitle")}</li>}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </nav>
      <div className="border-t border-line p-3">
        <Link href="/account" className={link("/account", pathname === "/account")} aria-current={pathname === "/account" ? "page" : undefined}>
          <Avatar name={profile.name} url={profile.avatar_url} size={28} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{profile.name}</span>
            <span className="block truncate text-[13px] text-muted">{profile.email}</span>
          </span>
          <UserRound className="size-4 text-muted" aria-hidden />
        </Link>
        <div className="mt-1 flex items-center justify-between gap-2 px-1">
          <LanguageSwitch compact />
          <form action={signOutAction}>
            <button type="submit" className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] px-3 text-sm text-ink-2 hover:bg-sunken hover:text-ink">
              <LogOut className="size-4" aria-hidden />{t("auth.logout")}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
