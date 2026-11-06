"use client";
import { appConfig } from "./config";
import type { CardImage } from "./types";

export class UploadError extends Error {
  constructor(public code: string) { super(code); }
}

/** Checagem rápida no navegador; a validação definitiva acontece no servidor. */
export function precheck(file: File, existing: number): string | null {
  if (!(appConfig.images.mimeTypes as readonly string[]).includes(file.type)) return "invalid_type";
  if (file.size > appConfig.images.maxBytes) return "file_too_large";
  if (existing >= appConfig.images.perCard) return "card_image_limit";
  return null;
}

async function json(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new UploadError(body.error ?? "generic");
  return body;
}

export async function uploadCardImage(cardId: string, file: File, onProgress: (pct: number) => void): Promise<CardImage> {
  // 1) servidor valida permissão, tipo, tamanho e cota e devolve URL assinada
  const { path, signedUrl } = await json(await fetch(`/api/cards/${cardId}/images`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ size: file.size, type: file.type }),
  }));

  // 2) envio direto ao Storage, com progresso
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UploadError(xhr.status === 413 ? "file_too_large" : "generic")));
    xhr.onerror = () => reject(new UploadError("network"));
    const fd = new FormData();
    fd.append("cacheControl", "3600");
    fd.append("", file);
    xhr.send(fd);
  });

  // 3) servidor confere os bytes reais e registra o anexo
  const { image } = await json(await fetch(`/api/cards/${cardId}/images/complete`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }),
  }));
  return image as CardImage;
}

export async function deleteCardImage(imageId: string) {
  await json(await fetch(`/api/images/${imageId}`, { method: "DELETE" }));
}
