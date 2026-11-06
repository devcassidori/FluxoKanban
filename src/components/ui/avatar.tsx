import { clsx } from "clsx";

const tones = ["#2c46cc", "#1d7349", "#8a3ffc", "#b5487a", "#0e7490", "#a15c07", "#5b6272"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ name, url, size = 28, className }: { name: string; url?: string | null; size?: number; className?: string }) {
  const tone = tones[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % tones.length];
  return (
    <span
      className={clsx("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ring-2 ring-surface", className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: url ? undefined : tone }}
      aria-hidden
    >
      {url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
        : initials(name || "?")}
    </span>
  );
}
