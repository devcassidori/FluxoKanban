import { clsx } from "clsx";

export function PageHeader({ title, description, actions, children, className }: {
  title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode; className?: string;
}) {
  return (
    <div className={clsx("px-4 pt-6 sm:px-8 sm:pt-8", className)}>
      {children}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight sm:text-[30px]">{title}</h1>
          {description && <p className="mt-1.5 max-w-[65ch] text-[15px] text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
