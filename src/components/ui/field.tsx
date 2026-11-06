import { clsx } from "clsx";
import { useId } from "react";

export function Field({ label, hint, error, children, className, optional }: {
  label: string; hint?: string; error?: string | null; optional?: string; className?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = error ? errId : hint ? hintId : undefined;
  return (
    <div className={clsx("min-w-0", className)}>
      <label className="label" htmlFor={id}>
        {label}{optional && <span className="font-normal text-muted"> ({optional})</span>}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && !error && <p id={hintId} className="hint">{hint}</p>}
      {error && <p id={errId} className="mt-1.5 text-[13px] font-medium text-danger" role="alert">{error}</p>}
    </div>
  );
}
