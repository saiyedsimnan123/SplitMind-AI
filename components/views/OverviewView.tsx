"use client";

import Image from "next/image";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
  Calculator,
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  GitCompareArrows,
  MessageCircle,
  MoreHorizontal,
  Plus,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserPlus,
  WalletCards,
} from "lucide-react";
import type { Category } from "@/lib/finance";
import type { CurrencyCode, GroupExpense, GroupMember, MemberBalance, Screen } from "@/lib/types";
import { BudgetDonut } from "@/components/BudgetDonut";
import { Avatar, EngineBadge, ProgressBar, money } from "@/components/ui";

export function OverviewView({
  groupName,
  currency,
  isArchived,
  members,
  categories,
  expenses,
  balances,
  totalBudget,
  totalSpent,
  unverifiedCount,
  onSelectScreen,
  onOpenAddMember,
  onOpenExpenseModal,
  onReviewExpense,
  onAskAgent,
}: {
  groupName: string;
  currency: CurrencyCode;
  isArchived: boolean;
  members: GroupMember[];
  categories: Category[];
  expenses: GroupExpense[];
  balances: MemberBalance[];
  totalBudget: number;
  totalSpent: number;
  unverifiedCount: number;
  onSelectScreen: (screen: Screen) => void;
  onOpenAddMember: () => void;
  onOpenExpenseModal: () => void;
  onReviewExpense: (expense: GroupExpense) => void;
  onAskAgent: (question: string) => void;
}) {
  const spentPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const remaining = totalBudget - totalSpent;
  const ownerOrFirst = members.find((m) => m.role === "owner") ?? members[0];
  const yourBalance = balances.find((item) => item.id === ownerOrFirst?.id);
  const plannedPerPerson = totalBudget / Math.max(members.length, 1);
  const maxPaid = Math.max(...balances.map((m) => m.paid), totalSpent / Math.max(members.length, 1), 1);

  return (
    <>
      <section className="engine-hub-strip" aria-label="SplitMind intelligence engines">
        <button type="button" className="engine-pill-btn" onClick={() => onSelectScreen("Settlements")}>
          <Calculator size={14} />
          <div>
            <strong>SmartSplit Engine</strong>
            <small>Equal-share net ledger</small>
          </div>
        </button>
        <button type="button" className="engine-pill-btn" onClick={() => onSelectScreen("Expenses")}>
          <ShieldCheck size={14} />
          <div>
            <strong>Proof Engine</strong>
            <small>{unverifiedCount > 0 ? `${unverifiedCount} awaiting review` : "Receipts verified"}</small>
          </div>
        </button>
        <button type="button" className="engine-pill-btn" onClick={() => onSelectScreen("Budget planner")}>
          <Sparkles size={14} />
          <div>
            <strong>MoneyTwin Engine</strong>
            <small>What-if cost scenarios</small>
          </div>
        </button>
        <button type="button" className="engine-pill-btn" onClick={() => onSelectScreen("Settlements")}>
          <GitCompareArrows size={14} />
          <div>
            <strong>Settlement Intelligence</strong>
            <small>Minimum transfer graph</small>
          </div>
        </button>
        <button type="button" className="engine-pill-btn" onClick={() => onSelectScreen("Payments")}>
          <CreditCard size={14} />
          <div>
            <strong>IntentPay Engine</strong>
            <small>Verified Sandbox flow</small>
          </div>
        </button>
        <button type="button" className="engine-pill-btn" onClick={() => onSelectScreen("AI Financial Agent")}>
          <Bot size={14} />
          <div>
            <strong>AI Financial Agent</strong>
            <small>Deterministic answers</small>
          </div>
        </button>
      </section>

      <section className="stats-grid" aria-label="Group financial summary">
        <article className="stat-card budget-card">
          <div className="stat-top">
            <span className="stat-label">GROUP BUDGET</span>
            <span className="stat-icon blue-icon">
              <WalletCards size={16} />
            </span>
          </div>
          <div className="stat-number tabular">{money(totalBudget, currency)}</div>
          <div className="stat-foot">
            <span className="positive">
              {members.length} member{members.length === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <span>{money(plannedPerPerson, currency)} each</span>
          </div>
          <div className="budget-ribbon">
            <span>AGREED CAP</span>
            <button type="button" className="ribbon-link" onClick={() => onSelectScreen("Budget planner")}>
              Adjust plan <ArrowUpRight size={13} />
            </button>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-label">SPENT SO FAR</span>
            <span className="stat-icon indigo-icon">
              <ArrowUpRight size={16} />
            </span>
          </div>
          <div className="stat-number tabular">{money(totalSpent, currency)}</div>
          <div className="stat-foot">
            <span className={remaining < 0 ? "warn-text" : "positive"}>{spentPct}% of total budget</span>
            <span>·</span>
            <span>
              {remaining >= 0
                ? `${money(remaining, currency)} left`
                : `${money(Math.abs(remaining), currency)} over`}
            </span>
          </div>
          <ProgressBar
            value={spentPct}
            color={spentPct > 95 ? "var(--danger)" : "var(--brand)"}
            label="Percentage of group budget spent"
          />
          <div className="stat-bottomline">
            <span>{remaining >= 0 ? "Within budget corridor" : "Exceeds planned cap"}</span>
            <span className="tabular">{spentPct}%</span>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-label">ORGANIZER SHARE</span>
            <span className="stat-icon teal-icon">
              <ArrowDownLeft size={16} />
            </span>
          </div>
          <div className="stat-number tabular">{money(ownerOrFirst?.paid ?? 0, currency)}</div>
          <div className="stat-foot">
            <span>Of {money(plannedPerPerson, currency)} planned share</span>
          </div>
          {yourBalance && yourBalance.outstanding >= 1 ? (
            <div className="paid-note paid-note-pending">
              <span className="paid-check paid-check-pending">
                <Clock3 size={12} />
              </span>
              <span>{money(yourBalance.outstanding, currency)} due vs current spend</span>
            </div>
          ) : (
            <div className="paid-note">
              <span className="paid-check">
                <Check size={12} />
              </span>
              <span>
                {yourBalance && yourBalance.balance >= 1
                  ? `Ahead by ${money(yourBalance.balance, currency)}`
                  : "All settled on current spend"}
              </span>
            </div>
          )}
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span className="stat-label">PROOF ENGINE STATUS</span>
            <span className="stat-icon teal-icon">
              {unverifiedCount > 0 ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
            </span>
          </div>
          <div className="status-heading">
            {expenses.length === 0
              ? "Ready to track"
              : unverifiedCount > 0
                ? `${unverifiedCount} to review`
                : "All verified"}
          </div>
          <div className="stat-foot">
            {expenses.length === 0
              ? `No expenses logged in ${groupName} yet.`
              : unverifiedCount > 0
                ? "Receipts await human confirmation."
                : "Every submitted expense is verified."}
          </div>
          <div className="status-bottom">
            <div className="avatar-stack">
              {members.slice(0, 5).map((member) => (
                <Avatar key={member.id} member={member} size="sm" />
              ))}
              {members.length > 5 && <span className="stack-more">+{members.length - 5}</span>}
            </div>
            <button type="button" onClick={onOpenAddMember} disabled={isArchived}>
              <UserPlus size={13} /> Add member
            </button>
          </div>
        </article>
      </section>

      <div className="main-grid">
        <section className="panel budget-panel">
          <div className="panel-heading">
            <div>
              <div className="panel-kicker-row">
                <span className="section-kicker">SHARED ALLOCATION</span>
                <EngineBadge engine="moneytwin" />
              </div>
              <h2>Budget breakdown</h2>
            </div>
            <button type="button" className="text-button" onClick={() => onSelectScreen("Budget planner")}>
              Edit plan <ArrowUpRight size={14} />
            </button>
          </div>

          <BudgetDonut
            categories={categories}
            totalBudget={totalBudget}
            totalSpent={totalSpent}
            currency={currency}
          />

          <div className="budget-footer">
            <div>
              <span className="footer-mark">●</span>
              <span>Select any segment to compare category spend vs planned cap.</span>
            </div>
            <button type="button" onClick={() => onSelectScreen("Budget planner")}>
              Simulate in MoneyTwin <ChevronRight size={14} />
            </button>
          </div>
        </section>

        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <div className="panel-kicker-row">
                <span className="section-kicker">EXPENSE LEDGER</span>
                <EngineBadge engine="proof" />
              </div>
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

          {expenses.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 14 }}>
              <Image
                src="/images/empty-ledger.svg"
                alt="Empty group expense ledger"
                width={180}
                height={112}
                unoptimized
              />
              <strong>No expenses logged in {groupName} yet.</strong>
              <span>Add your first shared expense or invite members to activate SmartSplit tracking.</span>
              {!isArchived && (
                <button type="button" className="button button-primary" onClick={onOpenExpenseModal}>
                  <Plus size={14} /> Log first expense
                </button>
              )}
            </div>
          ) : (
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
                    <span>{money(expense.amount, currency)}</span>
                    <small className={expense.verified ? "verified-label" : "pending-label"}>
                      {expense.verified ? "Verified" : "Needs review"}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}

          <button type="button" className="panel-footer-link" onClick={() => onSelectScreen("Expenses")}>
            Inspect all {expenses.length} expense{expenses.length === 1 ? "" : "s"} <ArrowUpRight size={14} />
          </button>
        </section>
      </div>

      <div className="bottom-grid">
        <section className="panel people-panel">
          <div className="panel-heading">
            <div>
              <div className="panel-kicker-row">
                <span className="section-kicker">NET POSITIONS</span>
                <EngineBadge engine="smartsplit" />
              </div>
              <h2>Member contributions</h2>
            </div>
            <button type="button" className="text-button" onClick={() => onSelectScreen("Settlements")}>
              Settlement Intelligence <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="people-list">
            {balances.slice(0, 5).map((member) => {
              const isAhead = member.balance > 0.99;
              const owes = member.outstanding >= 1;
              const barWidth = Math.min(100, Math.round((member.paid / maxPaid) * 100));
              return (
                <div className="person-row-enhanced" key={member.id}>
                  <div className="person-row-top">
                    <Avatar member={member} size="sm" />
                    <span className="person-name">{member.name}</span>
                    <span className="person-paid tabular">
                      {money(member.paid, currency)}
                      <small>of {money(member.share, currency)} share</small>
                    </span>
                    <span className={`person-status tabular ${owes ? "status-owes" : "status-done"}`}>
                      {owes
                        ? `${money(member.outstanding, currency)} due`
                        : isAhead
                          ? `+${money(member.balance, currency)} ahead`
                          : "Settled"}
                    </span>
                  </div>
                  <div className="contrib-bar-track" aria-hidden="true">
                    <span
                      style={{
                        width: `${member.paid > 0 ? Math.max(barWidth, 4) : 0}%`,
                        background: owes ? "var(--amber)" : "var(--teal)",
                      }}
                    />
                  </div>
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
            <span>AI GROUP FINANCIAL AGENT</span>
            <span className="agent-online">
              <i /> ACTIVE
            </span>
          </div>

          <h2>
            Instant clarity on
            <br />
            <em>{groupName}.</em>
          </h2>
          <p>
            Ask what happens if plans shift. Every answer is backed by deterministic SmartSplit and
            MoneyTwin math.
          </p>

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
