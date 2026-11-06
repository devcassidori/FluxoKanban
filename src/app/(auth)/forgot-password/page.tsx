import { AuthForm } from "@/components/auth-form";
import { forgotPasswordAction } from "@/app/actions/auth";

export default function ForgotPage() {
  return <AuthForm mode="forgot" action={forgotPasswordAction} />;
}
