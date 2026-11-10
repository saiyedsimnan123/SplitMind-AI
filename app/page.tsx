"use client";

import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, Bot, Check,
  ChevronDown, ChevronRight, CircleHelp, Clock3, CreditCard, FileText,
  LayoutDashboard, LockKeyhole, Menu, MessageCircle, MoreHorizontal, Plus,
  ReceiptText, Send, Settings2, ShieldCheck, Sparkles, WalletCards, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { initialCategories, initialExpenses, initialMembers } from "@/lib/demo-data";
import { calculateBalances, formatINR, optimizeSettlements, simulateBudget, type Category, type Expense, type Member } from "@/lib/finance";

type Screen = "Overview" | "Groups" | "Budget planner" | "Expenses" | "Payments" | "Settlements" | "AI Financial Agent" | "Activity" | "Settings";
type Message = { role: "assistant" | "user"; text: string; calculations?: string[]; source?: string };
type AuditEvent = { id: string; action: string; detail: string; createdAt: string };
const navItems: { label: Screen; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Groups", icon: WalletCards },
  { label: "Budget planner", icon: ArrowLeftRight },
  { label: "Expenses", icon: ReceiptText },
  { label: "Payments", icon: CreditCard },
  { label: "Settlements", icon: ArrowDownLeft },
  { label: "AI Financial Agent", icon: Bot },
  { label: "Activity", icon: Clock3 },
  { label: "Settings", icon: Settings2 },
];
const money = (value: number) => formatINR(value);

function Avatar({ member, size = "" }: { member: Pick<Member, "initials" | "color">; size?: string }) {
  return <span className={`avatar ${member.color} ${size}`}>{member.initials}</span>;
}

