import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";
import { getServerSession } from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const authConfigured = isSupabaseAuthConfigured();
  if (authConfigured) {
    const session = await getServerSession();
    if (session) {
      redirect("/");
    }
  }

  return (
    <AuthShell
      kicker="GET STARTED"
      title="Create your workspace"
      subtitle="Set up your personal profile to organize trips, roommates, events, and projects."
      authConfigured={authConfigured}
      footer={
        <span>
          Already have an account?{" "}
          <Link href="/login" className="inline-link">
            Sign in
          </Link>
        </span>
      }
    >
      <SignupForm authConfigured={authConfigured} />
    </AuthShell>
  );
}
