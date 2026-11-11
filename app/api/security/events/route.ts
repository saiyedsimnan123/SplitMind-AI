import { NextResponse } from "next/server";
import { filterAuditEvents } from "@/lib/audit";
import { listAuditEventsForUser, recordServerAuditEvent } from "@/lib/supabase/db";
import { authenticateApiRequest, errorResponse, jsonWithSession } from "@/lib/supabase/route-auth";
import type { AuditCategory, AuditStatus } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const events = await listAuditEventsForUser(auth.session.accessToken, 250);
    const filtered = filterAuditEvents(events, {
      category: (url.searchParams.get("category") ?? "all") as AuditCategory | "all" | "auth_security" | "financial_group",
      eventType: url.searchParams.get("eventType") ?? "all",
      groupId: url.searchParams.get("groupId") ?? "all",
      status: (url.searchParams.get("status") ?? "all") as AuditStatus | "all",
      query: url.searchParams.get("q") ?? "",
      dateFrom: url.searchParams.get("dateFrom") ?? "",
      dateTo: url.searchParams.get("dateTo") ?? "",
    });
    return jsonWithSession({ events: filtered }, auth.session, request);
  } catch (error) {
    return errorResponse(error, "Could not load security and audit events.", 500);
  }
}

async function rejectMutation(request: Request, method: string) {
  const auth = await authenticateApiRequest(request);
  if (auth.ok) {
    await recordServerAuditEvent({
      category: "security",
      eventType: "security.warning",
      eventName: "Blocked audit log modification attempt",
      status: "warning",
      actorUserId: auth.session.user.id,
      actorLabel: auth.profile.fullName,
      description: `Blocked client ${method} request to immutable security audit log.`,
    });
  }
  return NextResponse.json(
    { error: "Audit events are append-only and cannot be created, edited, or deleted from client requests." },
    { status: 403 },
  );
}

export async function POST(request: Request) {
  return rejectMutation(request, "POST");
}

export async function PATCH(request: Request) {
  return rejectMutation(request, "PATCH");
}

export async function PUT(request: Request) {
  return rejectMutation(request, "PUT");
}

export async function DELETE(request: Request) {
  return rejectMutation(request, "DELETE");
}
