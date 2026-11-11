import { NextResponse } from "next/server";
import { deriveInitials } from "@/lib/groups";
import {
  applySessionCookies,
  getRequestSession,
  parseDeviceSummary,
  signInWithSupabase,
  updateSupabaseUser,
} from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import {
  authUserToFallbackProfile,
  ensureUserProfile,
  recordServerAuditEvent,
  userRestFetch,
} from "@/lib/supabase/db";
import type { CurrencyCode } from "@/lib/types";

export async function GET(request: Request) {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json({ error: "Supabase Auth is not configured." }, { status: 503 });
  }
  const session = await getRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let profile = authUserToFallbackProfile(session.user);
  try {
    const ensured = await ensureUserProfile(session.accessToken, session.user);
    profile = ensured.profile;
  } catch {
    // Fallback cleanly.
  }

  const res = NextResponse.json({ profile });
  if (session.refreshed) applySessionCookies(res, session, request);
  return res;
}

export async function PATCH(request: Request) {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json({ error: "Supabase Auth is not configured." }, { status: 503 });
  }
  const session = await getRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: {
    fullName?: unknown;
    defaultCurrency?: unknown;
    avatarColor?: unknown;
    currentPassword?: unknown;
    newPassword?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const deviceLabel = parseDeviceSummary(request.headers.get("user-agent"));

  // Handle password change cleanly by verifying currentPassword first
  if (typeof body.newPassword === "string" && body.newPassword.length > 0) {
    if (typeof body.currentPassword !== "string" || !body.currentPassword) {
      return NextResponse.json({ error: "Enter your current password to set a new one." }, { status: 400 });
    }
    if (body.newPassword.length < 8 || body.newPassword.length > 200) {
      return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }
    try {
      await signInWithSupabase(session.user.email, body.currentPassword);
    } catch {
      await recordServerAuditEvent({
        category: "security",
        eventType: "security.warning",
        eventName: "Failed password change verification",
        status: "warning",
        actorUserId: session.user.id,
        actorLabel: session.user.user_metadata?.full_name || session.user.email,
        description: `Rejected password change because current password verification failed (${deviceLabel}).`,
      });
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
    }

    await updateSupabaseUser(session.accessToken, { password: body.newPassword });
    await recordServerAuditEvent({
      category: "authentication",
      eventType: "auth.password_changed",
      eventName: "Account password updated",
      status: "success",
      actorUserId: session.user.id,
      actorLabel: session.user.user_metadata?.full_name || session.user.email,
      description: `Changed account password from Account Settings (${deviceLabel}).`,
    });
  }

  const updateFields: Record<string, string> = {};
  const metaPatch: Record<string, string> = {};

  if (typeof body.fullName === "string") {
    const trimmed = body.fullName.trim();
    if (!trimmed || trimmed.length > 80) {
      return NextResponse.json({ error: "Full name must be between 1 and 80 characters." }, { status: 400 });
    }
    updateFields.full_name = trimmed;
    updateFields.initials = deriveInitials(trimmed);
    metaPatch.full_name = trimmed;
  }

  if (
    body.defaultCurrency === "INR" ||
    body.defaultCurrency === "USD" ||
    body.defaultCurrency === "EUR" ||
    body.defaultCurrency === "GBP"
  ) {
    updateFields.default_currency = body.defaultCurrency;
    metaPatch.default_currency = body.defaultCurrency;
  }

  if (typeof body.avatarColor === "string" && /^[a-z]{3,16}$/.test(body.avatarColor)) {
    updateFields.avatar_color = body.avatarColor;
    metaPatch.avatar_color = body.avatarColor;
  }

  if (Object.keys(metaPatch).length > 0) {
    await updateSupabaseUser(session.accessToken, { data: metaPatch });
    await userRestFetch(
      session.accessToken,
      `profiles?id=eq.${encodeURIComponent(session.user.id)}`,
      {
        method: "PATCH",
        headers: { prefer: "return=minimal" },
        body: JSON.stringify(updateFields),
      },
    );

    await recordServerAuditEvent({
      category: "security",
      eventType: "profile.updated",
      eventName: "Profile settings updated",
      status: "success",
      actorUserId: session.user.id,
      actorLabel: updateFields.full_name || session.user.user_metadata?.full_name || session.user.email,
      description: `Updated account profile settings (${Object.keys(updateFields).join(", ")}).`,
    });
  }

  const { profile } = await ensureUserProfile(session.accessToken, session.user);
  const finalProfile = {
    ...profile,
    fullName: (updateFields.full_name ?? profile.fullName) as string,
    initials: (updateFields.initials ?? profile.initials) as string,
    defaultCurrency: (updateFields.default_currency ?? profile.defaultCurrency) as CurrencyCode,
    avatarColor: (updateFields.avatar_color ?? profile.avatarColor) as string,
  };

  const res = NextResponse.json({ profile: finalProfile });
  if (session.refreshed) applySessionCookies(res, session, request);
  return res;
}
