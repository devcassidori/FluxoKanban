import { AuthForm } from "@/components/auth-form";
import { signInAction } from "@/app/actions/auth";
import { safeNext } from "@/lib/safe-next";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <AuthForm
      mode="login"
      action={signInAction}
      next={safeNext(sp.next)}
      notice={sp.error === "link" ? { kind: "error", key: "auth.error.linkInvalid" } : sp.confirmed ? { kind: "success", key: "auth.confirmed" } : null}
      initialEmail={sp.email}
    />
  );
}
