import { NextResponse } from "next/server";
import { maskEmailForAudit } from "@/lib/audit";
import { parseDeviceSummary, sendSupabasePasswordReset } from "@/lib/supabase/auth";
import { getCanonicalOrigin, isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { recordServerAuditEvent } from "@/lib/supabase/db";

export async function POST(request: Request) {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to .env.local to send password reset links.",
      },
      { status: 503 },
    );
  }

  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const origin = getCanonicalOrigin(request.url);
  const redirectTo = `${origin}/api/auth/confirm?next=/reset-password`;
  const deviceLabel = parseDeviceSummary(request.headers.get("user-agent"));

  try {
    await sendSupabasePasswordReset(email, redirectTo);
    await recordServerAuditEvent({
      category: "authentication",
      eventType: "auth.password_reset.requested",
      eventName: "Password reset requested",
      status: "info",
      actorUserId: null,
      actorLabel: maskEmailForAudit(email),
      description: `Password reset email requested for ${maskEmailForAudit(email)} (${deviceLabel}).`,
      metadata: { device: deviceLabel },
    });

    return NextResponse.json({
      ok: true,
      message: "If an account matches that email, a password reset link has been sent.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not send password reset email." },
      { status: 502 },
    );
  }
}