function ProgressBar({ value, color = "var(--green)" }: { value: number; color?: string }) {
  return <div className="progress-track"><span style={{ width: `${Math.min(100, Math.max(value, 2))}%`, background: color }} /></div>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("Overview");
  const [members, setMembers] = useState(initialMembers);
  const [categories, setCategories] = useState(initialCategories);
  const [draftCategories, setDraftCategories] = useState(initialCategories);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [proposalRequested, setProposalRequested] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Hey Alex! I’ve got the Goa trip numbers. Ask me about your budget, contributions, or what-if scenarios.", source: "SplitMind deterministic engine" },
  ]);
  const [ask, setAsk] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("10.00");
  const [paymentState, setPaymentState] = useState("");
  const [storageError, setStorageError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const totalBudget = categories.reduce((sum, item) => sum + item.budget, 0);
  const draftTotal = draftCategories.reduce((sum, item) => sum + item.budget, 0);
  const totalSpent = categories.reduce((sum, item) => sum + item.spent, 0);
  const balances = useMemo(() => calculateBalances(members, totalSpent), [members, totalSpent]);
  const transfers = useMemo(() => optimizeSettlements(members, totalSpent), [members, totalSpent]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("splitmind-demo");
      if (saved) {
        const data = JSON.parse(saved);
        if (Array.isArray(data.members) && Array.isArray(data.categories) && Array.isArray(data.expenses)) {
          setMembers(data.members); setCategories(data.categories); setDraftCategories(Array.isArray(data.draftCategories) ? data.draftCategories : data.categories); setExpenses(data.expenses);
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
      localStorage.setItem("splitmind-demo", JSON.stringify({ members, categories, draftCategories, expenses, audit, proposalRequested }));
      setStorageError("");
    } catch (error) {
      console.error("Could not save the demo workspace to this browser.", error);
      setStorageError("This browser could not save the latest changes. Export or remove large receipt attachments and try again.");
    }
  }, [hydrated, members, categories, draftCategories, expenses, audit, proposalRequested]);

  const pickScreen = (item: Screen) => { setScreen(item); setMobileNav(false); };
  const recordAudit = useCallback((action: string, detail: string) => {
    setAudit((events) => [{ id: crypto.randomUUID(), action, detail, createdAt: new Date().toLocaleString("en-IN") }, ...events].slice(0, 100));
  }, []);
  const askAgent = useCallback(async (question = ask) => {
    const text = question.trim();
    if (!text || isThinking) return;
    setMessages((current) => [...current, { role: "user", text }]);
    setAsk(""); setIsThinking(true);
    try {
      const response = await fetch("/api/agent", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text, members, categories }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The agent could not complete this request.");
      setMessages((current) => [...current, { role: "assistant", text: data.answer, calculations: data.calculations, source: data.source }]);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", text: error instanceof Error ? error.message : "Something went wrong. Please try again.", source: "Request failed" }]);
    } finally { setIsThinking(false); }
  }, [ask, categories, isThinking, members]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const orderId = url.searchParams.get("paypal_order") ?? (url.searchParams.get("paypal_return") ? url.searchParams.get("token") : null);
    if (url.searchParams.has("paypal_cancelled")) {
      localStorage.removeItem("splitmind-payment-pending");
      setScreen("Payments"); setPaymentState("PayPal checkout was cancelled. No payment was captured.");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (!orderId) return;
    setScreen("Payments"); setPaymentState("Verifying approval with PayPal…");
    fetch("/api/payments/capture", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId }),
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "PayPal could not verify this order.");
      setPaymentState(`Verified by PayPal · ${data.status} · ${data.amount} ${data.currency}`);
      localStorage.removeItem("splitmind-payment-pending");
      recordAudit("PayPal capture verified", `${data.amount} ${data.currency} · ${data.captureId}`);
    }).catch((error: unknown) => setPaymentState(error instanceof Error ? error.message : "Payment verification failed."));
    window.history.replaceState({}, "", window.location.pathname);
  }, [recordAudit]);

  const updateCategory = (id: string, value: number) => {
    setDraftCategories((items) => items.map((item) => item.id === id ? { ...item, budget: Number.isFinite(value) ? Math.max(0, Math.min(value, 100_000_000)) : 0 } : item));
    setProposalRequested(false);
  };
  const addMember = () => {
    if (members.length >= 30) { window.alert("A demo group can have up to 30 members."); return; }
    const name = window.prompt("What is your friend's name?");
    if (!name?.trim()) return;
    if (members.some((member) => member.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase())) { window.alert("That member is already in this group."); return; }
    const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0].toUpperCase()).join("");
    setMembers((items) => [...items, { id: crypto.randomUUID(), name: name.trim(), initials, color: "sky", paid: 0 }]);
    recordAudit("Member added", `${name.trim()} joined the local demo group.`);
  };
  const verifyExpense = (id: string) => {
    const expense = expenses.find((item) => item.id === id);
    if (!expense?.receiptData) { window.alert("A receipt attachment is required before this expense can be verified."); return; }
    if (!window.confirm(`Confirm that you reviewed the attached receipt for “${expense.title}”?`)) return;
    setExpenses((items) => items.map((item) => item.id === id ? { ...item, verified: true } : item));
    recordAudit("Receipt reviewed", `${expense.title} · ${money(expense.amount)} · attachment: ${expense.receiptName}`);
  };
  const createOrder = async () => {
    setPaymentState("Creating a secure PayPal Sandbox order…");
    try {
      const saved = localStorage.getItem("splitmind-payment-pending");
      const pending = saved ? JSON.parse(saved) as { amount?: string; key?: string } : null;
      const idempotencyKey = pending?.amount === paymentAmount && typeof pending.key === "string" ? pending.key : crypto.randomUUID();
      localStorage.setItem("splitmind-payment-pending", JSON.stringify({ amount: paymentAmount, key: idempotencyKey }));
      const response = await fetch("/api/payments/orders", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: paymentAmount, idempotencyKey }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not create a PayPal order.");
      window.location.assign(data.approvalUrl);
    } catch (error) {
      setPaymentState(error instanceof Error ? error.message : "PayPal order creation failed.");
    }
  };

  return (
    <div className="app-shell">
      {mobileNav && <button className="mobile-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); pickScreen("Overview"); }}>
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span className="brand-name">splitmind<span>.</span></span>
        </a>
        <button className="group-switcher" onClick={() => pickScreen("Groups")}>
          <span className="group-icon">G</span><span className="group-text"><strong>Goa Trip 2026</strong><small>8 members · private</small></span><ChevronDown size={15} />
        </button>
        <div className="side-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} onClick={() => pickScreen(label)} className={`nav-item ${screen === label ? "active" : ""}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === "Expenses" && <span className="nav-count">4</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade-card"><span className="upgrade-icon"><Sparkles size={16} /></span><strong>Good money energy.</strong><p>Everyone’s on the same page. Keep it that way.</p><span className="upgrade-link">Made for shared plans <ArrowUpRight size={13} /></span></div>
          <button className="profile-button"><span className="profile-avatar">AK</span><span className="profile-meta"><strong>Alex Kim</strong><small>Personal space</small></span><MoreHorizontal size={19} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button><span className="breadcrumb">Goa Trip 2026</span><ChevronRight size={15} /><strong>{screen}</strong></div>
          <div className="topbar-actions"><span className="sync-status"><span /> All caught up</span><button className="icon-button" aria-label="Notifications"><Bell size={18} /><i /></button><button className="top-avatar">AK</button></div>
        </header>

        <div className="page-content">
          <div className="welcome-row">
            <div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR GROUP, IN SYNC <span className="eyebrow-divider">/</span> NOV 14–16, 2026</div><h1>{screen === "Overview" ? <>Money stuff, <span>sorted.</span></> : screen}</h1><p className="page-subtitle">{screen === "Overview" ? "A little less back-and-forth. A lot more beach." : "One shared view. Everyone knows where things stand."}</p></div>
            <div className="header-buttons"><button className="button button-outline" onClick={() => setExpenseModal(true)}><Plus size={16} /> Add expense</button><button className="button button-dark" onClick={() => pickScreen("Budget planner")}><Sparkles size={15} /> Plan together</button></div>
          </div>

          {(screen === "Overview" || screen === "Groups") && (
            <>
              <section className="stats-grid">
                <article className="stat-card budget-card"><div className="stat-top"><span className="stat-label">GROUP BUDGET</span><span className="stat-icon mint-icon"><WalletCards size={16} /></span></div><div className="stat-number">{money(totalBudget)}</div><div className="stat-foot"><span className="positive">For 8 good friends</span><span>·</span><span>3 days in Goa</span></div><div className="budget-ribbon"><span>PLANNED</span><span>Comfortable, not careless <ArrowUpRight size={13} /></span></div></article>
                <article className="stat-card"><div className="stat-top"><span className="stat-label">SPENT SO FAR</span><span className="stat-icon peach-icon"><ArrowUpRight size={16} /></span></div><div className="stat-number">{money(totalSpent)}</div><div className="stat-foot"><span className="positive">{Math.round(totalSpent / totalBudget * 100)}% of total budget</span><span>·</span><span>{money(totalBudget - totalSpent)} left</span></div><ProgressBar value={totalSpent / totalBudget * 100} /><div className="stat-bottomline"><span>On track for your trip</span><span>{Math.round(totalSpent / totalBudget * 100)}%</span></div></article>
                <article className="stat-card"><div className="stat-top"><span className="stat-label">YOUR CONTRIBUTION</span><span className="stat-icon lilac-icon"><ArrowDownLeft size={16} /></span></div><div className="stat-number">{money(members[0]?.paid ?? 0)}</div><div className="stat-foot"><span>Of {money(totalBudget / members.length)} suggested</span></div><div className="paid-note"><span className="paid-check"><Check size={12} /></span> You’re all settled up <span className="paid-spark">✳</span></div></article>
                <article className="stat-card"><div className="stat-top"><span className="stat-label">GROUP STATUS</span><span className="stat-icon blue-icon"><ShieldCheck size={16} /></span></div><div className="status-heading">Looking good <span className="status-emoji">✦</span></div><div className="stat-foot">The numbers are on your side.</div><div className="status-bottom"><div className="avatar-stack">{members.slice(0, 5).map((member) => <Avatar key={member.id} member={member} />)}<span className="stack-more">+{Math.max(members.length - 5, 0)}</span></div><button onClick={addMember}>Manage <ArrowUpRight size={13} /></button></div></article>
              </section>

              <div className="main-grid">
                <section className="panel budget-panel">
                  <div className="panel-heading"><div><div className="section-kicker">THE PLAN</div><h2>Budget breakdown</h2></div><button className="text-button" onClick={() => pickScreen("Budget planner")}>Edit plan <ArrowUpRight size={14} /></button></div>
                  <div className="budget-chart-row"><div className="donut-wrap"><div className="donut" style={{ background: `conic-gradient(${categories.map((category, index) => `${category.color} ${categories.slice(0, index).reduce((sum, current) => sum + current.budget, 0) / totalBudget * 100}% ${(categories.slice(0, index + 1).reduce((sum, current) => sum + current.budget, 0) / totalBudget * 100)}%`).join(", ")})` }}><div className="donut-center"><small>OF YOUR</small><strong>{money(totalBudget)}</strong><small>BUDGET</small></div></div></div><div className="legend-list">{categories.map((category) => <div className="legend-row" key={category.id}><span className="legend-dot" style={{ background: category.color }} /><span className="legend-name">{category.label}</span><strong>{money(category.budget)}</strong></div>)}</div></div>
                  <div className="budget-footer"><div><span className="footer-mark">✦</span><span>Built for real plans, with a little breathing room.</span></div><button onClick={() => { pickScreen("Budget planner"); }}>Adjust budget <ChevronRight size={14} /></button></div>
                </section>

                <section className="panel activity-panel">
                  <div className="panel-heading"><div><div className="section-kicker">JUST THE LATEST</div><h2>Recent activity</h2></div><button className="more-button" onClick={() => pickScreen("Activity")} aria-label="View all activity"><MoreHorizontal size={19} /></button></div>
                  <div className="activity-list">{expenses.slice(0, 4).map((expense) => <div className="activity-row" key={expense.id}><span className={`activity-icon ${expense.verified ? "activity-verified" : "activity-pending"}`}>{expense.verified ? <ReceiptText size={16} /> : <Clock3 size={16} />}</span><span className="activity-copy"><strong>{expense.title}</strong><small>{expense.submittedBy} · {expense.createdAt}</small></span><span className="activity-amount">{money(expense.amount)}<small>{expense.verified ? "Verified" : "Needs a look"}</small></span></div>)}</div>
                  <button className="panel-footer-link" onClick={() => pickScreen("Expenses")}>See all expenses <ArrowUpRight size={14} /></button>
                </section>
              </div>

              <div className="bottom-grid">
                <section className="panel people-panel"><div className="panel-heading"><div><div className="section-kicker">NO AWKWARD REMINDERS</div><h2>Everyone’s in the loop</h2></div><button className="text-button" onClick={() => pickScreen("Settlements")}>See balances <ArrowUpRight size={14} /></button></div><div className="people-list">{balances.slice(0, 4).map((member) => <div className="person-row" key={member.id}><Avatar member={member} /><span className="person-name">{member.name}</span><span className="person-paid">{money(member.paid)}<small>contributed</small></span><span className={`person-status ${member.outstanding < 1 ? "status-done" : ""}`}>{member.outstanding < 1 ? "All set" : `${money(member.outstanding)} to go`}</span></div>)}</div></section>
                <section className="agent-card"><div className="agent-topline"><span className="agent-spark"><Sparkles size={16} /></span><span>YOUR MONEY SIDEKICK</span><span className="agent-online"><i /> HERE FOR YOU</span></div><h2>Big question?<br /><em>Small group chat.</em></h2><p>Ask what happens if plans change. Get answers from your actual numbers.</p><div className="suggestions"><button onClick={() => { setScreen("Overview"); setTimeout(() => askAgent("What happens if one member cancels?"), 0); }}>What if someone cancels? <ArrowUpRight size={13} /></button><button onClick={() => { setScreen("Overview"); setTimeout(() => askAgent("Who has not contributed yet?"), 0); }}>Who hasn’t pitched in yet? <ArrowUpRight size={13} /></button></div><button className="agent-ask-button" onClick={() => pickScreen("Budget planner")}><MessageCircle size={15} /> Ask your group’s AI <ArrowUpRight size={13} /></button></section>
              </div>
            </>
          )}

          {screen === "Budget planner" && (
            <div className="workspace-grid">
              <section className="panel planner-panel"><div className="panel-heading"><div><div className="section-kicker">YOUR SHARED PLAN</div><h2>Give every rupee a reason.</h2></div><span className="save-badge"><span /> Draft saves on this device</span></div><p className="muted-copy">Adjust a draft and see contributions update here. Your current group budget stays unchanged until the group reviews the proposal.</p>{draftCategories.map((category) => <label className="budget-edit-row" key={category.id}><span className="legend-dot" style={{ background: category.color }} /><span className="budget-edit-label">{category.label}<small>{money(category.spent)} spent so far</small></span><span className="currency-input"><span>₹</span><input aria-label={`${category.label} budget proposal`} inputMode="numeric" type="number" min="0" value={category.budget} onChange={(event) => updateCategory(category.id, Number(event.target.value))} /></span><span className="category-progress"><ProgressBar value={category.spent / Math.max(category.budget, 1) * 100} color={category.color} /><small>{Math.round(category.spent / Math.max(category.budget, 1) * 100)}%</small></span></label>)}<div className="planner-total"><div><small>DRAFT TOTAL · {members.length} FRIENDS</small><strong>{money(draftTotal)}</strong></div><div className="per-person">{money(draftTotal / members.length)} <small>suggested per person</small></div></div><div className="proposal-actions"><button className="button button-outline" onClick={() => { setDraftCategories(categories); setProposalRequested(false); }}>Discard draft</button><button className="button button-dark" onClick={() => { setProposalRequested(true); recordAudit("Budget proposal created", `${money(draftTotal)} draft · awaits group review; agreed budget remains ${money(totalBudget)}.`); }}>Request group approval <ArrowUpRight size={14} /></button></div>{proposalRequested && <div className="proposal-status" role="status"><Clock3 size={14} /><span><strong>Proposal saved for group review.</strong><br />The agreed budget remains {money(totalBudget)}. Group approval is not simulated in this local demo.</span></div>}</section>
              <aside className="panel planner-aside"><div className="section-kicker">YOUR MONEY TWIN</div><h2>Plans change.<br /><span>Your math doesn’t have to.</span></h2><p>Try a what-if without changing anyone’s agreed plan.</p><label className="form-label">Unexpected expense<input id="extra-cost" type="number" min="0" defaultValue="3000" /></label><label className="form-label">Member who might cancel<select id="cancel-member" defaultValue=""><option value="">No one — keep all 8</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></label><button className="button button-dark full-button" onClick={() => { const extra = Number((document.getElementById("extra-cost") as HTMLInputElement).value); const cancelled = (document.getElementById("cancel-member") as HTMLSelectElement).value; const result = simulateBudget(categories, members, extra, cancelled || undefined); setMessages((current) => [...current, { role: "assistant", text: `Simulation only: with ${result.activeMembers} people and a ${money(extra)} unexpected cost, the suggested share would be ${money(result.perPerson)} per person. This does not change your agreed budget.`, calculations: [`Current planned total: ${money(totalBudget)}`, `Unexpected cost: ${money(extra)}`, `People in this scenario: ${result.activeMembers}`, `New suggested share: ${money(result.perPerson)}`], source: "SplitMind MoneyTwin" }]); setScreen("Overview"); }}>Run the what-if <ArrowUpRight size={14} /></button><div className="safety-note"><LockKeyhole size={14} /><span>Simulations never alter your group’s agreed plan.</span></div></aside>
            </div>
          )}

          {screen === "Expenses" && <section className="panel full-panel"><div className="panel-heading"><div><div className="section-kicker">SHARED, NOT FUZZY</div><h2>Expense ledger</h2></div><button className="button button-dark" onClick={() => setExpenseModal(true)}><Plus size={15} /> Add expense</button></div><p className="muted-copy">Submitted receipts are unverified until someone opens the evidence and confirms their review.</p><ExpenseTable expenses={expenses} onVerify={verifyExpense} /></section>}

          {screen === "Settlements" && <div className="workspace-grid"><section className="panel full-panel"><div className="panel-heading"><div><div className="section-kicker">FEWEST TRANSFERS, CLEAR MATH</div><h2>A fair way to settle up.</h2></div><span className="save-badge"><ShieldCheck size={14} /> Suggested, not sent</span></div><p className="muted-copy">Calculated from verified and submitted spend to date. No payment is initiated here.</p><div className="settlement-list">{transfers.map((transfer, index) => <div className="settlement-row" key={`${transfer.from}-${transfer.to}-${index}`}><Avatar member={members.find((member) => member.name === transfer.from) ?? members[0]} /><strong>{transfer.from}</strong><span>pays</span><ArrowUpRight size={15} className="settlement-arrow" /><Avatar member={members.find((member) => member.name === transfer.to) ?? members[0]} /><strong>{transfer.to}</strong><b>{money(transfer.amount)}</b></div>)}</div><div className="safety-note"><LockKeyhole size={14} /><span>SplitMind never holds money or sends transfers without authorization.</span></div></section><section className="panel"><div className="section-kicker">AT A GLANCE</div><h2>Group balance</h2><div className="balance-summary"><strong>{money(totalSpent)}</strong><small>total submitted spend</small><strong>{money(totalBudget - totalSpent)}</strong><small>budget remaining</small><strong>{transfers.length} transfers</strong><small>suggested to settle all balances</small></div></section></div>}

          {screen === "Payments" && <div className="workspace-grid"><section className="panel payment-panel"><div className="section-kicker">PAYPAL SANDBOX</div><h2>Payments, with a paper trail.</h2><p className="muted-copy">Create a PayPal Sandbox order. PayPal holds and transfers funds directly between accounts—SplitMind is not a wallet, escrow service, or custodian.</p><label className="form-label">Sandbox payment amount (USD)<input value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} inputMode="decimal" placeholder="10.00" /></label><button className="button button-dark" onClick={createOrder}><CreditCard size={15} /> Continue to PayPal Sandbox <ArrowUpRight size={14} /></button>{paymentState && <div className="payment-status" role="status">{paymentState}</div>}<div className="safety-note"><LockKeyhole size={14} /><span>PayPal orders are only marked paid after server-side capture and verification.</span></div></section><section className="panel"><div className="section-kicker">BEFORE YOU START</div><h2>What happens next?</h2><div className="steps-list"><div><span>01</span><p><strong>We create an order.</strong><br />Your browser never sees your PayPal secret.</p></div><div><span>02</span><p><strong>You approve at PayPal.</strong><br />Sandbox approval uses test buyer accounts.</p></div><div><span>03</span><p><strong>Our server verifies capture.</strong><br />A return redirect alone is not proof of payment.</p></div></div><a className="inline-link" href="https://developer.paypal.com/tools/sandbox/" target="_blank" rel="noreferrer">PayPal Sandbox setup <ArrowUpRight size={13} /></a></section></div>}

          {screen === "AI Financial Agent" && <section className="panel agent-page"><div className="section-kicker">YOUR GROUP CONTEXT · GOA TRIP 2026</div><h2>Ask your group’s money mind.</h2><p className="muted-copy">Answers come from your current group numbers. Try a cancellation, an unexpected cost, or a contribution question.</p><div className="agent-page-prompts"><button onClick={() => askAgent("Plan a three-day Goa trip for eight friends under ₹40,000.")}>Plan a three-day Goa trip for eight friends under ₹40,000</button><button onClick={() => askAgent("What happens if one member cancels?")}>What happens if someone cancels?</button><button onClick={() => askAgent("We have an unexpected hotel expense of ₹3,000. Recalculate our budget.")}>What if the hotel costs ₹3,000 more?</button><button onClick={() => askAgent("Who has not contributed yet?")}>Who has not contributed yet?</button></div><div className="agent-page-messages">{messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><span className="message-avatar">{message.role === "assistant" ? <Sparkles size={14} /> : "AK"}</span><div className="message-body"><div className="message-text">{message.text}</div>{message.calculations && <div className="calculation-card"><div className="calc-head"><FileText size={13} /> THE MATH</div>{message.calculations.map((line) => <div key={line}>{line}</div>)}</div>}<small className="message-source">{message.source}</small></div></div>)}{isThinking && <div className="agent-page-status">Calculating from your group’s numbers…</div>}</div><form className="agent-page-composer" onSubmit={(event) => { event.preventDefault(); askAgent(); }}><input aria-label="Ask the group financial agent" placeholder="Ask a question about this group…" value={ask} onChange={(event) => setAsk(event.target.value)} /><button className="button button-dark" type="submit" disabled={!ask.trim() || isThinking}><Send size={14} /> Ask</button></form><div className="safety-note"><LockKeyhole size={14} /><span>Nothing changes without your say-so. Financial answers use the deterministic SplitMind calculation functions.</span></div></section>}

          {screen === "Activity" && <section className="panel full-panel"><div className="section-kicker">THE PAPER TRAIL</div><h2>Activity & audit history</h2><p className="muted-copy">Recent local demo actions. PayPal status is independently verified and persisted in Supabase when configured.</p>{audit.length ? <div className="audit-list">{audit.map((event) => <div className="audit-row" key={event.id}><span className="activity-icon activity-verified"><Clock3 size={15} /></span><span><strong>{event.action}</strong><small>{event.detail}</small></span><time>{event.createdAt}</time></div>)}</div> : <div className="empty-state"><FileText size={21} /><strong>No changes yet.</strong><span>Expense submissions, receipt reviews, and budget proposals will be recorded here.</span></div>}<h2 className="ledger-heading">Expense ledger</h2><ExpenseTable expenses={expenses} onVerify={verifyExpense} /></section>}

          {screen === "Settings" && <section className="panel settings-panel"><div className="section-kicker">YOUR SPACE</div><h2>Settings</h2><div className="settings-row"><div><strong>Group name</strong><small>Shown to everyone in the group</small></div><input value="Goa Trip 2026" readOnly /></div><div className="settings-row"><div><strong>Local demo data</strong><small>Stored in this browser, not shared with other members</small></div><button className="button button-outline" onClick={() => { localStorage.removeItem("splitmind-demo"); window.location.reload(); }}>Reset demo</button></div><div className="safety-note"><ShieldCheck size={14} /><span>Do not enter real payment credentials into the demo workspace.</span></div></section>}
        </div>

        {storageError && <p className="storage-warning" role="alert">{storageError}</p>}
        <footer className="page-footer"><span>Made for the plans you’ll talk about for years. <span>✦</span></span><span><ShieldCheck size={13} /> Your group data stays yours.</span></footer>
      </main>

      <aside className="agent-rail">
        <div className="rail-head"><div className="rail-title"><span className="rail-mark"><Bot size={17} /></span><div><strong>Group money mind</strong><small><i /> READY WHEN YOU ARE</small></div></div><button className="more-button" onClick={() => setMessages([{ role: "assistant", text: "Fresh page, same group context. What would you like to figure out?", source: "SplitMind deterministic engine" }])} aria-label="Clear conversation"><MoreHorizontal size={19} /></button></div>
        <div className="context-chip"><span>✦</span> Goa Trip 2026 <span className="context-divider" /> {members.length} friends</div>
        <div className="chat-log">{messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><span className="message-avatar">{message.role === "assistant" ? <Sparkles size={14} /> : "AK"}</span><div className="message-body"><div className="message-text">{message.text}</div>{message.calculations && <div className="calculation-card"><div className="calc-head"><FileText size={13} /> THE MATH</div>{message.calculations.map((line) => <div key={line}>{line}</div>)}</div>}{message.source && <small className="message-source">{message.source}</small>}</div></div>)}{isThinking && <div className="message assistant"><span className="message-avatar"><Sparkles size={14} /></span><div className="thinking"><i /><i /><i /></div></div>}</div>
        <div className="chat-suggestions"><span>TRY ASKING</span><button onClick={() => askAgent("Who hasn't contributed yet?")}>Who hasn’t contributed yet? <ArrowUpRight size={12} /></button><button onClick={() => askAgent("What happens if one member cancels?")}>What if one person cancels? <ArrowUpRight size={12} /></button></div>
        <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); askAgent(); }}><input aria-label="Ask your group money mind" placeholder="Ask about your group..." value={ask} onChange={(event) => setAsk(event.target.value)} /><button type="submit" disabled={!ask.trim() || isThinking} aria-label="Send message"><Send size={16} /></button></form>
        <div className="agent-disclaimer"><CircleHelp size={12} /> AI explanations use your group’s numbers. Nothing changes without your say-so.</div>
      </aside>

      {expenseModal && <ExpenseModal members={members} categories={categories} onClose={() => setExpenseModal(false)} onSave={(expense) => { setExpenses((items) => [expense, ...items]); setCategories((items) => items.map((item) => item.label === expense.category ? { ...item, spent: item.spent + expense.amount } : item)); setMembers((items) => items.map((member) => member.name === expense.submittedBy ? { ...member, paid: member.paid + expense.amount } : member)); recordAudit("Expense submitted", `${expense.title} · ${money(expense.amount)} · unverified pending receipt review.`); setExpenseModal(false); }} />}
    </div>
  );
}

