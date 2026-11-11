import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  const authConfigured = isSupabaseAuthConfigured();

  return (
    <AuthShell
      activeRoute="forgot"
      title="Reset Password"
      subtitle="Enter your account email address and we will send you a password reset link."
      authConfigured={authConfigured}
      footer={
        <span>
          Remembered your password?{" "}
          <Link href="/login" className="inline-link">
            Back to Sign In
          </Link>
        </span>
      }
    >
      <ForgotPasswordForm authConfigured={authConfigured} />
    </AuthShell>
  );
}
