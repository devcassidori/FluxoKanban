import { clsx } from "clsx";

/** Marca: três raias de alturas diferentes — o quadro em miniatura. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={clsx("size-6", className)} aria-hidden>
      <rect x="2" y="3" width="5.5" height="18" rx="2" fill="currentColor" opacity="0.28" />
      <rect x="9.25" y="3" width="5.5" height="12" rx="2" fill="currentColor" opacity="0.6" />
      <rect x="16.5" y="3" width="5.5" height="7" rx="2" fill="currentColor" />
    </svg>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2 text-[17px] font-semibold tracking-tight", className)}>
      <BrandMark className="text-accent" />
      Fluxo
    </span>
  );
}
