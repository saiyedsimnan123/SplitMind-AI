import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";
import { getServerSession, isDemoAuthUser } from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const authConfigured = isSupabaseAuthConfigured();
  if (authConfigured) {
    const session = await getServerSession();
    if (session && !isDemoAuthUser(session.user)) {
      redirect("/");
    }
  }

  return (
    <AuthShell
      activeRoute="signup"
      title="Create Your Account"
      subtitle="Set up your workspace in seconds and coordinate shared group finances with clarity."
      authConfigured={authConfigured}
      footer={
        <span>
          Already have an account?{" "}
          <Link href="/login" className="inline-link">
            Sign In
          </Link>
        </span>
      }
    >
      <SignupForm authConfigured={authConfigured} />
    </AuthShell>
  );
}
