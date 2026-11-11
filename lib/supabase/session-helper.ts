import type { AuthUser } from "@/lib/types";
import {
  deriveSafeSessionId,
  getAuthUserDisplayName,
  parseDeviceSummary,
  type SupabaseSessionTokens,
} from "@/lib/supabase/auth";
import {
  authUserToFallbackProfile,
  ensureUserProfile,
  recordServerAuditEvent,
  seedInitialGoaWorkspaceIfNeeded,
} from "@/lib/supabase/db";

export async function establishVerifiedUserSession(input: {
  tokens: SupabaseSessionTokens;
  request: Request;
  authMethod: "email_password" | "email_otp" | "phone_otp" | "google_oauth";
  eventType: string;
  eventName: string;
  description: string;
  seedWorkspace?: boolean;
}): Promise<{
  profile: AuthUser;
  sessionId: string;
  createdAt: string;
  deviceLabel: string;
}> {
  const sessionId = deriveSafeSessionId(input.tokens.access_token);
  const createdAt = new Date().toISOString();
  const deviceLabel = parseDeviceSummary(input.request.headers.get("user-agent"));

  let profile: AuthUser = authUserToFallbackProfile(input.tokens.user);
  let workspaceInitialized = false;

  try {
    const ensured = await ensureUserProfile(input.tokens.access_token, input.tokens.user);
    profile = ensured.profile;
    workspaceInitialized = ensured.workspaceInitialized;
    if (input.seedWorkspace) {
      await seedInitialGoaWorkspaceIfNeeded(
        input.tokens.access_token,
        profile,
        workspaceInitialized,
      );
    }
  } catch {
    // Database triggers/dashboard loader handle fallback profile & workspace bootstrap.
  }

  const actorLabel = profile.fullName || getAuthUserDisplayName(input.tokens.user);

  await recordServerAuditEvent({
    category: "authentication",
    eventType: input.eventType,
    eventName: input.eventName,
    status: "success",
    actorUserId: input.tokens.user.id,
    actorLabel,
    description: `${input.description} (${deviceLabel}).`,
    metadata: { sessionId, device: deviceLabel, authMethod: input.authMethod },
  });

  await recordServerAuditEvent({
    category: "authentication",
    eventType: "auth.session.created",
    eventName: "Session created",
    status: "info",
    actorUserId: input.tokens.user.id,
    actorLabel,
    description: `Established HttpOnly session ${sessionId} via ${input.authMethod} (${deviceLabel}).`,
    metadata: { sessionId, device: deviceLabel, authMethod: input.authMethod },
  });

  return {
    profile,
    sessionId,
    createdAt,
    deviceLabel,
  };
}
