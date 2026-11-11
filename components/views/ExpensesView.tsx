"use client";

import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Category } from "@/lib/finance";
import type { CurrencyCode, GroupExpense } from "@/lib/types";
import { ExpenseTable } from "@/components/ExpenseTable";
import { money } from "@/components/ui";

type ExpenseFilter = "all" | "unverified" | "verified";

export function ExpensesView({
  groupName,
  currency,
  isArchived,
  expenses,
  categories,
  onOpenExpenseModal,
  onReviewExpense,
  onEditExpense,
  onRequestDeleteExpense,
}: {
  groupName: string;
  currency: CurrencyCode;
  isArchived: boolean;
  expenses: GroupExpense[];
  categories: Category[];
  onOpenExpenseModal: () => void;
  onReviewExpense: (expense: GroupExpense) => void;
  onEditExpense: (expense: GroupExpense) => void;
  onRequestDeleteExpense: (expense: GroupExpense) => void;
}) {
  const [filter, setFilter] = useState<ExpenseFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const unverifiedCount = expenses.filter((item) => !item.verified).length;
  const verifiedCount = expenses.length - unverifiedCount;

  const visibleExpenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return expenses.filter((item) => {
      if (filter === "unverified" && item.verified) return false;
      if (filter === "verified" && !item.verified) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (q) {
        const hay = `${item.title} ${item.category} ${item.submittedBy} ${item.notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, filter, categoryFilter, searchQuery]);

  const totalAmount = visibleExpenses.reduce((sum, item) => sum + item.amount, 0);

  return (
    <section className="panel full-panel">
      <div className="panel-heading">
        <div>
          <div className="section-kicker">{groupName.toUpperCase()} · LEDGER</div>
          <h2>Expense ledger</h2>
        </div>
        <button type="button" className="button button-dark" onClick={onOpenExpenseModal} disabled={isArchived}>
          <Plus size={15} /> Add expense
        </button>
      </div>

      <p className="muted-copy">
        Expenses in {groupName} stay unverified until a member opens the attached receipt and confirms review.
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

        <div className="search-filter-pair">
          <label className="search-input-box">
            <Search size={14} />
            <input
              aria-label="Search expenses"
              placeholder="Search expenses or payers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>

          <select
            aria-label="Filter by category"
            className="compact-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.label}>
                {cat.label}
              </option>
            ))}
          </select>

          <div className="ledger-total-pill tabular">
            Showing: <strong>{money(totalAmount, currency)}</strong>
          </div>
        </div>
      </div>

      <ExpenseTable
        expenses={visibleExpenses}
        currency={currency}
        readOnly={isArchived}
        emptyTitle={expenses.length === 0 ? `No expenses in ${groupName} yet.` : "No expenses match this filter."}
        emptyDetail={
          expenses.length === 0
            ? "Add your first group expense above to begin calculating balances and settlements."
            : "Try clearing the search query, category filter, or status filter."
        }
        onReview={onReviewExpense}
        onEdit={onEditExpense}
        onDelete={onRequestDeleteExpense}
      />
    </section>
  );
}
