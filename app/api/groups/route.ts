import { formatCurrency } from "@/lib/finance";
import { createGroupRecord } from "@/lib/groups";
import {
  ensureUserProfile,
  fetchAllGroupsForUser,
  persistNewGroupInDb,
  recordServerAuditEvent,
  seedInitialGoaWorkspaceIfNeeded,
} from "@/lib/supabase/db";
import { authenticateApiRequest, errorResponse, jsonWithSession } from "@/lib/supabase/route-auth";
import type { CurrencyCode, PlanType } from "@/lib/types";

function parsePlanType(raw: unknown): PlanType {
  if (raw === "trip" || raw === "roommates" || raw === "event" || raw === "project" || raw === "other") {
    return raw;
  }
  return "other";
}

function parseCurrency(raw: unknown): CurrencyCode {
  if (raw === "INR" || raw === "USD" || raw === "EUR" || raw === "GBP") return raw;
  return "INR";
}

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const { profile, workspaceInitialized } = await ensureUserProfile(
      auth.session.accessToken,
      auth.session.user,
    );
    await seedInitialGoaWorkspaceIfNeeded(auth.session.accessToken, profile, workspaceInitialized);
    const groups = await fetchAllGroupsForUser(auth.session.accessToken);
    return jsonWithSession({ groups }, auth.session, request);
  } catch (error) {
    return errorResponse(error, "Could not load groups.", 500);
  }
}

export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      name?: unknown;
      planType?: unknown;
      description?: unknown;
      currency?: unknown;
      totalBudget?: unknown;
      startDate?: unknown;
      endDate?: unknown;
    };

    const name = typeof body.name === "string" ? body.name : "";
    const planType = parsePlanType(body.planType);
    const description = typeof body.description === "string" ? body.description : "";
    const currency = parseCurrency(body.currency);
    const totalBudget = Number(body.totalBudget ?? 0);
    const startDate =
      typeof body.startDate === "string" && body.startDate
        ? body.startDate
        : new Date().toISOString().slice(0, 10);
    const endDate = typeof body.endDate === "string" && body.endDate ? body.endDate : null;

    const draft = createGroupRecord({
      name,
      planType,
      description,
      currency,
      totalBudget,
      startDate,
      endDate,
      ownerName: auth.profile.fullName,
      ownerEmail: auth.profile.email,
      ownerUserId: auth.session.user.id,
    });

    const saved = await persistNewGroupInDb(auth.session.accessToken, auth.session.user.id, draft);

    await recordServerAuditEvent({
      category: "group",
      eventType: "group.created",
      eventName: "Group created",
      status: "success",
      actorUserId: auth.session.user.id,
      actorLabel: auth.profile.fullName,
      groupId: saved.id,
      groupName: saved.name,
      description: `Created ${saved.planType} group "${saved.name}" with ${formatCurrency(saved.totalBudget, saved.currency)} budget.`,
      metadata: { planType: saved.planType, currency: saved.currency, totalBudget: saved.totalBudget },
    });

    return jsonWithSession({ group: saved }, auth.session, request, 201);
  } catch (error) {
    return errorResponse(error, "Could not create group.", 400);
  }
}
