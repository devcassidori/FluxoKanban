import { requireUser } from "@/lib/supabase/server";
import { AccountView } from "./account-view";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("id, email, name, avatar_url, locale").eq("id", user.id).single();
  return <AccountView profile={data as Profile} />;
}
