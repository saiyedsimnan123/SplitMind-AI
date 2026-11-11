import { NextResponse } from "next/server";
import {
  applySessionCookies,
  deriveSafeSessionId,
  fetchSupabaseUser,
  parseDeviceSummary,
} from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { ensureUserProfile, recordServerAuditEvent } from "@/lib/supabase/db";

export async function POST(request: Request) {
  if (!isSupabaseAuthConfigured()) {
    return NextResponse.json({ error: "Supabase Auth is not configured." }, { status: 503 });
  }

  let body: { accessToken?: unknown; refreshToken?: unknown };
  try {
    body = (await request.json()) as { accessToken?: unknown; refreshToken?: unknown };
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken.trim() : "";

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "Missing recovery session credentials." }, { status: 400 });
  }

  const user = await fetchSupabaseUser(accessToken);
  if (!user) {
    return NextResponse.json({ error: "Recovery link is invalid or expired." }, { status: 401 });
  }

  const sessionId = deriveSafeSessionId(accessToken);
  const createdAt = new Date().toISOString();
  const deviceLabel = parseDeviceSummary(request.headers.get("user-agent"));

  let actorLabel = user.user_metadata?.full_name || user.email || "SplitMind Member";
  try {
    const ensured = await ensureUserProfile(accessToken, user);
    actorLabel = ensured.profile.fullName;
  } catch {
    // Fallback to auth metadata label.
  }

  await recordServerAuditEvent({
    category: "authentication",
    eventType: "auth.password_reset.verified",
    eventName: "Password recovery session verified",
    status: "success",
    actorUserId: user.id,
    actorLabel,
    description: `Verified recovery link and established HttpOnly session ${sessionId} (${deviceLabel}).`,
    metadata: { sessionId, device: deviceLabel },
  });

  const response = NextResponse.json({ ok: true });
  applySessionCookies(
    response,
    {
      accessToken,
      refreshToken,
      sessionId,
      sessionCreatedAt: createdAt,
    },
    request,
  );
  return response;
}
