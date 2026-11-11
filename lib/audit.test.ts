import { describe, expect, it } from "vitest";
import {
  buildAuditEvent,
  filterAuditEvents,
  maskEmailForAudit,
  redactAuditMetadata,
  sanitizeAuditText,
} from "@/lib/audit";

describe("Security & financial audit helpers", () => {
  it("redacts tokens, passwords, and secrets from descriptions and metadata", () => {
    const cleanText = sanitizeAuditText(
      "Attempted Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.sig password=supersecret",
    );
    expect(cleanText).not.toContain("supersecret");
    expect(cleanText).not.toContain("eyJhbGci");
    expect(cleanText).toContain("[REDACTED]");

    const meta = redactAuditMetadata({
      password: "Password123!",
      access_token: "secret-jwt",
      service_role: "key-123",
      sessionId: "sess_abc123",
      amount: 500,
    });
    expect(meta.password).toBe("[REDACTED]");
    expect(meta.access_token).toBe("[REDACTED]");
    expect(meta.service_role).toBe("[REDACTED]");
    expect(meta.sessionId).toBe("sess_abc123");
    expect(meta.amount).toBe(500);
  });

  it("masks emails safely for failed login logs", () => {
    expect(maskEmailForAudit("alex.kim@example.com")).toBe("a***m@example.com");
    expect(maskEmailForAudit("a@b.com")).toBe("user@hidden");
  });

  it("filters events by authentication vs financial category, group, status, date, and search", () => {
    const events = [
      buildAuditEvent({
        category: "authentication",
        eventType: "auth.login.succeeded",
        eventName: "Login succeeded",
        status: "success",
        actorLabel: "Alex Kim",
        description: "Signed in on Chrome on Linux.",
        createdAt: "2026-11-10T09:00:00.000Z",
      }),
      buildAuditEvent({
        category: "financial",
        eventType: "expense.created",
        eventName: "Expense logged",
        status: "success",
        actorLabel: "Priya Sharma",
        groupId: "g-goa",
        groupName: "Goa Trip 2026",
        description: "Added Villa deposit (₹12,400).",
        createdAt: "2026-11-11T10:00:00.000Z",
      }),
      buildAuditEvent({
        category: "security",
        eventType: "security.warning",
        eventName: "Blocked audit mutation",
        status: "warning",
        actorLabel: "Alex Kim",
        description: "Blocked client DELETE request.",
        createdAt: "2026-11-11T11:00:00.000Z",
      }),
    ];

    expect(filterAuditEvents(events, { category: "auth_security" })).toHaveLength(2);
    expect(filterAuditEvents(events, { category: "financial_group" })).toHaveLength(1);
    expect(filterAuditEvents(events, { groupId: "g-goa" })).toHaveLength(1);
    expect(filterAuditEvents(events, { groupId: "global" })).toHaveLength(2);
    expect(filterAuditEvents(events, { status: "warning" })).toHaveLength(1);
    expect(filterAuditEvents(events, { dateFrom: "2026-11-11", dateTo: "2026-11-11" })).toHaveLength(2);
    expect(filterAuditEvents(events, { query: "Villa" })).toHaveLength(1);
  });
});
