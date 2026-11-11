import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { getServerSession } from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const authConfigured = isSupabaseAuthConfigured();
  const session = authConfigured ? await getServerSession() : null;

  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : undefined;
  const type = typeof params.type === "string" ? params.type : "recovery";
  const initialError = typeof params.error === "string" ? params.error : undefined;

  return (
    <AuthShell
      activeRoute="reset"
      title="Set New Password"
      subtitle="Choose a strong password with at least 8 characters to restore access to your account."
      authConfigured={authConfigured}
      footer={
        <span>
          <Link href="/login" className="inline-link">
            Back to Sign In
          </Link>
        </span>
      }
    >
      <ResetPasswordForm
        authConfigured={authConfigured}
        hasRecoverySession={Boolean(session)}
        tokenHash={tokenHash}
        type={type}
        initialError={initialError}
      />
    </AuthShell>
  );
}
