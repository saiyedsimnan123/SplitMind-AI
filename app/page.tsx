import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SplitMindApp } from "@/components/SplitMindApp";
import { createInitialGoaGroup } from "@/lib/demo-data";
import { getServerSession, parseDeviceSummary } from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import {
  authUserToFallbackProfile,
  ensureUserProfile,
  fetchAllGroupsForUser,
  listAuditEventsForUser,
  seedInitialGoaWorkspaceIfNeeded,
} from "@/lib/supabase/db";
import type { AuditEvent, AuthUser, GroupRecord, SessionSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const headerStore = await headers();
  const deviceLabel = parseDeviceSummary(headerStore.get("user-agent"));
  const authConfigured = isSupabaseAuthConfigured();

  if (!authConfigured) {
    const goaDemo = createInitialGoaGroup();
    const previewSession: SessionSummary = {
      authenticated: false,
      authConfigured: false,
      sessionId: null,
      provider: "Local preview mode (Supabase Auth unconfigured)",
      createdAt: null,
      deviceLabel,
      storageMode: "local_preview",
    };

    return (
      <SplitMindApp
        authConfigured={false}
        initialUser={null}
        initialSession={previewSession}
        initialGroups={[goaDemo]}
        initialAuditEvents={[]}
      />
    );
  }

  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }

  let profile: AuthUser = authUserToFallbackProfile(session.user);
  let groups: GroupRecord[] = [];
  let auditEvents: AuditEvent[] = [];
  let dbError = "";

  try {
    const ensured = await ensureUserProfile(session.accessToken, session.user);
    profile = ensured.profile;
    await seedInitialGoaWorkspaceIfNeeded(session.accessToken, profile, ensured.workspaceInitialized);
    [groups, auditEvents] = await Promise.all([
      fetchAllGroupsForUser(session.accessToken),
      listAuditEventsForUser(session.accessToken, 200),
    ]);
  } catch (error) {
    dbError =
      error instanceof Error
        ? error.message
        : "Connected to Supabase Auth, but database tables could not be queried. Apply migrations in supabase/migrations/.";
  }

  if (!groups.length) {
    groups = [
      createInitialGoaGroup({
        ownerUserId: profile.id,
        ownerDisplayName: profile.fullName,
        ownerInitials: profile.initials,
      }),
    ];
  }

  const sessionSummary: SessionSummary = {
    authenticated: true,
    authConfigured: true,
    sessionId: session.sessionId,
    provider: "Supabase Auth · HttpOnly session",
    createdAt: session.sessionCreatedAt,
    deviceLabel,
    storageMode: "supabase_http_only",
  };

  return (
    <SplitMindApp
      authConfigured={true}
      initialUser={profile}
      initialSession={sessionSummary}
      initialGroups={groups}
      initialAuditEvents={auditEvents}
      initialDbError={dbError || undefined}
    />
  );
}
