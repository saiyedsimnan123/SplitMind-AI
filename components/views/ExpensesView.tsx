"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import type { Expense } from "@/lib/finance";
import { ExpenseTable } from "@/components/ExpenseTable";
import { money } from "@/components/ui";

type ExpenseFilter = "all" | "unverified" | "verified";

export function ExpensesView({
  expenses,
  onOpenExpenseModal,
  onReviewExpense,
}: {
  expenses: Expense[];
  onOpenExpenseModal: () => void;
  onReviewExpense: (expense: Expense) => void;
}) {
  const [filter, setFilter] = useState<ExpenseFilter>("all");
  const unverifiedCount = expenses.filter((item) => !item.verified).length;
  const verifiedCount = expenses.length - unverifiedCount;
  const totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0);

  const visibleExpenses = expenses.filter((item) => {
    if (filter === "unverified") return !item.verified;
    if (filter === "verified") return item.verified;
    return true;
  });

  return (
    <section className="panel full-panel">
      <div className="panel-heading">
        <div>
          <div className="section-kicker">SHARED, NOT FUZZY</div>
          <h2>Expense ledger</h2>
        </div>
        <button type="button" className="button button-dark" onClick={onOpenExpenseModal}>
          <Plus size={15} /> Add expense
        </button>
      </div>

      <p className="muted-copy">
        Submitted expenses stay unverified until a group member opens the attached receipt and confirms review.
      </p>

      <div className="filter-toolbar">
        <div className="filter-pills" role="tablist" aria-label="Filter expenses by verification status">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            className={`filter-pill ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All ({expenses.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "unverified"}
            className={`filter-pill ${filter === "unverified" ? "active" : ""}`}
            onClick={() => setFilter("unverified")}
          >
            Needs review ({unverifiedCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "verified"}
            className={`filter-pill ${filter === "verified" ? "active" : ""}`}
            onClick={() => setFilter("verified")}
          >
            Verified ({verifiedCount})
          </button>
        </div>

        <div className="ledger-total-pill tabular">
          Submitted total: <strong>{money(totalAmount)}</strong>
        </div>
      </div>

      <ExpenseTable expenses={visibleExpenses} onReview={onReviewExpense} />
    </section>
  );
}
