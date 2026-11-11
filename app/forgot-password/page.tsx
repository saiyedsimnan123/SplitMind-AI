import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  const authConfigured = isSupabaseAuthConfigured();

  return (
    <AuthShell
      kicker="ACCOUNT RECOVERY"
      title="Reset your password"
      subtitle="Enter your email address and we'll send a secure recovery link through Supabase Auth."
      authConfigured={authConfigured}
      footer={
        <span>
          Remembered your password?{" "}
          <Link href="/login" className="inline-link">
            Back to sign in
          </Link>
        </span>
      }
    >
      <ForgotPasswordForm authConfigured={authConfigured} />
    </AuthShell>
  );
}
