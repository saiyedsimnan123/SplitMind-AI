import { formatCurrency } from "@/lib/finance";
import {
  addGroupBudgetCategory,
  applyGroupBudgetDraft,
  archiveGroupRecord,
  restoreGroupRecord,
  updateGroupRecord,
} from "@/lib/groups";
import {
  fetchSingleGroupForUser,
  recordServerAuditEvent,
  requireGroupAccess,
  userRestFetch,
} from "@/lib/supabase/db";
import { authenticateApiRequest, errorResponse, jsonWithSession } from "@/lib/supabase/route-auth";
import type { CurrencyCode, PlanType } from "@/lib/types";

export async function GET(
  request: Request,
  context: { params: Promise<{ groupId: string }> },
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const { groupId } = await context.params;
    const group = await requireGroupAccess(auth.session.accessToken, auth.session.user.id, groupId, "member");
    return jsonWithSession({ group }, auth.session, request);
  } catch (error) {
    return errorResponse(error, "Group access denied.", 403);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ groupId: string }> },
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const { groupId } = await context.params;
    const body = (await request.json()) as {
      action?: unknown;
      name?: unknown;
      planType?: unknown;
      description?: unknown;
      currency?: unknown;
      totalBudget?: unknown;
      startDate?: unknown;
      endDate?: unknown;
      draftCategories?: { id: string; budget: number }[];
      proposalRequested?: unknown;
      newCategory?: { label?: unknown; budget?: unknown; color?: unknown };
    };

    const action = typeof body.action === "string" ? body.action : "update_details";

    if (action === "archive" || action === "restore") {
      const group = await requireGroupAccess(auth.session.accessToken, auth.session.user.id, groupId, "organizer");
      const next = action === "archive" ? archiveGroupRecord(group) : restoreGroupRecord(group);
      await userRestFetch(auth.session.accessToken, `groups?id=eq.${encodeURIComponent(groupId)}`, {
        method: "PATCH",
        headers: { prefer: "return=minimal" },
        body: JSON.stringify({ archived_at: next.archivedAt }),
      });

      await recordServerAuditEvent({
        category: "group",
        eventType: action === "archive" ? "group.archived" : "group.restored",
        eventName: action === "archive" ? "Group archived" : "Group restored",
        status: "info",
        actorUserId: auth.session.user.id,
        actorLabel: auth.profile.fullName,
        groupId: group.id,
        groupName: group.name,
        description:
          action === "archive"
            ? `Archived group "${group.name}". Financial records preserved read-only.`
            : `Restored archived group "${group.name}".`,
      });

      const refreshed = await fetchSingleGroupForUser(auth.session.accessToken, groupId);
      return jsonWithSession({ group: refreshed ?? next }, auth.session, request);
    }

    if (action === "save_draft" || action === "apply_budget") {
      const group = await requireGroupAccess(auth.session.accessToken, auth.session.user.id, groupId, "member");
      if (!Array.isArray(body.draftCategories)) {
        return errorResponse(new Error("Budget categories array is required."), "Invalid budget update.", 400);
      }

      const incomingMap = new Map(body.draftCategories.map((item) => [item.id, Number(item.budget)]));
      const updatedDraft = group.draftCategories.map((cat) => {
        const val = incomingMap.get(cat.id);
        return {
          ...cat,
          budget: val !== undefined && Number.isFinite(val) && val >= 0 ? Math.round(val * 100) / 100 : cat.budget,
        };
      });

      const applyNow = action === "apply_budget";
      const next = applyNow ? applyGroupBudgetDraft(group, updatedDraft) : { ...group, draftCategories: updatedDraft };
      const proposalRequested = applyNow ? false : body.proposalRequested === true;

      for (const cat of next.categories) {
        const draftMatch = next.draftCategories.find((d) => d.id === cat.id);
        await userRestFetch(
          auth.session.accessToken,
          `group_budgets?group_id=eq.${encodeURIComponent(groupId)}&category_key=eq.${encodeURIComponent(cat.id)}`,
          {
            method: "PATCH",
            headers: { prefer: "return=minimal" },
            body: JSON.stringify({
              planned_amount: cat.budget,
              draft_amount: draftMatch?.budget ?? cat.budget,
              proposal_requested: proposalRequested,
              updated_by: auth.session.user.id,
            }),
          },
        );
      }

      if (applyNow) {
        await userRestFetch(auth.session.accessToken, `groups?id=eq.${encodeURIComponent(groupId)}`, {
          method: "PATCH",
          headers: { prefer: "return=minimal" },
          body: JSON.stringify({ total_budget: next.totalBudget }),
        });

        await recordServerAuditEvent({
          category: "financial",
          eventType: "budget.updated",
          eventName: "Group budget updated",
          status: "success",
          actorUserId: auth.session.user.id,
          actorLabel: auth.profile.fullName,
          groupId: group.id,
          groupName: group.name,
          description: `Updated agreed budget for "${group.name}" from ${formatCurrency(group.totalBudget, group.currency)} to ${formatCurrency(next.totalBudget, group.currency)}.`,
          metadata: { previousBudget: group.totalBudget, nextBudget: next.totalBudget, currency: group.currency },
        });
      } else if (proposalRequested) {
        const draftTotal = updatedDraft.reduce((sum, c) => sum + c.budget, 0);
        await recordServerAuditEvent({
          category: "financial",
          eventType: "budget.proposal_created",
          eventName: "Budget proposal saved",
          status: "info",
          actorUserId: auth.session.user.id,
          actorLabel: auth.profile.fullName,
          groupId: group.id,
          groupName: group.name,
          description: `Saved budget draft proposal of ${formatCurrency(draftTotal, group.currency)} for review.`,
        });
      }

      const refreshed = await fetchSingleGroupForUser(auth.session.accessToken, groupId);
      return jsonWithSession({ group: refreshed ?? next }, auth.session, request);
    }

    if (action === "add_category" && body.newCategory) {
      const group = await requireGroupAccess(auth.session.accessToken, auth.session.user.id, groupId, "member");
      const next = addGroupBudgetCategory(
        group,
        typeof body.newCategory.label === "string" ? body.newCategory.label : "",
        Number(body.newCategory.budget ?? 0),
        typeof body.newCategory.color === "string" ? body.newCategory.color : "#9ccbf5",
      );
      const added = next.categories[next.categories.length - 1];
      await userRestFetch(auth.session.accessToken, "group_budgets", {
        method: "POST",
        headers: { prefer: "return=minimal" },
        body: JSON.stringify({
          group_id: groupId,
          category_key: added.id,
          label: added.label,
          planned_amount: added.budget,
          draft_amount: added.budget,
          spent_amount: 0,
          color: added.color,
          sort_order: next.categories.length - 1,
          updated_by: auth.session.user.id,
        }),
      });
      await userRestFetch(auth.session.accessToken, `groups?id=eq.${encodeURIComponent(groupId)}`, {
        method: "PATCH",
        headers: { prefer: "return=minimal" },
        body: JSON.stringify({ total_budget: next.totalBudget }),
      });

      await recordServerAuditEvent({
        category: "financial",
        eventType: "budget.updated",
        eventName: "Budget category added",
        status: "success",
        actorUserId: auth.session.user.id,
        actorLabel: auth.profile.fullName,
        groupId: group.id,
        groupName: group.name,
        description: `Added budget category "${added.label}" (${formatCurrency(added.budget, group.currency)}).`,
      });

      const refreshed = await fetchSingleGroupForUser(auth.session.accessToken, groupId);
      return jsonWithSession({ group: refreshed ?? next }, auth.session, request);
    }

    // Default: edit group metadata (organizer/owner only)
    const group = await requireGroupAccess(auth.session.accessToken, auth.session.user.id, groupId, "organizer");
    const next = updateGroupRecord(group, {
      name: typeof body.name === "string" ? body.name : undefined,
      planType:
        body.planType === "trip" ||
        body.planType === "roommates" ||
        body.planType === "event" ||
        body.planType === "project" ||
        body.planType === "other"
          ? (body.planType as PlanType)
          : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      currency:
        body.currency === "INR" ||
        body.currency === "USD" ||
        body.currency === "EUR" ||
        body.currency === "GBP"
          ? (body.currency as CurrencyCode)
          : undefined,
      totalBudget: body.totalBudget !== undefined ? Number(body.totalBudget) : undefined,
      startDate: typeof body.startDate === "string" ? body.startDate : undefined,
      endDate: body.endDate === null ? null : typeof body.endDate === "string" ? body.endDate : undefined,
    });

    await userRestFetch(auth.session.accessToken, `groups?id=eq.${encodeURIComponent(groupId)}`, {
      method: "PATCH",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        name: next.name,
        plan_type: next.planType,
        description: next.description,
        currency: next.currency,
        total_budget: next.totalBudget,
        start_date: next.startDate,
        end_date: next.endDate,
      }),
    });

    if (body.totalBudget !== undefined) {
      for (const cat of next.categories) {
        const draftMatch = next.draftCategories.find((d) => d.id === cat.id);
        await userRestFetch(
          auth.session.accessToken,
          `group_budgets?group_id=eq.${encodeURIComponent(groupId)}&category_key=eq.${encodeURIComponent(cat.id)}`,
          {
            method: "PATCH",
            headers: { prefer: "return=minimal" },
            body: JSON.stringify({
              planned_amount: cat.budget,
              draft_amount: draftMatch?.budget ?? cat.budget,
              updated_by: auth.session.user.id,
            }),
          },
        );
      }
    }

    await recordServerAuditEvent({
      category: "group",
      eventType: "group.updated",
      eventName: "Group details updated",
      status: "success",
      actorUserId: auth.session.user.id,
      actorLabel: auth.profile.fullName,
      groupId: group.id,
      groupName: next.name,
      description: `Updated group settings for "${next.name}" (${next.currency}, ${formatCurrency(next.totalBudget, next.currency)}).`,
    });

    const refreshed = await fetchSingleGroupForUser(auth.session.accessToken, groupId);
    return jsonWithSession({ group: refreshed ?? next }, auth.session, request);
  } catch (error) {
    return errorResponse(error, "Could not update group.");
  }
}
