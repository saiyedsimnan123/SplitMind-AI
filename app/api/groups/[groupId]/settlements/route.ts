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
      return errorResponse(new Error("Restore this archived group before recording settlements."), "Group is archived.", 409);
    }

    const body = (await request.json()) as {
      from?: unknown;
      to?: unknown;
      amount?: unknown;
      note?: unknown;
    };

    const { group: nextGroup, settlement } = recordGroupSettlement(
      group,
      {
        from: typeof body.from === "string" ? body.from : "",
        to: typeof body.to === "string" ? body.to : "",
        amount: Number(body.amount ?? 0),
      },
      typeof body.note === "string" ? body.note : "Recorded settlement transfer",
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
        member_id: settlement.fromMemberId,
        recipient_member_id: settlement.toMemberId,
        amount: settlement.amount,
        currency: settlement.currency,
        source: "settlement",
        note: `Settled with ${settlement.toName}`,
        recorded_by_user_id: auth.session.user.id,
      }),
    });

    for (const member of nextGroup.members) {
      if (member.id === settlement.fromMemberId || member.id === settlement.toMemberId) {
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
      eventType: "settlement.recorded",
      eventName: "Settlement recorded",
      status: "success",
      actorUserId: auth.session.user.id,
      actorLabel: auth.profile.fullName,
      groupId: group.id,
      groupName: group.name,
      description: `Recorded settlement: ${settlement.fromName} paid ${settlement.toName} ${formatCurrency(settlement.amount, group.currency)}.`,
      metadata: { amount: settlement.amount, currency: group.currency },
    });

    const refreshed = await fetchSingleGroupForUser(auth.session.accessToken, groupId);
    return jsonWithSession({ group: refreshed ?? nextGroup, settlement }, auth.session, request, 201);
  } catch (error) {
    return errorResponse(error, "Could not record settlement.");
  }
}
