"use client";

import { Clock3, FileText } from "lucide-react";
import type { Expense } from "@/lib/finance";
import type { AuditEvent } from "@/lib/types";
import { ExpenseTable } from "@/components/ExpenseTable";

export function ActivityView({
  audit,
  expenses,
  onReviewExpense,
}: {
  audit: AuditEvent[];
  expenses: Expense[];
  onReviewExpense: (expense: Expense) => void;
}) {
  return (
    <section className="panel full-panel">
      <div className="panel-heading">
        <div>
          <div className="section-kicker">THE PAPER TRAIL</div>
          <h2>Activity &amp; audit history</h2>
        </div>
        <span className="save-badge">
          <span /> {audit.length} local event{audit.length === 1 ? "" : "s"}
        </span>
      </div>

      <p className="muted-copy">
        Recent local demo actions. PayPal payment status is independently verified and persisted in Supabase
        when configured.
      </p>

      {audit.length > 0 ? (
        <div className="audit-list" role="list" aria-label="Audit events">
          {audit.map((event) => (
            <div className="audit-row" role="listitem" key={event.id}>
              <span className="activity-icon activity-verified">
                <Clock3 size={15} />
              </span>
              <span className="audit-copy">
                <strong>{event.action}</strong>
                <small>{event.detail}</small>
              </span>
              <time>{event.createdAt}</time>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FileText size={22} />
          <strong>No changes yet.</strong>
          <span>Expense submissions, receipt reviews, member additions, and budget proposals appear here.</span>
        </div>
      )}

      <h3 className="ledger-heading">Expense ledger</h3>
      <ExpenseTable expenses={expenses} onReview={onReviewExpense} />
    </section>
  );
}
