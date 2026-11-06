import { requireUser } from "@/lib/supabase/server";
import { AccountView } from "./account-view";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const { supabase, user } = await requireUser();
  let { data } = await supabase.from("profiles").select("id, email, name, avatar_url, locale").eq("id", user.id).maybeSingle();
  if (!data) {
    await supabase.rpc("ensure_profile");
    ({ data } = await supabase.from("profiles").select("id, email, name, avatar_url, locale").eq("id", user.id).maybeSingle());
  }
  const profile: Profile = (data as Profile) ?? { id: user.id, email: user.email ?? "", name: "", avatar_url: null, locale: "pt-BR" };
  return <AccountView profile={profile} />;
}