function ExpenseTable({ expenses, onVerify }: { expenses: Expense[]; onVerify?: (id: string) => void }) {
  return <div className="expense-table"><div className="table-heading"><span>EXPENSE</span><span>CATEGORY</span><span>SUBMITTED BY</span><span>STATUS / RECEIPT</span><span>AMOUNT</span></div>{expenses.map((expense) => <div className="table-row" key={expense.id}><span className="table-expense"><span className="table-receipt"><ReceiptText size={16} /></span><span><strong>{expense.title}</strong><small>{expense.createdAt}</small></span></span><span>{expense.category}</span><span>{expense.submittedBy}</span><span className="expense-evidence"><span><i className={`status-dot ${expense.verified ? "green-dot" : "yellow-dot"}`} />{expense.verified ? "Verified" : "Unverified"}</span>{expense.receiptData ? <a href={expense.receiptData} target="_blank" rel="noreferrer">{expense.receiptName ?? "View receipt"}</a> : <small>No receipt attached</small>}{!expense.verified && onVerify && <button className="verify-button" disabled={!expense.receiptData} onClick={() => onVerify(expense.id)} title={expense.receiptData ? "Review the receipt and verify this entry" : "Attach a receipt before verification"}>Review & verify</button>}</span><strong>{money(expense.amount)}</strong></div>)}</div>;
}

