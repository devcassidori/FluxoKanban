export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      {icon && <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent" aria-hidden>{icon}</div>}
      <h2 className="text-lg font-semibold">{title}</h2>
      {body && <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
