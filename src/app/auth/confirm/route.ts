import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getServerClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

// Destino dos links de e-mail (confirmação de conta e recuperação de senha).
// Aceita o fluxo PKCE (?code=) e o de token (?token_hash=&type=).
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await getServerClient();

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;

  const dest = request.nextUrl.clone();
  dest.search = "";
  if (!ok) {
    dest.pathname = "/login";
    dest.searchParams.set("error", "link");
  } else {
    const [path, query] = next.split("?");
    dest.pathname = path;
    if (query) new URLSearchParams(query).forEach((v, k) => dest.searchParams.set(k, v));
    if (type !== "recovery" && next !== "/reset-password") dest.searchParams.set("confirmed", "1");
  }
  return NextResponse.redirect(dest);
}
