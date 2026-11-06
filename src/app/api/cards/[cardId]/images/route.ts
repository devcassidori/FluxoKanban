import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient, IMAGE_BUCKET } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/action-utils";
import { EXT } from "@/lib/image-sniff";

// Passo 1 do upload: valida permissão, tipo, tamanho e cota ANTES de enviar,
// e devolve uma URL assinada de uso único para o navegador enviar direto ao Storage.
export async function POST(req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  if (!isUuid(cardId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const supabase = await getServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const body = await req.json().catch(() => null) as { size?: number; type?: string } | null;
  const size = Number(body?.size);
  const type = String(body?.type ?? "");
  if (!Number.isFinite(size) || size <= 0) return NextResponse.json({ error: "invalid_type" }, { status: 400 });

  const { data: reason, error } = await supabase.rpc("check_image_upload", { p_card: cardId, p_size: size, p_mime: type });
  if (error) return NextResponse.json({ error: "generic" }, { status: 500 });
  if (reason !== "ok") return NextResponse.json({ error: reason }, { status: reason === "forbidden" ? 403 : 400 });

  const { data: card } = await supabase.from("cards").select("project_id").eq("id", cardId).single();
  if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const path = `${card.project_id}/${cardId}/${crypto.randomUUID()}.${EXT[type]}`;
  const { data: signed, error: signErr } = await getAdminClient().storage.from(IMAGE_BUCKET).createSignedUploadUrl(path);
  if (signErr || !signed) return NextResponse.json({ error: "generic" }, { status: 500 });
  return NextResponse.json({ path, signedUrl: signed.signedUrl });
}
