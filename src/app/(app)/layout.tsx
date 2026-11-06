import { AppShell, type NavProject } from "@/components/app-shell";
import { requireUser } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  let [{ data: profile }, { data: projects }] = await Promise.all([
    supabase.from("profiles").select("id, email, name, avatar_url, locale").eq("id", user.id).maybeSingle(),
    supabase.from("projects").select("id, name, boards(id, name, created_at)").is("archived_at", null).order("name"),
  ]);
  if (!profile) {
    // conta criada antes do gatilho de perfis: cria agora
    await supabase.rpc("ensure_profile");
    ({ data: profile } = await supabase.from("profiles").select("id, email, name, avatar_url, locale").eq("id", user.id).maybeSingle());
  }
  const nav: NavProject[] = (projects ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    boards: [...(p.boards ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(({ id, name }) => ({ id, name })),
  }));
  const me: Profile = profile ?? { id: user.id, email: user.email ?? "", name: user.email ?? "", avatar_url: null, locale: "pt-BR" };
  return <AppShell profile={me} projects={nav}>{children}</AppShell>;
}
