import type { AuditCategory, AuditEvent, AuditStatus } from "@/lib/types";

const SENSITIVE_KEY_PATTERN =
  /pass(word|phrase)?|secret|token|apikey|api_key|authorization|cookie|credential|service_role|cvv|card|pin/i;

export function sanitizeAuditText(input: string): string {
  return input
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.?[A-Za-z0-9_-]*/g, "[REDACTED_JWT]")
    .replace(/(password|token|secret|apikey|api_key)\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
    .trim()
    .slice(0, 600);
}

export function redactAuditMetadata(
  input: Record<string, unknown> | undefined,
): Record<string, string | number | boolean | null> {
  if (!input) return {};
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = "[REDACTED]";
      continue;
    }
    if (value === null || typeof value === "boolean" || typeof value === "number") {
      result[key] = Number.isNaN(value) ? null : value;
    } else if (typeof value === "string") {
      result[key] = sanitizeAuditText(value).slice(0, 160);
    } else {
      result[key] = "[OMITTED]";
    }
  }
  return result;
}

export function maskEmailForAudit(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 1) return "user@hidden";
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export function buildAuditEvent(input: {
  id?: string;
  category: AuditCategory;
  eventType: string;
  eventName: string;
  status: AuditStatus;
  actorUserId?: string | null;
  actorLabel: string;
  groupId?: string | null;
  groupName?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}): AuditEvent {
  return {
    id: input.id ?? crypto.randomUUID(),
    category: input.category,
    eventType: input.eventType.slice(0, 80),
    eventName: input.eventName.slice(0, 120),
    status: input.status,
    actorUserId: input.actorUserId ?? null,
    actorLabel: sanitizeAuditText(input.actorLabel).slice(0, 120) || "Workspace user",
    groupId: input.groupId ?? null,
    groupName: input.groupName ? sanitizeAuditText(input.groupName).slice(0, 100) : null,
    description: sanitizeAuditText(input.description),
    metadata: redactAuditMetadata(input.metadata),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function isAuthenticationCategory(category: AuditCategory): boolean {
  return category === "authentication" || category === "security";
}

export type AuditFilterOptions = {
  category?: AuditCategory | "all" | "auth_security" | "financial_group";
  eventType?: string;
  groupId?: string | "all" | "global";
  status?: AuditStatus | "all";
  query?: string;
  dateFrom?: string;
  dateTo?: string;
};

export function filterAuditEvents(events: AuditEvent[], filters: AuditFilterOptions): AuditEvent[] {
  const q = filters.query?.trim().toLowerCase() ?? "";
  return events.filter((event) => {
    if (filters.category && filters.category !== "all") {
      if (filters.category === "auth_security" && !isAuthenticationCategory(event.category)) return false;
      if (filters.category === "financial_group" && isAuthenticationCategory(event.category)) return false;
      if (
        filters.category !== "auth_security" &&
        filters.category !== "financial_group" &&
        event.category !== filters.category
      ) {
        return false;
      }
    }
    if (filters.eventType && filters.eventType !== "all" && event.eventType !== filters.eventType) {
      return false;
    }
    if (filters.status && filters.status !== "all" && event.status !== filters.status) {
      return false;
    }
    if (filters.groupId && filters.groupId !== "all") {
      if (filters.groupId === "global" && event.groupId !== null) return false;
      if (filters.groupId !== "global" && event.groupId !== filters.groupId) return false;
    }
    if (filters.dateFrom) {
      const eventDate = event.createdAt.slice(0, 10);
      if (eventDate < filters.dateFrom) return false;
    }
    if (filters.dateTo) {
      const eventDate = event.createdAt.slice(0, 10);
      if (eventDate > filters.dateTo) return false;
    }
    if (q) {
      const haystack = `${event.eventName} ${event.eventType} ${event.description} ${event.actorLabel} ${event.groupName ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}
