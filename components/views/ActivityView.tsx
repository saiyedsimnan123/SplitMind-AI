"use client";

import { ArrowUpRight, Clock3, FileText, LockKeyhole } from "lucide-react";
import type { AuditEvent, CurrencyCode, GroupExpense } from "@/lib/types";
import { ExpenseTable } from "@/components/ExpenseTable";

export function ActivityView({
  groupId,
  groupName,
  currency,
  audit,
  expenses,
  onReviewExpense,
  onOpenSecuritySettings,
}: {
  groupId: string;
  groupName: string;
  currency: CurrencyCode;
  audit: AuditEvent[];
  expenses: GroupExpense[];
  onReviewExpense: (expense: GroupExpense) => void;
  onOpenSecuritySettings: () => void;
}) {
  const groupEvents = audit.filter((event) => event.groupId === groupId);

  return (
    <section className="panel full-panel">
      <div className="panel-heading">
        <div>
          <div className="section-kicker">{groupName.toUpperCase()} · PAPER TRAIL</div>
          <h2>Activity &amp; audit history</h2>
        </div>
        <button type="button" className="button button-outline" onClick={onOpenSecuritySettings}>
          <LockKeyhole size={14} /> Security &amp; Activity <ArrowUpRight size={14} />
        </button>
      </div>

      <p className="muted-copy">
        Recent group events for {groupName}. Authentication, session revocations, and cross-group audit trails
        are available in Settings → Security &amp; Activity.
      </p>

      {groupEvents.length > 0 ? (
        <div className="audit-list" role="list" aria-label="Group audit events">
          {groupEvents.map((event) => (
            <div className="audit-row" role="listitem" key={event.id}>
              <span className="activity-icon activity-verified">
                <Clock3 size={15} />
              </span>
              <span className="audit-copy">
                <strong>
                  {event.eventName} · <small className="actor-inline">{event.actorLabel}</small>
                </strong>
                <small>{event.description}</small>
              </span>
              <time>{new Date(event.createdAt).toLocaleString()}</time>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FileText size={22} />
          <strong>No changes recorded in {groupName} yet.</strong>
          <span>Expense submissions, receipt reviews, member changes, and budget updates appear here.</span>
        </div>
      )}

      <h3 className="ledger-heading">Expense ledger</h3>
      <ExpenseTable expenses={expenses} currency={currency} onReview={onReviewExpense} />
    </section>
  );
}
