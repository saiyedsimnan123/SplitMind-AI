"use client";

import { Eye, FileCheck2, FileText, Paperclip, ReceiptText, ShieldAlert } from "lucide-react";
import type { Expense } from "@/lib/finance";
import { money } from "@/components/ui";

export function ExpenseTable({
  expenses,
  onReview,
}: {
  expenses: Expense[];
  onReview?: (expense: Expense) => void;
}) {
  if (!expenses.length) {
    return (
      <div className="empty-state">
        <ReceiptText size={22} />
        <strong>No expenses match this filter.</strong>
        <span>Submitted expenses and attached receipts will appear here for group review.</span>
      </div>
    );
  }

  return (
    <div className="expense-table" role="region" aria-label="Expense ledger">
      <div className="table-heading">
        <span>EXPENSE</span>
        <span>CATEGORY</span>
        <span>PAID BY</span>
        <span>STATUS &amp; RECEIPT</span>
        <span className="text-right">AMOUNT</span>
      </div>
      {expenses.map((expense) => {
        const hasReceipt = Boolean(expense.receiptData);
        return (
          <div className="table-row" key={expense.id}>
            <div className="table-expense">
              <span className={`table-receipt ${expense.verified ? "receipt-ok" : "receipt-pending"}`}>
                {expense.verified ? <FileCheck2 size={16} /> : <ReceiptText size={16} />}
              </span>
              <span className="table-expense-copy">
                <strong>{expense.title}</strong>
                <small>{expense.createdAt}</small>
              </span>
            </div>

            <div className="table-cell-meta">
              <span className="category-pill">{expense.category}</span>
            </div>

            <div className="table-cell-meta">{expense.submittedBy}</div>

            <div className="expense-evidence">
              <span className={`status-pill ${expense.verified ? "status-pill-verified" : "status-pill-unverified"}`}>
                <i className={`status-dot ${expense.verified ? "green-dot" : "yellow-dot"}`} />
                {expense.verified ? "Verified" : "Unverified"}
              </span>

              <div className="evidence-links">
                {hasReceipt ? (
                  <a
                    href={expense.receiptData}
                    target="_blank"
                    rel="noreferrer"
                    className="receipt-link"
                    title={expense.receiptName ?? "Open attached receipt"}
                  >
                    <Paperclip size={12} />
                    <span>{expense.receiptName ?? "View receipt"}</span>
                  </a>
                ) : (
                  <small className="no-receipt">
                    <ShieldAlert size={12} /> No receipt attached
                  </small>
                )}

                {!expense.verified && onReview && (
                  <button
                    type="button"
                    className="verify-button"
                    onClick={() => onReview(expense)}
                    title={
                      hasReceipt
                        ? "Open receipt evidence and verify this expense"
                        : "Inspect status — receipt attachment is required to verify"
                    }
                  >
                    <Eye size={12} />
                    {hasReceipt ? "Review & verify" : "Check details"}
                  </button>
                )}
              </div>
            </div>

            <strong className="table-amount tabular">{money(expense.amount)}</strong>
          </div>
        );
      })}
    </div>
  );
}

export function AuditEmptyIcon() {
  return <FileText size={22} />;
}
