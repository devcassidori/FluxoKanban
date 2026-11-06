import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24 text-muted" role="status" aria-live="polite">
      <Spinner className="size-6" label="…" />
    </div>
  );
}