function ExpenseModal({ members, categories, onClose, onSave }: { members: Member[]; categories: Category[]; onClose: () => void; onSave: (expense: Expense) => void }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0]?.label ?? "Other");
  const [submitter, setSubmitter] = useState(members[0]?.name ?? "You");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState("");
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!title.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 10000000) {
      setError("Enter a description and a valid amount between ₹1 and ₹1,00,00,000."); return;
    }
    let receiptData: string | undefined;
    if (receipt) {
      try {
        receiptData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Receipt could not be read."));
          reader.onerror = () => reject(new Error("Receipt could not be read."));
          reader.readAsDataURL(receipt);
        });
      } catch (readError) {
        setError(readError instanceof Error ? readError.message : "Receipt could not be read.");
        return;
      }
    }
    onSave({ id: crypto.randomUUID(), title: title.trim(), category, amount: parsedAmount, submittedBy: submitter, verified: false, createdAt: "Just now", receiptName: receipt?.name, receiptData });
  };
  return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><div className="section-kicker">ADD TO THE LEDGER</div><h2 id="modal-title">Log an expense</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div><p className="muted-copy">New submissions are unverified until someone reviews the attached receipt.</p><form onSubmit={save}><label className="form-label">What was it for?<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Sunday brunch" /></label><label className="form-label">Amount in rupees<input inputMode="decimal" type="number" min="1" max="10000000" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></label><label className="form-label">Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item.id}>{item.label}</option>)}</select></label><label className="form-label">Paid by<select value={submitter} onChange={(event) => setSubmitter(event.target.value)}>{members.map((member) => <option key={member.id}>{member.name}</option>)}</select></label><label className="form-label">Receipt evidence <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => { const file = event.target.files?.[0] ?? null; if (!file) { setReceipt(null); return; }   if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type) || file.size > 250_000) { setReceipt(null); event.target.value = ""; setError("Attach a JPEG, PNG, WebP, or PDF receipt smaller than 250 KB."); return; } setReceipt(file); setError(""); }} /><small>{receipt ? `${receipt.name} · ${Math.ceil(receipt.size / 1024)} KB` : "Optional · PDF or image · max 500 KB"}</small></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-dark full-button" type="submit"><Plus size={15} /> Add unverified expense</button></form></section></div>;
}
