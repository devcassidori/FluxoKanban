import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Cliente com service role — só no servidor, sempre depois de checar a permissão. */
export function getAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const IMAGE_BUCKET = "card-images";
