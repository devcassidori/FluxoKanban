import { AuthForm } from "@/components/auth-form";
import { resetPasswordAction } from "@/app/actions/auth";
import AuthLayout from "../(auth)/layout";
import { requireUser } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  await requireUser();
  return (
    <AuthLayout>
      <AuthForm mode="reset" action={resetPasswordAction} />
    </AuthLayout>
  );
}
