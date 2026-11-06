/** Evita redirecionamento aberto: só caminhos internos. */
export function safeNext(v: FormDataEntryValue | string | null | undefined, fallback = "/projects") {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : fallback;
}
