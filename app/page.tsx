"use client";

import { Plus, ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { initialCategories, initialExpenses, initialMembers } from "@/lib/demo-data";
import { calculateBalances, optimizeSettlements, type Expense } from "@/lib/finance";
import type { AuditEvent, ChatMessage, PaymentFeedback, Screen } from "@/lib/types";
import { AgentRail } from "@/components/AgentRail";
import { AddMemberModal, ExpenseModal, ReceiptReviewModal } from "@/components/Modals";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { money } from "@/components/ui";
import { ActivityView } from "@/components/views/ActivityView";
import { AgentView } from "@/components/views/AgentView";
import { BudgetPlannerView } from "@/components/views/BudgetPlannerView";
import { ExpensesView } from "@/components/views/ExpensesView";
import { GroupsView } from "@/components/views/GroupsView";
import { OverviewView } from "@/components/views/OverviewView";
import { PaymentsView } from "@/components/views/PaymentsView";
import { SettingsView } from "@/components/views/SettingsView";
import { SettlementsView } from "@/components/views/SettlementsView";

const SCREEN_COPY: Record<Screen, { subtitle: string }> = {
  Overview: { subtitle: "A little less back-and-forth. A lot more clarity on where the trip stands." },
  Groups: { subtitle: "Full trip roster, equal-share math, and member contributions in one place." },
  "Budget planner": { subtitle: "Shape category proposals and stress-test changes with MoneyTwin." },
  Expenses: { subtitle: "Every submission stays unverified until a person opens the receipt and confirms." },
  Payments: { subtitle: "USD Sandbox checkout with client idempotency and server-side capture verification." },
  Settlements: { subtitle: "Minimum-transfer settlement suggestions derived from submitted spend." },
  "AI Financial Agent": { subtitle: "Conversational explanations backed by deterministic SplitMind calculations." },
  Activity: { subtitle: "Local demo audit timeline alongside your complete expense ledger." },
  Settings: { subtitle: "Manage local workspace storage and reset the Goa Trip 2026 demo." },
};

const AVATAR_PALETTE = ["sky", "mint", "violet", "yellow", "pink", "lime", "coral", "blue"];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("Overview");
  const [members, setMembers] = useState(initialMembers);
  const [categories, setCategories] = useState(initialCategories);
  const [draftCategories, setDraftCategories] = useState(initialCategories);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [proposalRequested, setProposalRequested] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Hey Alex! I’ve got the Goa trip numbers. Ask me about your budget, contributions, or what-if scenarios.",
      source: "SplitMind deterministic engine",
    },
  ]);
  const [ask, setAsk] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const [expenseModal, setExpenseModal] = useState(false);
  const [memberModal, setMemberModal] = useState(false);
  const [reviewingExpenseId, setReviewingExpenseId] = useState<string | null>(null);

  const [paymentAmount, setPaymentAmount] = useState("10.00");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentFeedback, setPaymentFeedback] = useState<PaymentFeedback>({
    tone: "idle",
    headline: "",
  });

  const [storageError, setStorageError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [copilotDrawer, setCopilotDrawer] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const totalBudget = useMemo(() => categories.reduce((sum, item) => sum + item.budget, 0), [categories]);
  const draftTotal = useMemo(() => draftCategories.reduce((sum, item) => sum + item.budget, 0), [draftCategories]);
  const totalSpent = useMemo(() => categories.reduce((sum, item) => sum + item.spent, 0), [categories]);
  const unverifiedCount = useMemo(() => expenses.filter((item) => !item.verified).length, [expenses]);

  const balances = useMemo(() => {
    try {
      return calculateBalances(members, totalSpent);
    } catch {
      return [];
    }
  }, [members, totalSpent]);

  const settlementResult = useMemo(() => {
    try {
      return { transfers: optimizeSettlements(members, totalSpent), error: "" };
    } catch (error) {
      return {
        transfers: [],
        error: error instanceof Error ? error.message : "Balances could not be reconciled.",
      };
    }
  }, [members, totalSpent]);

  const reviewingExpense = useMemo(
    () => expenses.find((item) => item.id === reviewingExpenseId) ?? null,
    [expenses, reviewingExpenseId],
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem("splitmind-demo");
      if (saved) {
        const data = JSON.parse(saved);
        if (Array.isArray(data.members) && Array.isArray(data.categories) && Array.isArray(data.expenses)) {
          setMembers(data.members);
          setCategories(data.categories);
          setDraftCategories(Array.isArray(data.draftCategories) ? data.draftCategories : data.categories);
          setExpenses(data.expenses);
          setAudit(Array.isArray(data.audit) ? data.audit : []);
          setProposalRequested(data.proposalRequested === true);
        }
      }
    } catch (error) {
      console.error("Could not restore the saved demo workspace.", error);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        "splitmind-demo",
        JSON.stringify({ members, categories, draftCategories, expenses, audit, proposalRequested }),
      );
      setStorageError("");
    } catch (error) {
      console.error("Could not save the demo workspace to this browser.", error);
      setStorageError(
        "This browser could not save the latest changes. Export or remove large receipt attachments and try again.",
      );
    }
  }, [hydrated, members, categories, draftCategories, expenses, audit, proposalRequested]);

  const pickScreen = (item: Screen) => {
    setScreen(item);
    setMobileNav(false);
  };

  const recordAudit = useCallback((action: string, detail: string) => {
    setAudit((events) =>
      [{ id: crypto.randomUUID(), action, detail, createdAt: new Date().toLocaleString("en-IN") }, ...events].slice(
        0,
        100,
      ),
    );
  }, []);

  const askAgent = useCallback(
    async (question = ask) => {
      const text = question.trim();
      if (!text || isThinking) return;
      setMessages((current) => [...current, { role: "user", text }]);
      setAsk("");
      setIsThinking(true);
      try {
        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question: text, members, categories }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "The agent could not complete this request.");
        setMessages((current) => [
          ...current,
          { role: "assistant", text: data.answer, calculations: data.calculations, source: data.source },
        ]);
      } catch (error) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            text: error instanceof Error ? error.message : "Something went wrong. Please try again.",
            source: "Request failed",
          },
        ]);
      } finally {
        setIsThinking(false);
      }
    },
    [ask, categories, isThinking, members],
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    const orderId =
      url.searchParams.get("paypal_order") ??
      (url.searchParams.get("paypal_return") ? url.searchParams.get("token") : null);

    if (url.searchParams.has("paypal_cancelled")) {
      localStorage.removeItem("splitmind-payment-pending");
      setScreen("Payments");
      setPaymentFeedback({
        tone: "warning",
        headline: "PayPal checkout cancelled",
        detail: "No payment was captured. You can try again whenever you're ready.",
      });
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    if (!orderId) return;
    setScreen("Payments");
    setPaymentBusy(true);
    setPaymentFeedback({
      tone: "pending",
      headline: "Verifying approval with PayPal…",
      detail: "Confirming capture status and exact amount/currency on the server.",
    });

    fetch("/api/payments/capture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "PayPal could not verify this order.");
        setPaymentFeedback({
          tone: "success",
          headline: `Verified by PayPal · ${data.status}`,
          detail: "Server-side capture and amount/currency verification succeeded.",
          amount: data.amount,
          currency: data.currency,
          captureId: data.captureId,
        });
        localStorage.removeItem("splitmind-payment-pending");
        recordAudit("PayPal capture verified", `${data.amount} ${data.currency} · ${data.captureId}`);
      })
      .catch((error: unknown) => {
        setPaymentFeedback({
          tone: "error",
          headline: "Payment verification failed",
          detail: error instanceof Error ? error.message : "Payment verification failed.",
        });
      })
      .finally(() => {
        setPaymentBusy(false);
      });

    window.history.replaceState({}, "", window.location.pathname);
  }, [recordAudit]);

  const updateCategory = (id: string, value: number) => {
    setDraftCategories((items) =>
      items.map((item) =>
        item.id === id
          ? { ...item, budget: Number.isFinite(value) ? Math.max(0, Math.min(value, 100_000_000)) : 0 }
          : item,
      ),
    );
    setProposalRequested(false);
  };

  const addMember = (name: string) => {
    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
    const color = AVATAR_PALETTE[members.length % AVATAR_PALETTE.length];
    setMembers((items) => [...items, { id: crypto.randomUUID(), name, initials: initials || "GM", color, paid: 0 }]);
    recordAudit("Member added", `${name} joined the local demo group.`);
    setMemberModal(false);
  };

  const confirmVerifyExpense = (id: string) => {
    const expense = expenses.find((item) => item.id === id);
    if (!expense?.receiptData) return;
    setExpenses((items) => items.map((item) => (item.id === id ? { ...item, verified: true } : item)));
    recordAudit("Receipt reviewed", `${expense.title} · ${money(expense.amount)} · attachment: ${expense.receiptName}`);
    setReviewingExpenseId(null);
  };

  const handleSaveExpense = (expense: Expense) => {
    setExpenses((items) => [expense, ...items]);
    setCategories((items) =>
      items.map((item) => (item.label === expense.category ? { ...item, spent: item.spent + expense.amount } : item)),
    );
    setMembers((items) =>
      items.map((member) =>
        member.name === expense.submittedBy ? { ...member, paid: member.paid + expense.amount } : member,
      ),
    );
    recordAudit("Expense submitted", `${expense.title} · ${money(expense.amount)} · unverified pending receipt review.`);
    setExpenseModal(false);
  };

  const createOrder = async () => {
    if (paymentBusy) return;
    setPaymentBusy(true);
    setPaymentFeedback({
      tone: "pending",
      headline: "Creating PayPal Sandbox order…",
      detail: "Generating idempotency protection and requesting an approval URL from the server.",
    });

    try {
      const saved = localStorage.getItem("splitmind-payment-pending");
      const pending = saved ? (JSON.parse(saved) as { amount?: string; key?: string }) : null;
      const idempotencyKey =
        pending?.amount === paymentAmount && typeof pending.key === "string" ? pending.key : crypto.randomUUID();
      localStorage.setItem("splitmind-payment-pending", JSON.stringify({ amount: paymentAmount, key: idempotencyKey }));

      const response = await fetch("/api/payments/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: paymentAmount, idempotencyKey }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create a PayPal order.");
      window.location.assign(data.approvalUrl);
    } catch (error) {
      setPaymentFeedback({
        tone: "error",
        headline: "Order creation failed",
        detail: error instanceof Error ? error.message : "PayPal order creation failed.",
      });
      setPaymentBusy(false);
    }
  };

  const askFromOverview = (question: string) => {
    if (typeof window !== "undefined" && window.innerWidth <= 1279 && screen !== "AI Financial Agent") {
      setCopilotDrawer(true);
    }
    void askAgent(question);
  };

  const resetChat = () => {
    setMessages([
      {
        role: "assistant",
        text: "Fresh page, same group context. What would you like to figure out?",
        source: "SplitMind deterministic engine",
      },
    ]);
  };

  const resetDemo = () => {
    localStorage.removeItem("splitmind-demo");
    localStorage.removeItem("splitmind-payment-pending");
    window.location.reload();
  };

  return (
    <div className="app-shell">
      {mobileNav && (
        <button
          type="button"
          className="mobile-backdrop"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation"
        />
      )}

      <Sidebar
        screen={screen}
        onSelectScreen={pickScreen}
        memberCount={members.length}
        expenseCount={expenses.length}
        unverifiedCount={unverifiedCount}
        auditCount={audit.length}
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
      />

      <main className="main-area">
        <Topbar
          screen={screen}
          unverifiedCount={unverifiedCount}
          onOpenMobileNav={() => setMobileNav(true)}
          onOpenExpenses={() => pickScreen("Expenses")}
          onOpenCopilot={() => setCopilotDrawer(true)}
          onOpenSettings={() => pickScreen("Settings")}
        />

        <div className="page-content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-dot" /> YOUR GROUP, IN SYNC <span className="eyebrow-divider">/</span> NOV
                14–16, 2026
              </div>
              <h1>
                {screen === "Overview" ? (
                  <>
                    Money stuff, <span>sorted.</span>
                  </>
                ) : (
                  screen
                )}
              </h1>
              <p className="page-subtitle">{SCREEN_COPY[screen].subtitle}</p>
            </div>

            <div className="header-buttons">
              <button type="button" className="button button-outline" onClick={() => setExpenseModal(true)}>
                <Plus size={15} /> Add expense
              </button>
              <button type="button" className="button button-dark" onClick={() => pickScreen("Budget planner")}>
                <Sparkles size={15} /> Plan together
              </button>
            </div>
          </div>

          {screen === "Overview" && (
            <OverviewView
              members={members}
              categories={categories}
              expenses={expenses}
              balances={balances}
              totalBudget={totalBudget}
              totalSpent={totalSpent}
              unverifiedCount={unverifiedCount}
              onSelectScreen={pickScreen}
              onOpenAddMember={() => setMemberModal(true)}
              onReviewExpense={(expense) => setReviewingExpenseId(expense.id)}
              onAskAgent={askFromOverview}
            />
          )}

          {screen === "Groups" && (
            <GroupsView
              balances={balances}
              totalBudget={totalBudget}
              totalSpent={totalSpent}
              onOpenAddMember={() => setMemberModal(true)}
              onSelectScreen={pickScreen}
            />
          )}

          {screen === "Budget planner" && (
            <BudgetPlannerView
              categories={categories}
              draftCategories={draftCategories}
              members={members}
              totalBudget={totalBudget}
              draftTotal={draftTotal}
              proposalRequested={proposalRequested}
              onUpdateCategory={updateCategory}
              onDiscardDraft={() => {
                setDraftCategories(categories);
                setProposalRequested(false);
              }}
              onRequestApproval={() => {
                setProposalRequested(true);
                recordAudit(
                  "Budget proposal created",
                  `${money(draftTotal)} draft · awaits group review; agreed budget remains ${money(totalBudget)}.`,
                );
              }}
              onShareSimulationToAgent={(sim) => {
                setMessages((current) => [
                  ...current,
                  {
                    role: "assistant",
                    text: `Simulation only: with ${sim.activeMembers} people and a ${money(sim.extraCost)} unexpected cost, the suggested share would be ${money(sim.perPerson)} per person. This does not change your agreed budget.`,
                    calculations: [
                      `Current planned total: ${money(totalBudget)}`,
                      `Unexpected cost: ${money(sim.extraCost)}`,
                      `Revised scenario total: ${money(sim.revisedBudget)}`,
                      `People in this scenario: ${sim.activeMembers}`,
                      `New suggested share: ${money(sim.perPerson)}`,
                    ],
                    source: "SplitMind MoneyTwin",
                  },
                ]);
                if (typeof window !== "undefined" && window.innerWidth <= 1279) {
                  setCopilotDrawer(true);
                }
              }}
            />
          )}

          {screen === "Expenses" && (
            <ExpensesView
              expenses={expenses}
              onOpenExpenseModal={() => setExpenseModal(true)}
              onReviewExpense={(expense) => setReviewingExpenseId(expense.id)}
            />
          )}

          {screen === "Settlements" && (
            <SettlementsView
              members={members}
              balances={balances}
              transfers={settlementResult.transfers}
              settlementError={settlementResult.error}
              totalBudget={totalBudget}
              totalSpent={totalSpent}
            />
          )}

          {screen === "Payments" && (
            <PaymentsView
              paymentAmount={paymentAmount}
              paymentBusy={paymentBusy}
              paymentFeedback={paymentFeedback}
              onChangeAmount={setPaymentAmount}
              onCreateOrder={createOrder}
            />
          )}

          {screen === "AI Financial Agent" && (
            <AgentView
              memberCount={members.length}
              messages={messages}
              ask={ask}
              isThinking={isThinking}
              onChangeAsk={setAsk}
              onSubmitQuestion={askAgent}
              onClear={resetChat}
            />
          )}

          {screen === "Activity" && (
            <ActivityView
              audit={audit}
              expenses={expenses}
              onReviewExpense={(expense) => setReviewingExpenseId(expense.id)}
            />
          )}

          {screen === "Settings" && (
            <SettingsView memberCount={members.length} expenseCount={expenses.length} onResetDemo={resetDemo} />
          )}
        </div>

        {storageError && (
          <p className="storage-warning" role="alert">
            {storageError}
          </p>
        )}

        <footer className="page-footer">
          <span>
            Made for the plans you&apos;ll talk about for years. <span>✦</span>
          </span>
          <span>
            <ShieldCheck size={13} /> Your group data stays yours.
          </span>
        </footer>
      </main>

      <AgentRail
        memberCount={members.length}
        messages={messages}
        ask={ask}
        isThinking={isThinking}
        drawerOpen={copilotDrawer}
        onCloseDrawer={() => setCopilotDrawer(false)}
        onChangeAsk={setAsk}
        onSubmitQuestion={askAgent}
        onClear={resetChat}
      />

      {expenseModal && (
        <ExpenseModal
          members={members}
          categories={categories}
          onClose={() => setExpenseModal(false)}
          onSave={handleSaveExpense}
        />
      )}

      {memberModal && (
        <AddMemberModal members={members} onClose={() => setMemberModal(false)} onAdd={addMember} />
      )}

      {reviewingExpense && (
        <ReceiptReviewModal
          expense={reviewingExpense}
          onClose={() => setReviewingExpenseId(null)}
          onConfirmVerify={confirmVerifyExpense}
        />
      )}
    </div>
  );
}
