import { formatCurrency } from "@/lib/finance";
import { deleteGroupExpense, updateGroupExpense, verifyGroupExpense } from "@/lib/groups";
import {
  fetchSingleGroupForUser,
  recordServerAuditEvent,
  requireGroupAccess,
  userRestFetch,
} from "@/lib/supabase/db";
import { authenticateApiRequest, errorResponse, jsonWithSession } from "@/lib/supabase/route-auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ groupId: string; expenseId: string }> },
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const { groupId, expenseId } = await context.params;
    const group = await requireGroupAccess(auth.session.accessToken, auth.session.user.id, groupId, "member");
    if (group.archivedAt) {
      return errorResponse(new Error("Restore this archived group before modifying expenses."), "Group is archived.", 409);
    }

    const body = (await request.json()) as {
      action?: unknown;
      title?: unknown;
      amount?: unknown;
      category?: unknown;
      paidByMemberId?: unknown;
      date?: unknown;
      notes?: unknown;
    };

    if (body.action === "verify") {
      const { group: nextGroup, expense } = verifyGroupExpense(group, expenseId);
      await userRestFetch(
        auth.session.accessToken,
        `expenses?id=eq.${encodeURIComponent(expenseId)}&group_id=eq.${encodeURIComponent(groupId)}`,
        {
          method: "PATCH",
          headers: { prefer: "return=minimal" },
          body: JSON.stringify({
            verified: true,
            verified_by_user_id: auth.session.user.id,
            verified_at: new Date().toISOString(),
          }),
        },
      );

      await recordServerAuditEvent({
        category: "financial",
        eventType: "expense.verified",
        eventName: "Receipt verified",
        status: "success",
        actorUserId: auth.session.user.id,
        actorLabel: auth.profile.fullName,
        groupId: group.id,
        groupName: group.name,
        description: `Verified receipt for "${expense.title}" (${formatCurrency(expense.amount, group.currency)}).`,
      });

      const refreshed = await fetchSingleGroupForUser(auth.session.accessToken, groupId);
      return jsonWithSession({ group: refreshed ?? nextGroup }, auth.session, request);
    }

    const nextGroup = updateGroupExpense(group, expenseId, {
      title: typeof body.title === "string" ? body.title : undefined,
      amount: body.amount !== undefined ? Number(body.amount) : undefined,
      category: typeof body.category === "string" ? body.category : undefined,
      paidByMemberId: typeof body.paidByMemberId === "string" ? body.paidByMemberId : undefined,
      date: typeof body.date === "string" ? body.date : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });

    const updatedExpense = nextGroup.expenses.find((e) => e.id === expenseId)!;

    await userRestFetch(
      auth.session.accessToken,
      `expenses?id=eq.${encodeURIComponent(expenseId)}&group_id=eq.${encodeURIComponent(groupId)}`,
      {
        method: "PATCH",
        headers: { prefer: "return=minimal" },
        body: JSON.stringify({
          title: updatedExpense.title,
          amount: updatedExpense.amount,
          category_label: updatedExpense.category,
          paid_by_member_id: updatedExpense.paidByMemberId,
          paid_by_name: updatedExpense.submittedBy,
          expense_date: updatedExpense.date ?? group.startDate,
          notes: updatedExpense.notes ?? "",
          verified: updatedExpense.verified,
        }),
      },
    );

    for (const cat of nextGroup.categories) {
      await userRestFetch(
        auth.session.accessToken,
        `group_budgets?group_id=eq.${encodeURIComponent(groupId)}&category_key=eq.${encodeURIComponent(cat.id)}`,
        {
          method: "PATCH",
          headers: { prefer: "return=minimal" },
          body: JSON.stringify({ spent_amount: cat.spent }),
        },
      );
    }

    for (const member of nextGroup.members) {
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

    await recordServerAuditEvent({
      category: "financial",
      eventType: "expense.updated",
      eventName: "Expense updated",
      status: "success",
      actorUserId: auth.session.user.id,
      actorLabel: auth.profile.fullName,
      groupId: group.id,
      groupName: group.name,
      description: `Edited expense "${updatedExpense.title}" (${formatCurrency(updatedExpense.amount, group.currency)}).`,
    });

    const refreshed = await fetchSingleGroupForUser(auth.session.accessToken, groupId);
    return jsonWithSession({ group: refreshed ?? nextGroup }, auth.session, request);
  } catch (error) {
    return errorResponse(error, "Could not update expense.");
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ groupId: string; expenseId: string }> },
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const { groupId, expenseId } = await context.params;
    const group = await requireGroupAccess(auth.session.accessToken, auth.session.user.id, groupId, "member");
    if (group.archivedAt) {
      return errorResponse(new Error("Restore this archived group before deleting expenses."), "Group is archived.", 409);
    }

    const { group: nextGroup, deleted } = deleteGroupExpense(group, expenseId);

    await userRestFetch(
      auth.session.accessToken,
      `expenses?id=eq.${encodeURIComponent(expenseId)}&group_id=eq.${encodeURIComponent(groupId)}`,
      { method: "DELETE" },
    );

    for (const cat of nextGroup.categories) {
      await userRestFetch(
        auth.session.accessToken,
        `group_budgets?group_id=eq.${encodeURIComponent(groupId)}&category_key=eq.${encodeURIComponent(cat.id)}`,
        {
          method: "PATCH",
          headers: { prefer: "return=minimal" },
          body: JSON.stringify({ spent_amount: cat.spent }),
        },
      );
    }

    for (const member of nextGroup.members) {
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

    await recordServerAuditEvent({
      category: "financial",
      eventType: "expense.deleted",
      eventName: "Expense deleted",
      status: "warning",
      actorUserId: auth.session.user.id,
      actorLabel: auth.profile.fullName,
      groupId: group.id,
      groupName: group.name,
      description: `Deleted expense "${deleted.title}" (${formatCurrency(deleted.amount, group.currency)}).`,
    });

    const refreshed = await fetchSingleGroupForUser(auth.session.accessToken, groupId);
    return jsonWithSession({ group: refreshed ?? nextGroup }, auth.session, request);
  } catch (error) {
    return errorResponse(error, "Could not delete expense.");
  }
}
