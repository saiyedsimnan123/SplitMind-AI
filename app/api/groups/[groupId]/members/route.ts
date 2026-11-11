import { addGroupMember } from "@/lib/groups";
import {
  fetchSingleGroupForUser,
  recordServerAuditEvent,
  requireGroupAccess,
  userRestFetch,
} from "@/lib/supabase/db";
import { authenticateApiRequest, errorResponse, jsonWithSession } from "@/lib/supabase/route-auth";
import type { GroupRole } from "@/lib/types";

export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> },
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const { groupId } = await context.params;
    const group = await requireGroupAccess(auth.session.accessToken, auth.session.user.id, groupId, "organizer");
    if (group.archivedAt) {
      return errorResponse(new Error("Restore this archived group before adding members."), "Group is archived.", 409);
    }

    const body = (await request.json()) as { name?: unknown; role?: unknown; email?: unknown };
    const role: GroupRole = body.role === "organizer" ? "organizer" : "member";
    const { group: nextGroup, member } = addGroupMember(group, {
      name: typeof body.name === "string" ? body.name : "",
      role,
      email: typeof body.email === "string" ? body.email : undefined,
    });

    await userRestFetch(auth.session.accessToken, "group_memberships", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        id: member.id,
        group_id: groupId,
        user_id: null,
        display_name: member.name,
        email: member.email ?? null,
        initials: member.initials,
        avatar_color: member.color,
        role: member.role,
        paid_amount: 0,
      }),
    });

    await recordServerAuditEvent({
      category: "group",
      eventType: "member.added",
      eventName: "Member added",
      status: "success",
      actorUserId: auth.session.user.id,
      actorLabel: auth.profile.fullName,
      groupId: group.id,
      groupName: group.name,
      description: `Added ${member.name} (${member.role}) to "${group.name}".`,
    });

    const refreshed = await fetchSingleGroupForUser(auth.session.accessToken, groupId);
    return jsonWithSession({ group: refreshed ?? nextGroup, member }, auth.session, request, 201);
  } catch (error) {
    return errorResponse(error, "Could not add group member.");
  }
}
