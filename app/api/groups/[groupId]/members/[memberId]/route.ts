import { removeGroupMember, updateGroupMember } from "@/lib/groups";
import {
  fetchSingleGroupForUser,
  recordServerAuditEvent,
  requireGroupAccess,
  userRestFetch,
} from "@/lib/supabase/db";
import { authenticateApiRequest, errorResponse, jsonWithSession } from "@/lib/supabase/route-auth";
import type { GroupRole } from "@/lib/types";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ groupId: string; memberId: string }> },
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const { groupId, memberId } = await context.params;
    const body = (await request.json()) as { name?: unknown; role?: unknown; email?: unknown };
    const requestedRole =
      body.role === "owner" || body.role === "organizer" || body.role === "member"
        ? (body.role as GroupRole)
        : undefined;

    const group = await requireGroupAccess(
      auth.session.accessToken,
      auth.session.user.id,
      groupId,
      requestedRole === "owner" ? "owner" : "organizer",
    );
    if (group.archivedAt) {
      return errorResponse(new Error("Restore this archived group before editing members."), "Group is archived.", 409);
    }

    const nextGroup = updateGroupMember(group, memberId, {
      name: typeof body.name === "string" ? body.name : undefined,
      role: requestedRole,
      email: typeof body.email === "string" ? body.email : undefined,
    });

    for (const member of nextGroup.members) {
      await userRestFetch(
        auth.session.accessToken,
        `group_memberships?id=eq.${encodeURIComponent(member.id)}&group_id=eq.${encodeURIComponent(groupId)}`,
        {
          method: "PATCH",
          headers: { prefer: "return=minimal" },
          body: JSON.stringify({
            display_name: member.name,
            initials: member.initials,
            role: member.role,
            email: member.email ?? null,
          }),
        },
      );
    }

    const updatedMember = nextGroup.members.find((m) => m.id === memberId);
    if (updatedMember) {
      await userRestFetch(
        auth.session.accessToken,
        `expenses?group_id=eq.${encodeURIComponent(groupId)}&paid_by_member_id=eq.${encodeURIComponent(memberId)}`,
        {
          method: "PATCH",
          headers: { prefer: "return=minimal" },
          body: JSON.stringify({ paid_by_name: updatedMember.name }),
        },
      );
    }

    await recordServerAuditEvent({
      category: "group",
      eventType: "member.updated",
      eventName: "Member updated",
      status: "success",
      actorUserId: auth.session.user.id,
      actorLabel: auth.profile.fullName,
      groupId: group.id,
      groupName: group.name,
      description: `Updated member "${updatedMember?.name ?? memberId}" (${updatedMember?.role ?? "member"}) in "${group.name}".`,
    });

    const refreshed = await fetchSingleGroupForUser(auth.session.accessToken, groupId);
    return jsonWithSession({ group: refreshed ?? nextGroup }, auth.session, request);
  } catch (error) {
    return errorResponse(error, "Could not update member.");
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ groupId: string; memberId: string }> },
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const { groupId, memberId } = await context.params;
    const group = await requireGroupAccess(auth.session.accessToken, auth.session.user.id, groupId, "organizer");
    if (group.archivedAt) {
      return errorResponse(new Error("Restore this archived group before removing members."), "Group is archived.", 409);
    }

    const target = group.members.find((m) => m.id === memberId);
    const nextGroup = removeGroupMember(group, memberId);

    await userRestFetch(
      auth.session.accessToken,
      `group_memberships?id=eq.${encodeURIComponent(memberId)}&group_id=eq.${encodeURIComponent(groupId)}`,
      { method: "DELETE" },
    );

    await recordServerAuditEvent({
      category: "group",
      eventType: "member.removed",
      eventName: "Member removed",
      status: "info",
      actorUserId: auth.session.user.id,
      actorLabel: auth.profile.fullName,
      groupId: group.id,
      groupName: group.name,
      description: `Removed ${target?.name ?? "member"} from "${group.name}".`,
    });

    const refreshed = await fetchSingleGroupForUser(auth.session.accessToken, groupId);
    return jsonWithSession({ group: refreshed ?? nextGroup }, auth.session, request);
  } catch (error) {
    return errorResponse(error, "Could not remove member.");
  }
}
