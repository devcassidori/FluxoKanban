import { NextResponse, type NextRequest } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient, IMAGE_BUCKET } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/action-utils";

// Imagens ficam em bucket privado: só quem é integrante recebe uma URL temporária.
export async function GET(_: NextRequest, { params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await params;
  if (!isUuid(imageId)) return new NextResponse(null, { status: 404 });
  const supabase = await getServerClient();
  const { data: img } = await supabase.from("card_images").select("path").eq("id", imageId).maybeSingle();
  if (!img) return new NextResponse(null, { status: 404 });
  const { data } = await getAdminClient().storage.from(IMAGE_BUCKET).createSignedUrl(img.path, 600);
  if (!data) return new NextResponse(null, { status: 500 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, max-age=300" } });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await params;
  if (!isUuid(imageId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const supabase = await getServerClient();
  const { data: path, error } = await supabase.rpc("delete_card_image", { p_image: imageId });
  if (error) return NextResponse.json({ error: error.code === "P0001" ? error.message : "generic" }, { status: 403 });
  await getAdminClient().storage.from(IMAGE_BUCKET).remove([path as string]).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
