import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient, IMAGE_BUCKET } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/action-utils";
import { sniffImage } from "@/lib/image-sniff";
import { appConfig } from "@/lib/config";

// Passo 2: confere o arquivo de fato enviado (bytes e tamanho reais) e só
// então registra o anexo, com a cota travada no banco. Se algo falhar, o
// arquivo é apagado e os anexos já salvos ficam como estavam.
export async function POST(req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  if (!isUuid(cardId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const { path } = (await req.json().catch(() => ({}))) as { path?: string };
  const { data: card } = await supabase.from("cards").select("project_id").eq("id", cardId).single();
  if (!card || typeof path !== "string" || !path.startsWith(`${card.project_id}/${cardId}/`) || path.includes("..")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const storage = getAdminClient().storage.from(IMAGE_BUCKET);
  const discard = () => storage.remove([path]).catch(() => undefined);

  const { data: blob, error: dlErr } = await storage.download(path);
  if (dlErr || !blob) return NextResponse.json({ error: "generic" }, { status: 400 });
  const size = blob.size;
  if (size > appConfig.images.maxBytes) { await discard(); return NextResponse.json({ error: "file_too_large" }, { status: 400 }); }
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const mime = sniffImage(head);
  if (!mime) { await discard(); return NextResponse.json({ error: "invalid_type" }, { status: 400 }); }

  const { data: image, error } = await supabase.rpc("register_card_image", {
    p_card: cardId, p_path: path, p_size: size, p_mime: mime,
  });
  if (error) {
    await discard();
    const code = error.code === "P0001" ? error.message : "generic";
    return NextResponse.json({ error: code }, { status: 400 });
  }
  return NextResponse.json({ image });
}
