import { AuthForm } from "@/components/auth-form";
import { signUpAction } from "@/app/actions/auth";
import { safeNext } from "@/lib/safe-next";

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return <AuthForm mode="signup" action={signUpAction} next={safeNext(sp.next)} initialEmail={sp.email} />;
}
