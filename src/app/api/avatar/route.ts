import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { EXT, sniffImage } from "@/lib/image-sniff";

const BUCKET = "avatars";
const MAX = 2 * 1024 * 1024;

async function currentName(supabase: Awaited<ReturnType<typeof getServerClient>>, userId: string, fallback: string) {
  const { data } = await supabase.from("profiles").select("name").eq("id", userId).maybeSingle();
  return data?.name || fallback;
}

async function clearOld(userId: string, keep?: string) {
  const storage = getAdminClient().storage.from(BUCKET);
  const { data } = await storage.list(userId);
  const old = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (old.length) await storage.remove(old);
}

// Envia a foto de perfil: valida tamanho e bytes reais antes de gravar.
export async function POST(req: NextRequest) {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "avatar_too_large" }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImage(bytes.slice(0, 16));
  if (!mime) return NextResponse.json({ error: "invalid_type" }, { status: 400 });

  const path = `${user.id}/${crypto.randomUUID()}.${EXT[mime]}`;
  const storage = getAdminClient().storage.from(BUCKET);
  const { error: upErr } = await storage.upload(path, bytes, { contentType: mime, upsert: false, cacheControl: "31536000" });
  if (upErr) {
    console.error("[avatar] upload", upErr.message);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
  const url = storage.getPublicUrl(path).data.publicUrl;

  const name = await currentName(supabase, user.id, user.email?.split("@")[0] ?? "");
  const { error } = await supabase.rpc("update_my_profile", { p_name: name, p_avatar_url: url, p_set_avatar: true });
  if (error) {
    await storage.remove([path]).catch(() => undefined);
    console.error("[avatar] perfil", error.code, error.message);
    return NextResponse.json({ error: error.code === "P0001" ? error.message : "generic" }, { status: 400 });
  }
  await clearOld(user.id, path).catch(() => undefined);
  revalidatePath("/", "layout");
  return NextResponse.json({ url });
}

export async function DELETE() {
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });
  const name = await currentName(supabase, user.id, user.email?.split("@")[0] ?? "");
  const { error } = await supabase.rpc("update_my_profile", { p_name: name, p_avatar_url: null, p_set_avatar: true });
  if (error) return NextResponse.json({ error: "generic" }, { status: 400 });
  await clearOld(user.id).catch(() => undefined);
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
