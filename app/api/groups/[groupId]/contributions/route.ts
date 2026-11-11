import { formatCurrency } from "@/lib/finance";
import { recordGroupSettlement } from "@/lib/groups";
import {
  fetchSingleGroupForUser,
  recordServerAuditEvent,
  requireGroupAccess,
  userRestFetch,
} from "@/lib/supabase/db";
import { authenticateApiRequest, errorResponse, jsonWithSession } from "@/lib/supabase/route-auth";

export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> },
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const { groupId } = await context.params;
    const group = await requireGroupAccess(auth.session.accessToken, auth.session.user.id, groupId, "member");
    if (group.archivedAt) {
      return errorResponse(new Error("Restore this archived group before recording contributions."), "Group is archived.", 409);
    }

    const body = (await request.json()) as {
      fromMemberId?: unknown;
      toMemberId?: unknown;
      amount?: unknown;
      note?: unknown;
    };

    const fromMember = group.members.find((m) => m.id === body.fromMemberId);
    const toMember = group.members.find((m) => m.id === body.toMemberId);
    if (!fromMember || !toMember) {
      return errorResponse(new Error("Select valid paying and receiving members."), "Invalid members.", 400);
    }

    const { group: nextGroup, settlement } = recordGroupSettlement(
      group,
      { from: fromMember.name, to: toMember.name, amount: Number(body.amount ?? 0) },
      typeof body.note === "string" && body.note.trim() ? body.note.trim() : "Member reimbursement contribution",
    );

    await userRestFetch(auth.session.accessToken, "settlements", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        id: settlement.id,
        group_id: groupId,
        from_member_id: settlement.fromMemberId,
        to_member_id: settlement.toMemberId,
        from_name: settlement.fromName,
        to_name: settlement.toName,
        amount: settlement.amount,
        currency: settlement.currency,
        status: "recorded",
        note: settlement.note,
        recorded_by_user_id: auth.session.user.id,
        settled_at: settlement.settledAt,
      }),
    });

    await userRestFetch(auth.session.accessToken, "contributions", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        group_id: groupId,
        member_id: fromMember.id,
        recipient_member_id: toMember.id,
        amount: settlement.amount,
        currency: group.currency,
        source: "manual",
        note: settlement.note,
        recorded_by_user_id: auth.session.user.id,
      }),
    });

    for (const member of nextGroup.members) {
      if (member.id === fromMember.id || member.id === toMember.id) {
        await userRestFetch(
          auth.session.accessToken,
          `group_memberships?id=eq.${encodeURIComponent(member.id)}&group_id=eq.${encodeURIComponent(groupId)}`,
          {
            method: "PATCH",
            headers: { prefer: "return=minimal" },
            body: JSON.stringify({ paid_amount: member.paid }),
          },
        );
      }
    }

    await recordServerAuditEvent({
      category: "financial",
      eventType: "contribution.recorded",
      eventName: "Member contribution recorded",
      status: "success",
      actorUserId: auth.session.user.id,
      actorLabel: auth.profile.fullName,
      groupId: group.id,
      groupName: group.name,
      description: `Recorded contribution from ${fromMember.name} to ${toMember.name} (${formatCurrency(settlement.amount, group.currency)}).`,
    });

    const refreshed = await fetchSingleGroupForUser(auth.session.accessToken, groupId);
    return jsonWithSession({ group: refreshed ?? nextGroup }, auth.session, request, 201);
  } catch (error) {
    return errorResponse(error, "Could not record contribution.");
  }
}
