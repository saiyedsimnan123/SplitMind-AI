import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { getServerSession, isDemoAuthUser, safeRedirectPath } from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const authConfigured = isSupabaseAuthConfigured();

  if (authConfigured) {
    const session = await getServerSession();
    if (session && !isDemoAuthUser(session.user)) {
      redirect("/");
    }
  }

  const nextParam = typeof params.next === "string" ? safeRedirectPath(params.next, "/") : "/";
  const errorParam = typeof params.error === "string" ? params.error : undefined;
  const resetNotice = params.reset === "1" ? "Password updated. Sign in with your new password." : undefined;

  return (
    <AuthShell
      activeRoute="login"
      kicker="ONE GROUP. ONE SMART MONEY MIND."
      title="Welcome back"
      subtitle="Sign in with Google, Email, or Phone OTP (+91) to manage group budgets, receipts, and smart settlements."
      authConfigured={authConfigured}
      footer={
        <span>
          Forgot your password?{" "}
          <Link href="/forgot-password" className="inline-link">
            Recover account access
          </Link>
        </span>
      }
    >
      <LoginForm
        authConfigured={authConfigured}
        nextPath={nextParam}
        initialError={errorParam}
        initialNotice={resetNotice}
      />
    </AuthShell>
  );
}
