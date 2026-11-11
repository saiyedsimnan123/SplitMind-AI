"use client";

import { Eye, FileCheck2, FileText, Paperclip, Pencil, ReceiptText, ShieldAlert, Trash2 } from "lucide-react";
import type { CurrencyCode, GroupExpense } from "@/lib/types";
import { money } from "@/components/ui";

export function ExpenseTable({
  expenses,
  currency = "INR",
  readOnly = false,
  emptyTitle = "No expenses logged yet.",
  emptyDetail = "Submitted expenses and attached receipts will appear here for group review.",
  onReview,
  onEdit,
  onDelete,
}: {
  expenses: GroupExpense[];
  currency?: CurrencyCode;
  readOnly?: boolean;
  emptyTitle?: string;
  emptyDetail?: string;
  onReview?: (expense: GroupExpense) => void;
  onEdit?: (expense: GroupExpense) => void;
  onDelete?: (expense: GroupExpense) => void;
}) {
  if (!expenses.length) {
    return (
      <div className="empty-state">
        <ReceiptText size={22} />
        <strong>{emptyTitle}</strong>
        <span>{emptyDetail}</span>
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
                <small>{expense.date ? `${expense.date} · ${expense.createdAt}` : expense.createdAt}</small>
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
                    <ShieldAlert size={12} /> No receipt
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
                    {hasReceipt ? "Review" : "Check"}
                  </button>
                )}

                {!readOnly && onEdit && (
                  <button
                    type="button"
                    className="row-icon-btn"
                    onClick={() => onEdit(expense)}
                    title="Edit expense"
                    aria-label={`Edit ${expense.title}`}
                  >
                    <Pencil size={12} />
                  </button>
                )}

                {!readOnly && onDelete && (
                  <button
                    type="button"
                    className="row-icon-btn row-icon-btn-danger"
                    onClick={() => onDelete(expense)}
                    title="Delete expense"
                    aria-label={`Delete ${expense.title}`}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>

            <strong className="table-amount tabular">{money(expense.amount, currency)}</strong>
          </div>
        );
      })}
    </div>
  );
}

export function AuditEmptyIcon() {
  return <FileText size={22} />;
}
