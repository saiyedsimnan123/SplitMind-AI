import { NextResponse } from "next/server";
import {
  clearSessionCookies,
  getRequestSession,
  parseDeviceSummary,
  revokeSupabaseSession,
} from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { recordServerAuditEvent } from "@/lib/supabase/db";

export async function POST(request: Request) {
  let scope: "local" | "others" | "global" = "local";
  try {
    const body = (await request.json().catch(() => ({}))) as { scope?: unknown };
    if (body.scope === "others" || body.scope === "global" || body.scope === "local") {
      scope = body.scope;
    }
  } catch {
    // Default to local logout.
  }

  const deviceLabel = parseDeviceSummary(request.headers.get("user-agent"));
  const session = isSupabaseAuthConfigured() ? await getRequestSession(request) : null;

  if (session) {
    const actorLabel = session.user.user_metadata?.full_name || session.user.email;
    try {
      await revokeSupabaseSession(session.accessToken, scope);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not revoke session." },
        { status: 502 },
      );
    }

    if (scope === "others") {
      await recordServerAuditEvent({
        category: "authentication",
        eventType: "auth.session.revoked",
        eventName: "Other sessions revoked",
        status: "warning",
        actorUserId: session.user.id,
        actorLabel,
        description: `Revoked all other active sessions while retaining ${session.sessionId} (${deviceLabel}).`,
        metadata: { scope, retainedSessionId: session.sessionId },
      });
    } else {
      await recordServerAuditEvent({
        category: "authentication",
        eventType: "auth.logout",
        eventName: scope === "global" ? "Signed out of all devices" : "Signed out",
        status: "success",
        actorUserId: session.user.id,
        actorLabel,
        description:
          scope === "global"
            ? `Revoked all sessions globally and signed out (${deviceLabel}).`
            : `Signed out of session ${session.sessionId} (${deviceLabel}).`,
        metadata: { scope, sessionId: session.sessionId },
      });
    }
  }

  const response = NextResponse.json({ ok: true, scope });
  if (scope !== "others") {
    clearSessionCookies(response, request);
  }
  return response;
}
