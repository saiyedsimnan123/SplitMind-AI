"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  MessageCircle,
  MoreHorizontal,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserPlus,
  WalletCards,
} from "lucide-react";
import type { Category, Expense, Member } from "@/lib/finance";
import type { MemberBalance, Screen } from "@/lib/types";
import { BudgetDonut } from "@/components/BudgetDonut";
import { Avatar, ProgressBar, money } from "@/components/ui";

export function OverviewView({
  members,
  categories,
  expenses,
  balances,
  totalBudget,
  totalSpent,
  unverifiedCount,
  onSelectScreen,
  onOpenAddMember,
  onReviewExpense,
  onAskAgent,
}: {
  members: Member[];
  categories: Category[];
  expenses: Expense[];
  balances: MemberBalance[];
  totalBudget: number;
  totalSpent: number;
  unverifiedCount: number;
  onSelectScreen: (screen: Screen) => void;
  onOpenAddMember: () => void;
  onReviewExpense: (expense: Expense) => void;
  onAskAgent: (question: string) => void;
}) {
  const spentPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const remaining = totalBudget - totalSpent;
  const you = members[0];
  const yourBalance = balances.find((item) => item.id === you?.id);
  const plannedPerPerson = totalBudget / Math.max(members.length, 1);

  return (
    <>
      <section className="stats-grid" aria-label="Group financial summary">
        <article className="stat-card budget-card">
          <div className="stat-top">
            <span className="stat-label">GROUP BUDGET</span>
            <span className="stat-icon mint-icon">
              <WalletCards size={16} />
            </span>
          </div>
          <div className="stat-number tabular">{money(totalBudget)}</div>
          <div className="stat-foot">
            <span className="positive">{members.length} friends</span>
            <span>·</span>
            <span>{money(plannedPerPerson)} each</span>
          </div>
          <div className="budget-ribbon">
            <span>PLANNED</span>
            <button type="button" className="ribbon-link" onClick={() => onSelectScreen("Budget planner")}>
              Edit draft <ArrowUpRight size={13} />
            </button>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-label">SPENT SO FAR</span>
            <span className="stat-icon peach-icon">
              <ArrowUpRight size={16} />
            </span>
          </div>
          <div className="stat-number tabular">{money(totalSpent)}</div>
          <div className="stat-foot">
            <span className={remaining < 0 ? "warn-text" : "positive"}>{spentPct}% of total budget</span>
            <span>·</span>
            <span>{remaining >= 0 ? `${money(remaining)} left` : `${money(Math.abs(remaining))} over`}</span>
          </div>
          <ProgressBar
            value={spentPct}
            color={spentPct > 95 ? "#c96f4a" : "var(--emerald)"}
            label="Percentage of group budget spent"
          />
          <div className="stat-bottomline">
            <span>{remaining >= 0 ? "On track for your trip" : "Above planned cap"}</span>
            <span className="tabular">{spentPct}%</span>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-label">YOUR CONTRIBUTION</span>
            <span className="stat-icon lilac-icon">
              <ArrowDownLeft size={16} />
            </span>
          </div>
          <div className="stat-number tabular">{money(you?.paid ?? 0)}</div>
          <div className="stat-foot">
            <span>Of {money(plannedPerPerson)} planned share</span>
          </div>
          {yourBalance && yourBalance.outstanding >= 1 ? (
            <div className="paid-note paid-note-pending">
              <span className="paid-check paid-check-pending">
                <Clock3 size={12} />
              </span>
              <span>{money(yourBalance.outstanding)} due vs current spend</span>
            </div>
          ) : (
            <div className="paid-note">
              <span className="paid-check">
                <Check size={12} />
              </span>
              <span>
                {yourBalance && yourBalance.balance >= 1
                  ? `Ahead by ${money(yourBalance.balance)}`
                  : "All settled on current spend"}
              </span>
            </div>
          )}
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-label">GROUP STATUS</span>
            <span className="stat-icon blue-icon">
              {unverifiedCount > 0 ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
            </span>
          </div>
          <div className="status-heading">
            {unverifiedCount > 0 ? `${unverifiedCount} to review` : "All verified"}{" "}
            <span className="status-emoji">✦</span>
          </div>
          <div className="stat-foot">
            {unverifiedCount > 0
              ? "Receipts need human confirmation."
              : "Every submitted expense is verified."}
          </div>
          <div className="status-bottom">
            <div className="avatar-stack">
              {members.slice(0, 5).map((member) => (
                <Avatar key={member.id} member={member} size="sm" />
              ))}
              {members.length > 5 && <span className="stack-more">+{members.length - 5}</span>}
            </div>
            <button type="button" onClick={onOpenAddMember}>
              <UserPlus size={13} /> Add friend
            </button>
          </div>
        </article>
      </section>

      <div className="main-grid">
        <section className="panel budget-panel">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">THE PLAN</div>
              <h2>Budget breakdown</h2>
            </div>
            <button type="button" className="text-button" onClick={() => onSelectScreen("Budget planner")}>
              Edit plan <ArrowUpRight size={14} />
            </button>
          </div>

          <BudgetDonut categories={categories} totalBudget={totalBudget} totalSpent={totalSpent} />

          <div className="budget-footer">
            <div>
              <span className="footer-mark">✦</span>
              <span>Click or hover any category to inspect spend vs budget.</span>
            </div>
            <button type="button" onClick={() => onSelectScreen("Budget planner")}>
              Adjust budget <ChevronRight size={14} />
            </button>
          </div>
        </section>

        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">JUST THE LATEST</div>
              <h2>Recent activity</h2>
            </div>
            <button
              type="button"
              className="more-button"
              onClick={() => onSelectScreen("Activity")}
              aria-label="View all activity"
              title="Open activity & audit history"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>

          <div className="activity-list">
            {expenses.slice(0, 4).map((expense) => (
              <button
                type="button"
                className="activity-row activity-row-button"
                key={expense.id}
                onClick={() => onReviewExpense(expense)}
              >
                <span className={`activity-icon ${expense.verified ? "activity-verified" : "activity-pending"}`}>
                  {expense.verified ? <ReceiptText size={16} /> : <Clock3 size={16} />}
                </span>
                <span className="activity-copy">
                  <strong>{expense.title}</strong>
                  <small>
                    {expense.submittedBy} · {expense.createdAt}
                  </small>
                </span>
                <span className="activity-amount tabular">
                  <span>{money(expense.amount)}</span>
                  <small className={expense.verified ? "verified-label" : "pending-label"}>
                    {expense.verified ? "Verified" : "Needs review"}
                  </small>
                </span>
              </button>
            ))}
          </div>

          <button type="button" className="panel-footer-link" onClick={() => onSelectScreen("Expenses")}>
            See all {expenses.length} expenses <ArrowUpRight size={14} />
          </button>
        </section>
      </div>

      <div className="bottom-grid">
        <section className="panel people-panel">
          <div className="panel-heading">
            <div>
              <div className="section-kicker">SMARTSPLIT BALANCES</div>
              <h2>Everyone&apos;s in the loop</h2>
            </div>
            <button type="button" className="text-button" onClick={() => onSelectScreen("Settlements")}>
              See settlements <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="people-list">
            {balances.slice(0, 4).map((member) => {
              const isAhead = member.balance > 0.99;
              const owes = member.outstanding >= 1;
              return (
                <div className="person-row" key={member.id}>
                  <Avatar member={member} size="sm" />
                  <span className="person-name">{member.name}</span>
                  <span className="person-paid tabular">
                    {money(member.paid)}
                    <small>contributed</small>
                  </span>
                  <span
                    className={`person-status tabular ${
                      owes ? "status-owes" : isAhead ? "status-done" : "status-done"
                    }`}
                  >
                    {owes
                      ? `${money(member.outstanding)} to go`
                      : isAhead
                        ? `+${money(member.balance)} ahead`
                        : "All set"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="agent-card">
          <div className="agent-topline">
            <span className="agent-spark">
              <Sparkles size={15} />
            </span>
            <span>YOUR MONEY SIDEKICK</span>
            <span className="agent-online">
              <i /> HERE FOR YOU
            </span>
          </div>

          <h2>
            Big question?
            <br />
            <em>Small group chat.</em>
          </h2>
          <p>Ask what happens if plans change. Get answers computed from your group&apos;s actual numbers.</p>

          <div className="suggestions">
            <button type="button" onClick={() => onAskAgent("What happens if one member cancels?")}>
              <span>What if someone cancels?</span>
              <ArrowUpRight size={14} />
            </button>
            <button type="button" onClick={() => onAskAgent("Who has not contributed yet?")}>
              <span>Who hasn&apos;t pitched in yet?</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          <button
            type="button"
            className="agent-ask-button"
            onClick={() => onSelectScreen("AI Financial Agent")}
          >
            <MessageCircle size={15} /> Open AI Financial Agent <ArrowUpRight size={14} />
          </button>
        </section>
      </div>
    </>
  );
}
