import "server-only";
import sanitizeHtml from "sanitize-html";

// Somente a formatação básica pedida: negrito, itálico, listas e links.
const options: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "a"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer nofollow" }),
    b: "strong",
    i: "em",
  },
};

export function sanitizeDescription(html: string): { html: string; text: string } {
  const clean = sanitizeHtml(html ?? "", options).trim();
  const isEmpty = clean.replace(/<p>(\s|<br\s*\/?>)*<\/p>/g, "").trim() === "";
  const text = sanitizeHtml(clean.replace(/<\/(p|li)>/g, " </$1>"), { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
  return { html: isEmpty ? "" : clean, text };
}
