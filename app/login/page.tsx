import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { getServerSession, safeRedirectPath } from "@/lib/supabase/auth";
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
    if (session) {
      redirect("/");
    }
  }

  const nextParam = typeof params.next === "string" ? safeRedirectPath(params.next, "/") : "/";
  const errorParam = typeof params.error === "string" ? params.error : undefined;
  const resetNotice = params.reset === "1" ? "Password updated. Sign in with your new password." : undefined;

  return (
    <AuthShell
      activeRoute="login"
      kicker="WELCOME BACK"
      title="Sign in to SplitMind AI"
      subtitle="Access your isolated group budgets, expense proof ledgers, and AI financial agent."
      authConfigured={authConfigured}
      footer={
        <span>
          New to SplitMind AI?{" "}
          <Link href="/signup" className="inline-link">
            Create your account
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
