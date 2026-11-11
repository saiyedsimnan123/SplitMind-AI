import { formatCurrency } from "@/lib/finance";
import { addGroupExpense } from "@/lib/groups";
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
      return errorResponse(new Error("Restore this archived group before adding expenses."), "Group is archived.", 409);
    }

    const body = (await request.json()) as {
      title?: unknown;
      amount?: unknown;
      category?: unknown;
      paidByMemberId?: unknown;
      submittedBy?: unknown;
      date?: unknown;
      notes?: unknown;
      receiptName?: unknown;
      receiptData?: unknown;
    };

    const receiptData =
      typeof body.receiptData === "string" && body.receiptData.length <= 450_000
        ? body.receiptData
        : undefined;
    if (typeof body.receiptData === "string" && !receiptData) {
      return errorResponse(new Error("Receipt attachment exceeds maximum allowed size."), "Receipt too large.", 400);
    }

    const { group: nextGroup, expense } = addGroupExpense(group, {
      title: typeof body.title === "string" ? body.title : "",
      amount: Number(body.amount ?? 0),
      category: typeof body.category === "string" ? body.category : (group.categories[0]?.label ?? "Other"),
      paidByMemberId: typeof body.paidByMemberId === "string" ? body.paidByMemberId : undefined,
      submittedBy: typeof body.submittedBy === "string" ? body.submittedBy : "",
      date: typeof body.date === "string" ? body.date : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      receiptName: typeof body.receiptName === "string" ? body.receiptName.slice(0, 120) : undefined,
      receiptData,
    });

    const matchedCategory = nextGroup.categories.find((c) => c.label === expense.category) ?? nextGroup.categories[0];
    const payer = nextGroup.members.find((m) => m.id === expense.paidByMemberId) ?? nextGroup.members[0];

    const budgetRows = await userRestFetch<{ id: string }[]>(
      auth.session.accessToken,
      `group_budgets?group_id=eq.${encodeURIComponent(groupId)}&category_key=eq.${encodeURIComponent(matchedCategory?.id ?? "")}&select=id`,
    );

    await userRestFetch(auth.session.accessToken, "expenses", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        id: expense.id,
        group_id: groupId,
        category_id: budgetRows?.[0]?.id ?? null,
        category_label: expense.category,
        title: expense.title,
        amount: expense.amount,
        paid_by_member_id: payer.id,
        paid_by_name: payer.name,
        created_by_user_id: auth.session.user.id,
        verified: false,
        receipt_name: expense.receiptName ?? null,
        receipt_data: expense.receiptData ?? null,
        expense_date: expense.date ?? group.startDate,
        notes: expense.notes ?? "",
      }),
    });

    if (matchedCategory) {
      await userRestFetch(
        auth.session.accessToken,
        `group_budgets?group_id=eq.${encodeURIComponent(groupId)}&category_key=eq.${encodeURIComponent(matchedCategory.id)}`,
        {
          method: "PATCH",
          headers: { prefer: "return=minimal" },
          body: JSON.stringify({ spent_amount: matchedCategory.spent }),
        },
      );
    }

    await userRestFetch(
      auth.session.accessToken,
      `group_memberships?id=eq.${encodeURIComponent(payer.id)}&group_id=eq.${encodeURIComponent(groupId)}`,
      {
        method: "PATCH",
        headers: { prefer: "return=minimal" },
        body: JSON.stringify({ paid_amount: payer.paid }),
      },
    );

    await userRestFetch(auth.session.accessToken, "contributions", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        group_id: groupId,
        member_id: payer.id,
        amount: expense.amount,
        currency: group.currency,
        source: "expense",
        note: expense.title,
        recorded_by_user_id: auth.session.user.id,
      }),
    });

    await recordServerAuditEvent({
      category: "financial",
      eventType: "expense.created",
      eventName: "Expense logged",
      status: "success",
      actorUserId: auth.session.user.id,
      actorLabel: auth.profile.fullName,
      groupId: group.id,
      groupName: group.name,
      description: `Added "${expense.title}" (${formatCurrency(expense.amount, group.currency)}, paid by ${payer.name}).`,
      metadata: { expenseId: expense.id, amount: expense.amount, category: expense.category },
    });

    const refreshed = await fetchSingleGroupForUser(auth.session.accessToken, groupId);
    return jsonWithSession({ group: refreshed ?? nextGroup, expense }, auth.session, request, 201);
  } catch (error) {
    return errorResponse(error, "Could not save expense.");
  }
}
