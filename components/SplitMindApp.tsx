"use client";

import {
  ArchiveRestore,
  CheckCircle2,
  FolderPlus,
  LogOut,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildAuditEvent } from "@/lib/audit";
import { createInitialGoaGroup } from "@/lib/demo-data";
import {
  addGroupBudgetCategory,
  addGroupExpense,
  addGroupMember,
  applyGroupBudgetDraft,
  archiveGroupRecord,
  createGroupRecord,
  deleteGroupExpense,
  getGroupSummary,
  recordGroupSettlement,
  removeGroupMember,
  restoreGroupRecord,
  transferGroupOwnership,
  updateGroupExpense,
  updateGroupMember,
  updateGroupRecord,
  verifyGroupExpense,
} from "@/lib/groups";
import type {
  AuditEvent,
  AuthUser,
  ChatMessage,
  CurrencyCode,
  GroupExpense,
  GroupMember,
  GroupRecord,
  GroupRole,
  PaymentFeedback,
  PlanType,
  Screen,
  SessionSummary,
  SettingsTab,
  SettlementTransfer,
} from "@/lib/types";
import { AgentRail } from "@/components/AgentRail";
import {
  ConfirmDialog,
  ContributionModal,
  ExpenseModal,
  GroupModal,
  MemberModal,
  ReceiptReviewModal,
} from "@/components/Modals";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { formatGroupDates, money, planTypeLabel } from "@/components/ui";
import { ActivityView } from "@/components/views/ActivityView";
import { AgentView } from "@/components/views/AgentView";
import { BudgetPlannerView } from "@/components/views/BudgetPlannerView";
import { ExpensesView } from "@/components/views/ExpensesView";
import { GroupsView } from "@/components/views/GroupsView";
import { OverviewView } from "@/components/views/OverviewView";
import { PaymentsView } from "@/components/views/PaymentsView";
import { SettingsView } from "@/components/views/SettingsView";
import { SettlementsView } from "@/components/views/SettlementsView";

const WORKSPACE_STORAGE_KEY = "splitmind-workspace-v2";
const LEGACY_STORAGE_KEY = "splitmind-demo";

const SCREEN_COPY: Record<Screen, { title: string; subtitle: string }> = {
  Overview: {
    title: "Financial overview",
    subtitle: "Real-time shared budget health, Proof Engine status, and SmartSplit member positions.",
  },
  Groups: {
    title: "Groups & Members",
    subtitle: "Create isolated workspaces, switch active plans, manage rosters, and track contributions.",
  },
  "Budget planner": {
    title: "Budget & MoneyTwin",
    subtitle: "Adjust category allocations, update group caps, and stress-test scenarios non-destructively.",
  },
  Expenses: {
    title: "Expenses & Proof Engine",
    subtitle: "Every submission stays unverified until a member reviews the attached receipt.",
  },
  Payments: {
    title: "IntentPay Checkout",
    subtitle: "Idempotent USD Sandbox checkout with server-side PayPal capture verification.",
  },
  Settlements: {
    title: "Settlement Intelligence",
    subtitle: "Minimum-transfer settlement suggestions and recorded reimbursement history.",
  },
  "AI Financial Agent": {
    title: "AI Group Financial Agent",
    subtitle: "Conversational insights grounded in deterministic SplitMind financial math.",
  },
  Activity: {
    title: "Group Activity",
    subtitle: "Group paper trail alongside your complete expense ledger.",
  },
  Settings: {
    title: "Account Settings",
    subtitle: "Manage profile preferences, credentials, active sessions, and security audit trails.",
  },
};

type PendingConfirm =
  | { kind: "delete_expense"; expense: GroupExpense }
  | { kind: "remove_member"; member: GroupMember }
  | { kind: "transfer_owner"; member: GroupMember }
  | { kind: "archive_group"; group: GroupRecord }
  | { kind: "apply_budget" }
  | { kind: "record_settlement"; transfer: SettlementTransfer }
  | { kind: "revoke_others" }
  | { kind: "revoke_global" }
  | { kind: "reset_demo" };

function defaultChatForGroup(group: GroupRecord, user?: AuthUser | null): ChatMessage[] {
  const firstName = user?.fullName?.split(" ")[0] || "there";
  return [
    {
      role: "assistant",
      text: `Hey ${firstName}! I’ve got the ${group.name} (${group.currency}) numbers loaded. Ask about budgets, contributions, or what-if scenarios.`,
      source: "SplitMind deterministic engine",
    },
  ];
}

export function SplitMindApp({
  authConfigured,
  initialUser,
  initialSession,
  initialGroups,
  initialAuditEvents,
  initialDbError,
}: {
  authConfigured: boolean;
  initialUser: AuthUser | null;
  initialSession: SessionSummary;
  initialGroups: GroupRecord[];
  initialAuditEvents: AuditEvent[];
  initialDbError?: string;
}) {
  const [screen, setScreen] = useState<Screen>("Overview");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("account");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(initialUser);
  const isDemo = Boolean(initialSession.isDemo || currentUser?.isDemo);
  const [groups, setGroups] = useState<GroupRecord[]>(
    initialGroups.length ? initialGroups : [createInitialGoaGroup()],
  );
  const [activeGroupId, setActiveGroupId] = useState<string>(
    (initialGroups.find((g) => !g.archivedAt) ?? initialGroups[0])?.id ?? "goa-trip-2026",
  );
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(initialAuditEvents);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(initialDbError ?? "");

  const [chatByGroup, setChatByGroup] = useState<Record<string, ChatMessage[]>>({});
  const [ask, setAsk] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const [groupModal, setGroupModal] = useState<{ mode: "create" | "edit"; group?: GroupRecord } | null>(null);
  const [expenseModal, setExpenseModal] = useState<{ open: boolean; editing?: GroupExpense | null }>({
    open: false,
  });
  const [memberModal, setMemberModal] = useState<{ mode: "add" | "edit"; member?: GroupMember | null } | null>(
    null,
  );
  const [contributionModal, setContributionModal] = useState(false);
  const [reviewingExpenseId, setReviewingExpenseId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const [actionBusy, setActionBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string } | null>(
    initialDbError ? { tone: "error", text: initialDbError } : null,
  );

  const [paymentAmount, setPaymentAmount] = useState("10.00");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentFeedback, setPaymentFeedback] = useState<PaymentFeedback>({
    tone: "idle",
    headline: "",
  });

  const [storageError, setStorageError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [copilotDrawer, setCopilotDrawer] = useState(false);
  const [hydrated, setHydrated] = useState(authConfigured);

  const activeGroup = useMemo(
    () =>
      groups.find((g) => g.id === activeGroupId) ??
      groups.find((g) => !g.archivedAt) ??
      groups[0],
    [groups, activeGroupId],
  );

  const summary = useMemo(() => getGroupSummary(activeGroup), [activeGroup]);
  const messages = useMemo(
    () => chatByGroup[activeGroup.id] ?? defaultChatForGroup(activeGroup, currentUser),
    [chatByGroup, activeGroup, currentUser],
  );

  const reviewingExpense = useMemo(
    () => activeGroup.expenses.find((item) => item.id === reviewingExpenseId) ?? null,
    [activeGroup.expenses, reviewingExpenseId],
  );

  const pushLocalAudit = useCallback(
    (input: Parameters<typeof buildAuditEvent>[0]) => {
      if (authConfigured) return;
      const event = buildAuditEvent(input);
      setAuditEvents((prev) => [event, ...prev].slice(0, 200));
    },
    [authConfigured],
  );

  const refreshServerAudit = useCallback(async () => {
    if (!authConfigured) return;
    setAuditLoading(true);
    setAuditError("");
    try {
      const response = await fetch("/api/security/events", { cache: "no-store" });
      const data = (await response.json()) as { events?: AuditEvent[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load audit trail.");
      setAuditEvents(data.events ?? []);
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : "Could not load audit trail.");
    } finally {
      setAuditLoading(false);
    }
  }, [authConfigured]);

  const replaceGroupInState = useCallback((updated: GroupRecord) => {
    setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  }, []);

  // Local preview hydration (only when Supabase Auth is NOT configured)
  useEffect(() => {
    if (authConfigured) return;
    try {
      const savedWorkspace = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (savedWorkspace) {
        const parsed = JSON.parse(savedWorkspace) as {
          groups?: GroupRecord[];
          activeGroupId?: string;
          auditEvents?: AuditEvent[];
        };
        if (Array.isArray(parsed.groups) && parsed.groups.length > 0) {
          setGroups(parsed.groups);
          if (parsed.activeGroupId) setActiveGroupId(parsed.activeGroupId);
          if (Array.isArray(parsed.auditEvents)) setAuditEvents(parsed.auditEvents);
          setHydrated(true);
          return;
        }
      }

      // Migrate legacy Goa Trip local demo state seamlessly if present
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const legacyData = JSON.parse(legacy);
        const goa = createInitialGoaGroup();
        if (Array.isArray(legacyData.members)) {
          goa.members = legacyData.members.map((m: GroupMember, idx: number) => ({
            ...m,
            role: idx === 0 ? "owner" : "member",
          }));
        }
        if (Array.isArray(legacyData.categories)) goa.categories = legacyData.categories;
        if (Array.isArray(legacyData.draftCategories)) goa.draftCategories = legacyData.draftCategories;
        if (Array.isArray(legacyData.expenses)) goa.expenses = legacyData.expenses;
        goa.proposalRequested = legacyData.proposalRequested === true;
        goa.totalBudget = goa.categories.reduce((sum, c) => sum + c.budget, 0);
        setGroups([goa]);
        setActiveGroupId(goa.id);
      }
    } catch (error) {
      console.error("Could not restore local workspace.", error);
    }
    setHydrated(true);
  }, [authConfigured]);

  // Local preview persistence (only when Supabase Auth is NOT configured)
  useEffect(() => {
    if (authConfigured || !hydrated) return;
    try {
      localStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        JSON.stringify({ groups, activeGroupId, auditEvents }),
      );
      setStorageError("");
    } catch (error) {
      console.error("Could not save local workspace.", error);
      setStorageError(
        "This browser could not save the latest changes. Remove large receipt attachments and try again.",
      );
    }
  }, [authConfigured, hydrated, groups, activeGroupId, auditEvents]);

  // Handle PayPal Sandbox return redirect
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
        if (authConfigured) {
          void refreshServerAudit();
        } else {
          pushLocalAudit({
            category: "financial",
            eventType: "payment.captured",
            eventName: "PayPal capture verified",
            status: "success",
            actorLabel: "Local preview user",
            groupId: activeGroup.id,
            groupName: activeGroup.name,
            description: `Verified ${data.amount} ${data.currency} capture (${data.captureId}).`,
          });
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickScreen = (item: Screen) => {
    setScreen(item);
    if (item === "Settings") setSettingsTab("account");
    setMobileNav(false);
  };

  const openSecuritySettings = () => {
    setScreen("Settings");
    setSettingsTab("security");
    setMobileNav(false);
    if (authConfigured) {
      void refreshServerAudit();
    }
  };

  const selectGroup = (groupId: string) => {
    setActiveGroupId(groupId);
    setReviewingExpenseId(null);
    setBanner(null);
  };

  const showToast = (tone: "success" | "error", text: string) => {
    setBanner({ tone, text });
  };

  const askAgent = useCallback(
    async (question = ask) => {
      const text = question.trim();
      if (!text || isThinking) return;
      const targetGroup = activeGroup;

      setChatByGroup((prev) => ({
        ...prev,
        [targetGroup.id]: [
          ...(prev[targetGroup.id] ?? defaultChatForGroup(targetGroup, currentUser)),
          { role: "user", text },
        ],
      }));
      setAsk("");
      setIsThinking(true);
      try {
        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question: text,
            members: targetGroup.members,
            categories: targetGroup.categories,
            currency: targetGroup.currency,
            groupName: targetGroup.name,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "The agent could not complete this request.");
        setChatByGroup((prev) => ({
          ...prev,
          [targetGroup.id]: [
            ...(prev[targetGroup.id] ?? defaultChatForGroup(targetGroup, currentUser)),
            { role: "assistant", text: data.answer, calculations: data.calculations, source: data.source },
          ],
        }));
      } catch (error) {
        setChatByGroup((prev) => ({
          ...prev,
          [targetGroup.id]: [
            ...(prev[targetGroup.id] ?? defaultChatForGroup(targetGroup, currentUser)),
            {
              role: "assistant",
              text: error instanceof Error ? error.message : "Something went wrong. Please try again.",
              source: "Request failed",
            },
          ],
        }));
      } finally {
        setIsThinking(false);
      }
    },
    [ask, isThinking, activeGroup, currentUser],
  );

  // Group CRUD handlers
  const handleSubmitGroupModal = async (values: {
    name: string;
    planType: PlanType;
    description: string;
    currency: CurrencyCode;
    totalBudget: number;
    startDate: string;
    endDate: string | null;
  }) => {
    setModalError("");
    setActionBusy(true);
    try {
      if (groupModal?.mode === "edit" && groupModal.group) {
        const target = groupModal.group;
        if (authConfigured) {
          const response = await fetch(`/api/groups/${encodeURIComponent(target.id)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "update_details", ...values }),
          });
          const data = (await response.json()) as { group?: GroupRecord; error?: string };
          if (!response.ok || !data.group) throw new Error(data.error ?? "Could not update group.");
          replaceGroupInState(data.group);
          await refreshServerAudit();
        } else {
          const updated = updateGroupRecord(target, values);
          replaceGroupInState(updated);
          pushLocalAudit({
            category: "group",
            eventType: "group.updated",
            eventName: "Group details updated",
            status: "success",
            actorLabel: currentUser?.fullName ?? "Local preview user",
            groupId: updated.id,
            groupName: updated.name,
            description: `Updated "${updated.name}" (${updated.currency}, ${money(updated.totalBudget, updated.currency)}).`,
          });
        }
        showToast("success", `Updated "${values.name}".`);
        setGroupModal(null);
      } else {
        if (authConfigured) {
          const response = await fetch("/api/groups", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(values),
          });
          const data = (await response.json()) as { group?: GroupRecord; error?: string };
          if (!response.ok || !data.group) throw new Error(data.error ?? "Could not create group.");
          setGroups((prev) => [...prev, data.group!]);
          setActiveGroupId(data.group.id);
          await refreshServerAudit();
        } else {
          const created = createGroupRecord({
            ...values,
            ownerName: currentUser?.fullName ?? "You",
            ownerEmail: currentUser?.email,
          });
          setGroups((prev) => [...prev, created]);
          setActiveGroupId(created.id);
          pushLocalAudit({
            category: "group",
            eventType: "group.created",
            eventName: "Group created",
            status: "success",
            actorLabel: currentUser?.fullName ?? "Local preview user",
            groupId: created.id,
            groupName: created.name,
            description: `Created ${created.planType} group "${created.name}" (${money(created.totalBudget, created.currency)}).`,
          });
        }
        setGroupModal(null);
        setScreen("Overview");
        showToast("success", `Created "${values.name}".`);
      }
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "Could not save group.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleRestoreGroup = async (group: GroupRecord) => {
    setActionBusy(true);
    try {
      if (authConfigured) {
        const response = await fetch(`/api/groups/${encodeURIComponent(group.id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "restore" }),
        });
        const data = (await response.json()) as { group?: GroupRecord; error?: string };
        if (!response.ok || !data.group) throw new Error(data.error ?? "Could not restore group.");
        replaceGroupInState(data.group);
        await refreshServerAudit();
      } else {
        const restored = restoreGroupRecord(group);
        replaceGroupInState(restored);
        pushLocalAudit({
          category: "group",
          eventType: "group.restored",
          eventName: "Group restored",
          status: "info",
          actorLabel: currentUser?.fullName ?? "Local preview user",
          groupId: group.id,
          groupName: group.name,
          description: `Restored "${group.name}" from archive.`,
        });
      }
      showToast("success", `Restored "${group.name}".`);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Could not restore group.");
    } finally {
      setActionBusy(false);
    }
  };

  // Member handlers
  const handleSubmitMemberModal = async (values: {
    id?: string;
    name: string;
    role: GroupRole;
    email: string;
  }) => {
    setActionBusy(true);
    try {
      if (memberModal?.mode === "edit" && values.id) {
        if (authConfigured) {
          const response = await fetch(
            `/api/groups/${encodeURIComponent(activeGroup.id)}/members/${encodeURIComponent(values.id)}`,
            {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ name: values.name, role: values.role, email: values.email }),
            },
          );
          const data = (await response.json()) as { group?: GroupRecord; error?: string };
          if (!response.ok || !data.group) throw new Error(data.error ?? "Could not update member.");
          replaceGroupInState(data.group);
          await refreshServerAudit();
        } else {
          const next = updateGroupMember(activeGroup, values.id, values);
          replaceGroupInState(next);
          pushLocalAudit({
            category: "group",
            eventType: "member.updated",
            eventName: "Member updated",
            status: "success",
            actorLabel: currentUser?.fullName ?? "Local preview user",
            groupId: activeGroup.id,
            groupName: activeGroup.name,
            description: `Updated "${values.name}" (${values.role}) in "${activeGroup.name}".`,
          });
        }
        showToast("success", `Updated ${values.name}.`);
      } else {
        if (authConfigured) {
          const response = await fetch(`/api/groups/${encodeURIComponent(activeGroup.id)}/members`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: values.name, role: values.role, email: values.email }),
          });
          const data = (await response.json()) as { group?: GroupRecord; error?: string };
          if (!response.ok || !data.group) throw new Error(data.error ?? "Could not add member.");
          replaceGroupInState(data.group);
          await refreshServerAudit();
        } else {
          const { group: next } = addGroupMember(activeGroup, values);
          replaceGroupInState(next);
          pushLocalAudit({
            category: "group",
            eventType: "member.added",
            eventName: "Member added",
            status: "success",
            actorLabel: currentUser?.fullName ?? "Local preview user",
            groupId: activeGroup.id,
            groupName: activeGroup.name,
            description: `Added ${values.name} (${values.role}) to "${activeGroup.name}".`,
          });
        }
        showToast("success", `Added ${values.name} to ${activeGroup.name}.`);
      }
      setMemberModal(null);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Could not update roster.");
    } finally {
      setActionBusy(false);
    }
  };

  // Expense handlers
  const handleSaveExpense = async (values: {
    id?: string;
    title: string;
    amount: number;
    category: string;
    paidByMemberId: string;
    submittedBy: string;
    date: string;
    notes: string;
    receiptName?: string;
    receiptData?: string;
  }) => {
    setActionBusy(true);
    try {
      if (values.id) {
        if (authConfigured) {
          const response = await fetch(
            `/api/groups/${encodeURIComponent(activeGroup.id)}/expenses/${encodeURIComponent(values.id)}`,
            {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(values),
            },
          );
          const data = (await response.json()) as { group?: GroupRecord; error?: string };
          if (!response.ok || !data.group) throw new Error(data.error ?? "Could not update expense.");
          replaceGroupInState(data.group);
          await refreshServerAudit();
        } else {
          const next = updateGroupExpense(activeGroup, values.id, values);
          replaceGroupInState(next);
          pushLocalAudit({
            category: "financial",
            eventType: "expense.updated",
            eventName: "Expense updated",
            status: "success",
            actorLabel: currentUser?.fullName ?? "Local preview user",
            groupId: activeGroup.id,
            groupName: activeGroup.name,
            description: `Edited "${values.title}" (${money(values.amount, activeGroup.currency)}).`,
          });
        }
        showToast("success", `Updated expense "${values.title}".`);
      } else {
        if (authConfigured) {
          const response = await fetch(`/api/groups/${encodeURIComponent(activeGroup.id)}/expenses`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(values),
          });
          const data = (await response.json()) as { group?: GroupRecord; error?: string };
          if (!response.ok || !data.group) throw new Error(data.error ?? "Could not save expense.");
          replaceGroupInState(data.group);
          await refreshServerAudit();
        } else {
          const { group: next } = addGroupExpense(activeGroup, values);
          replaceGroupInState(next);
          pushLocalAudit({
            category: "financial",
            eventType: "expense.created",
            eventName: "Expense logged",
            status: "success",
            actorLabel: currentUser?.fullName ?? "Local preview user",
            groupId: activeGroup.id,
            groupName: activeGroup.name,
            description: `Added "${values.title}" (${money(values.amount, activeGroup.currency)}, paid by ${values.submittedBy}).`,
          });
        }
        showToast("success", `Added "${values.title}" (${money(values.amount, activeGroup.currency)}).`);
      }
      setExpenseModal({ open: false });
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Could not save expense.");
    } finally {
      setActionBusy(false);
    }
  };

  const confirmVerifyExpense = async (expenseId: string) => {
    const expense = activeGroup.expenses.find((e) => e.id === expenseId);
    if (!expense?.receiptData) return;
    setActionBusy(true);
    try {
      if (authConfigured) {
        const response = await fetch(
          `/api/groups/${encodeURIComponent(activeGroup.id)}/expenses/${encodeURIComponent(expenseId)}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "verify" }),
          },
        );
        const data = (await response.json()) as { group?: GroupRecord; error?: string };
        if (!response.ok || !data.group) throw new Error(data.error ?? "Could not verify receipt.");
        replaceGroupInState(data.group);
        await refreshServerAudit();
      } else {
        const { group: next } = verifyGroupExpense(activeGroup, expenseId);
        replaceGroupInState(next);
        pushLocalAudit({
          category: "financial",
          eventType: "expense.verified",
          eventName: "Receipt verified",
          status: "success",
          actorLabel: currentUser?.fullName ?? "Local preview user",
          groupId: activeGroup.id,
          groupName: activeGroup.name,
          description: `Verified receipt for "${expense.title}" (${money(expense.amount, activeGroup.currency)}).`,
        });
      }
      setReviewingExpenseId(null);
      showToast("success", `Verified "${expense.title}".`);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Verification failed.");
    } finally {
      setActionBusy(false);
    }
  };

  // Budget planner handlers
  const updateDraftCategory = (id: string, value: number) => {
    const nextDraft = activeGroup.draftCategories.map((item) =>
      item.id === id
        ? { ...item, budget: Number.isFinite(value) ? Math.max(0, Math.min(value, 100_000_000)) : 0 }
        : item,
    );
    replaceGroupInState({ ...activeGroup, draftCategories: nextDraft, proposalRequested: false });
  };

  const handleAddBudgetCategory = async (label: string, budget: number) => {
    setActionBusy(true);
    try {
      if (authConfigured) {
        const response = await fetch(`/api/groups/${encodeURIComponent(activeGroup.id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "add_category",
            newCategory: { label, budget, color: "#9ccbf5" },
          }),
        });
        const data = (await response.json()) as { group?: GroupRecord; error?: string };
        if (!response.ok || !data.group) throw new Error(data.error ?? "Could not add category.");
        replaceGroupInState(data.group);
        await refreshServerAudit();
      } else {
        const next = addGroupBudgetCategory(activeGroup, label, budget);
        replaceGroupInState(next);
        pushLocalAudit({
          category: "financial",
          eventType: "budget.updated",
          eventName: "Budget category added",
          status: "success",
          actorLabel: currentUser?.fullName ?? "Local preview user",
          groupId: activeGroup.id,
          groupName: activeGroup.name,
          description: `Added budget category "${label}" (${money(budget, activeGroup.currency)}).`,
        });
      }
      showToast("success", `Added budget category "${label}".`);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Could not add category.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleRequestProposal = async () => {
    if (authConfigured) {
      const response = await fetch(`/api/groups/${encodeURIComponent(activeGroup.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save_draft",
          draftCategories: activeGroup.draftCategories.map((c) => ({ id: c.id, budget: c.budget })),
          proposalRequested: true,
        }),
      });
      const data = (await response.json()) as { group?: GroupRecord; error?: string };
      if (response.ok && data.group) {
        replaceGroupInState(data.group);
        await refreshServerAudit();
      }
    } else {
      replaceGroupInState({ ...activeGroup, proposalRequested: true });
      pushLocalAudit({
        category: "financial",
        eventType: "budget.proposal_created",
        eventName: "Budget proposal saved",
        status: "info",
        actorLabel: currentUser?.fullName ?? "Local preview user",
        groupId: activeGroup.id,
        groupName: activeGroup.name,
        description: `Saved draft budget proposal of ${money(summary.draftTotal, activeGroup.currency)}.`,
      });
    }
  };

  // Contributions handler
  const handleRecordContribution = async (values: {
    fromMemberId: string;
    toMemberId: string;
    amount: number;
    note: string;
  }) => {
    setActionBusy(true);
    try {
      const fromMember = activeGroup.members.find((m) => m.id === values.fromMemberId);
      const toMember = activeGroup.members.find((m) => m.id === values.toMemberId);
      if (!fromMember || !toMember) throw new Error("Select valid members.");

      if (authConfigured) {
        const response = await fetch(`/api/groups/${encodeURIComponent(activeGroup.id)}/contributions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(values),
        });
        const data = (await response.json()) as { group?: GroupRecord; error?: string };
        if (!response.ok || !data.group) throw new Error(data.error ?? "Could not record contribution.");
        replaceGroupInState(data.group);
        await refreshServerAudit();
      } else {
        const { group: next } = recordGroupSettlement(
          activeGroup,
          { from: fromMember.name, to: toMember.name, amount: values.amount },
          values.note,
        );
        replaceGroupInState(next);
        pushLocalAudit({
          category: "financial",
          eventType: "contribution.recorded",
          eventName: "Member contribution recorded",
          status: "success",
          actorLabel: currentUser?.fullName ?? "Local preview user",
          groupId: activeGroup.id,
          groupName: activeGroup.name,
          description: `Recorded ${fromMember.name} → ${toMember.name} (${money(values.amount, activeGroup.currency)}).`,
        });
      }
      setContributionModal(false);
      showToast("success", "Contribution recorded and balances recalculated.");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Could not record contribution.");
    } finally {
      setActionBusy(false);
    }
  };

  // Logout & Session Revocation
  const handleLogout = async (scope: "local" | "others" | "global") => {
    setActionBusy(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Session revocation failed.");
      }
      if (scope === "others") {
        await refreshServerAudit();
        showToast("success", "Revoked all other active sessions.");
      } else {
        window.location.assign("/login");
      }
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Could not complete session action.");
    } finally {
      setActionBusy(false);
    }
  };

  // Confirmation Executor for destructive/financial actions
  const executePendingConfirm = async () => {
    if (!pendingConfirm) return;
    setActionBusy(true);
    try {
      if (pendingConfirm.kind === "delete_expense") {
        const exp = pendingConfirm.expense;
        if (authConfigured) {
          const response = await fetch(
            `/api/groups/${encodeURIComponent(activeGroup.id)}/expenses/${encodeURIComponent(exp.id)}`,
            { method: "DELETE" },
          );
          const data = (await response.json()) as { group?: GroupRecord; error?: string };
          if (!response.ok || !data.group) throw new Error(data.error ?? "Could not delete expense.");
          replaceGroupInState(data.group);
          await refreshServerAudit();
        } else {
          const { group: next } = deleteGroupExpense(activeGroup, exp.id);
          replaceGroupInState(next);
          pushLocalAudit({
            category: "financial",
            eventType: "expense.deleted",
            eventName: "Expense deleted",
            status: "warning",
            actorLabel: currentUser?.fullName ?? "Local preview user",
            groupId: activeGroup.id,
            groupName: activeGroup.name,
            description: `Deleted "${exp.title}" (${money(exp.amount, activeGroup.currency)}).`,
          });
        }
        showToast("success", `Deleted "${exp.title}".`);
      } else if (pendingConfirm.kind === "remove_member") {
        const member = pendingConfirm.member;
        if (authConfigured) {
          const response = await fetch(
            `/api/groups/${encodeURIComponent(activeGroup.id)}/members/${encodeURIComponent(member.id)}`,
            { method: "DELETE" },
          );
          const data = (await response.json()) as { group?: GroupRecord; error?: string };
          if (!response.ok || !data.group) throw new Error(data.error ?? "Could not remove member.");
          replaceGroupInState(data.group);
          await refreshServerAudit();
        } else {
          const next = removeGroupMember(activeGroup, member.id);
          replaceGroupInState(next);
          pushLocalAudit({
            category: "group",
            eventType: "member.removed",
            eventName: "Member removed",
            status: "info",
            actorLabel: currentUser?.fullName ?? "Local preview user",
            groupId: activeGroup.id,
            groupName: activeGroup.name,
            description: `Removed ${member.name} from "${activeGroup.name}".`,
          });
        }
        showToast("success", `Removed ${member.name} from ${activeGroup.name}.`);
      } else if (pendingConfirm.kind === "transfer_owner") {
        const member = pendingConfirm.member;
        if (authConfigured) {
          const response = await fetch(
            `/api/groups/${encodeURIComponent(activeGroup.id)}/members/${encodeURIComponent(member.id)}`,
            {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ role: "owner" }),
            },
          );
          const data = (await response.json()) as { group?: GroupRecord; error?: string };
          if (!response.ok || !data.group) throw new Error(data.error ?? "Could not transfer ownership.");
          replaceGroupInState(data.group);
          await refreshServerAudit();
        } else {
          const next = transferGroupOwnership(activeGroup, member.id);
          replaceGroupInState(next);
          pushLocalAudit({
            category: "group",
            eventType: "member.updated",
            eventName: "Organizer ownership transferred",
            status: "info",
            actorLabel: currentUser?.fullName ?? "Local preview user",
            groupId: activeGroup.id,
            groupName: activeGroup.name,
            description: `Transferred group owner role to ${member.name}.`,
          });
        }
        showToast("success", `${member.name} is now the organizer/owner of ${activeGroup.name}.`);
      } else if (pendingConfirm.kind === "archive_group") {
        const target = pendingConfirm.group;
        if (authConfigured) {
          const response = await fetch(`/api/groups/${encodeURIComponent(target.id)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "archive" }),
          });
          const data = (await response.json()) as { group?: GroupRecord; error?: string };
          if (!response.ok || !data.group) throw new Error(data.error ?? "Could not archive group.");
          replaceGroupInState(data.group);
          await refreshServerAudit();
        } else {
          const archived = archiveGroupRecord(target);
          replaceGroupInState(archived);
          pushLocalAudit({
            category: "group",
            eventType: "group.archived",
            eventName: "Group archived",
            status: "info",
            actorLabel: currentUser?.fullName ?? "Local preview user",
            groupId: target.id,
            groupName: target.name,
            description: `Archived "${target.name}".`,
          });
        }
        if (activeGroupId === target.id) {
          const nextActive = groups.find((g) => g.id !== target.id && !g.archivedAt);
          if (nextActive) setActiveGroupId(nextActive.id);
        }
        showToast("success", `Archived "${target.name}".`);
      } else if (pendingConfirm.kind === "apply_budget") {
        if (authConfigured) {
          const response = await fetch(`/api/groups/${encodeURIComponent(activeGroup.id)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action: "apply_budget",
              draftCategories: activeGroup.draftCategories.map((c) => ({ id: c.id, budget: c.budget })),
            }),
          });
          const data = (await response.json()) as { group?: GroupRecord; error?: string };
          if (!response.ok || !data.group) throw new Error(data.error ?? "Could not apply budget update.");
          replaceGroupInState(data.group);
          await refreshServerAudit();
        } else {
          const next = applyGroupBudgetDraft(activeGroup, activeGroup.draftCategories);
          replaceGroupInState(next);
          pushLocalAudit({
            category: "financial",
            eventType: "budget.updated",
            eventName: "Group budget updated",
            status: "success",
            actorLabel: currentUser?.fullName ?? "Local preview user",
            groupId: activeGroup.id,
            groupName: activeGroup.name,
            description: `Updated agreed budget from ${money(summary.totalBudget, activeGroup.currency)} to ${money(next.totalBudget, activeGroup.currency)}.`,
          });
        }
        showToast("success", "Group budget updated and remaining balances recalculated.");
      } else if (pendingConfirm.kind === "record_settlement") {
        const transfer = pendingConfirm.transfer;
        if (authConfigured) {
          const response = await fetch(`/api/groups/${encodeURIComponent(activeGroup.id)}/settlements`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(transfer),
          });
          const data = (await response.json()) as { group?: GroupRecord; error?: string };
          if (!response.ok || !data.group) throw new Error(data.error ?? "Could not record settlement.");
          replaceGroupInState(data.group);
          await refreshServerAudit();
        } else {
          const { group: next } = recordGroupSettlement(activeGroup, transfer);
          replaceGroupInState(next);
          pushLocalAudit({
            category: "financial",
            eventType: "settlement.recorded",
            eventName: "Settlement recorded",
            status: "success",
            actorLabel: currentUser?.fullName ?? "Local preview user",
            groupId: activeGroup.id,
            groupName: activeGroup.name,
            description: `Recorded settlement: ${transfer.from} paid ${transfer.to} ${money(transfer.amount, activeGroup.currency)}.`,
          });
        }
        showToast("success", `Recorded transfer from ${transfer.from} to ${transfer.to}.`);
      } else if (pendingConfirm.kind === "revoke_others") {
        setPendingConfirm(null);
        await handleLogout("others");
        return;
      } else if (pendingConfirm.kind === "revoke_global") {
        setPendingConfirm(null);
        await handleLogout("global");
        return;
      } else if (pendingConfirm.kind === "reset_demo") {
        localStorage.removeItem(WORKSPACE_STORAGE_KEY);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        localStorage.removeItem("splitmind-payment-pending");
        window.location.reload();
        return;
      }
      setPendingConfirm(null);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Action failed.");
      setPendingConfirm(null);
    } finally {
      setActionBusy(false);
    }
  };

  const handleSimulateDemoPayment = () => {
    const valid =
      /^(?:0|[1-9]\d{0,3})(?:\.\d{1,2})?$/.test(paymentAmount) &&
      Number(paymentAmount) >= 0.01 &&
      Number(paymentAmount) <= 9999.99;
    if (!valid) {
      setPaymentFeedback({
        tone: "warning",
        headline: "Enter a valid demo amount",
        detail: "Use an amount between $0.01 and $9,999.99 USD to preview the checkout receipt.",
      });
      return;
    }

    const simulatedId = `DEMO-${activeGroup.id.slice(0, 6).toUpperCase()}-${paymentAmount.replace(".", "")}`;
    setPaymentFeedback({
      tone: "success",
      headline: "Demo payment simulated (no real charge)",
      detail: `Simulated checkout preview for ${activeGroup.name}. Real PayPal Sandbox calls are disabled in DEMO sessions.`,
      amount: paymentAmount,
      currency: "USD",
      captureId: simulatedId,
    });
    showToast("success", `Simulated demo payment of $${paymentAmount} USD (no real PayPal transaction).`);
  };

  const createOrder = async () => {
    if (isDemo) {
      handleSimulateDemoPayment();
      return;
    }
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
        pending?.amount === paymentAmount && typeof pending.key === "string"
          ? pending.key
          : crypto.randomUUID();
      localStorage.setItem("splitmind-payment-pending", JSON.stringify({ amount: paymentAmount, key: idempotencyKey }));

      const response = await fetch("/api/payments/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: paymentAmount,
          idempotencyKey,
          groupId: authConfigured ? activeGroup.id : undefined,
        }),
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
    setChatByGroup((prev) => ({
      ...prev,
      [activeGroup.id]: [
        {
          role: "assistant",
          text: `Fresh page, same ${activeGroup.name} context. What would you like to figure out?`,
          source: "SplitMind deterministic engine",
        },
      ],
    }));
  };

  const handleSaveProfile = async (values: { fullName: string; defaultCurrency: CurrencyCode }) => {
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = (await response.json()) as { profile?: AuthUser; error?: string };
    if (!response.ok || !data.profile) throw new Error(data.error ?? "Could not update profile.");
    setCurrentUser(data.profile);
    await refreshServerAudit();
  };

  const handleChangePassword = async (values: { currentPassword: string; newPassword: string }) => {
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Could not update password.");
    await refreshServerAudit();
  };

  const isArchived = Boolean(activeGroup.archivedAt);

  const confirmDialogProps = (() => {
    if (!pendingConfirm) return null;
    switch (pendingConfirm.kind) {
      case "delete_expense":
        return {
          title: `Delete "${pendingConfirm.expense.title}"?`,
          message: `Removing this ${money(pendingConfirm.expense.amount, activeGroup.currency)} expense will deduct it from ${pendingConfirm.expense.submittedBy}'s paid balance and recalculate settlements.`,
          confirmLabel: "Delete expense",
          tone: "danger" as const,
        };
      case "remove_member":
        return {
          title: `Remove ${pendingConfirm.member.name}?`,
          message: `They will be removed from ${activeGroup.name}'s roster and future equal-share calculations.`,
          confirmLabel: "Remove member",
          tone: "danger" as const,
        };
      case "transfer_owner":
        return {
          title: `Make ${pendingConfirm.member.name} organizer/owner?`,
          message: `${pendingConfirm.member.name} will become the primary owner/organizer of "${activeGroup.name}".`,
          confirmLabel: "Transfer ownership",
          tone: "primary" as const,
        };
      case "archive_group":
        return {
          title: `Archive "${pendingConfirm.group.name}"?`,
          message: `Archived groups become read-only and leave the active workspace list. You can restore "${pendingConfirm.group.name}" anytime from the Archived filter.`,
          confirmLabel: "Archive group",
          tone: "danger" as const,
        };
      case "apply_budget":
        return {
          title: `Update agreed budget for ${activeGroup.name}?`,
          message: `Change agreed budget from ${money(summary.totalBudget, activeGroup.currency)} to ${money(summary.draftTotal, activeGroup.currency)}. Remaining balances and per-person targets will recalculate immediately.`,
          confirmLabel: "Apply budget update",
          tone: "primary" as const,
        };
      case "record_settlement":
        return {
          title: "Record settlement transfer?",
          message: `Confirm ${pendingConfirm.transfer.from} paid ${pendingConfirm.transfer.to} ${money(pendingConfirm.transfer.amount, activeGroup.currency)}. Member balances will update immediately.`,
          confirmLabel: "Record settlement",
          tone: "primary" as const,
        };
      case "revoke_others":
        return {
          title: "Revoke all other active sessions?",
          message: "All other signed-in browsers or devices will be invalidated while keeping this current session active.",
          confirmLabel: "Revoke other sessions",
          tone: "danger" as const,
        };
      case "revoke_global":
        return {
          title: "Sign out of all devices?",
          message: "This terminates your current session and every other active SplitMind session across all devices.",
          confirmLabel: "Sign out everywhere",
          tone: "danger" as const,
        };
      case "reset_demo":
        return {
          title: "Reset local preview workspace?",
          message: "All locally created groups and edits in this browser will be cleared and Goa Trip 2026 will be restored.",
          confirmLabel: "Confirm reset",
          tone: "danger" as const,
        };
    }
  })();

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
        settingsTab={settingsTab}
        onSelectScreen={pickScreen}
        onOpenSecuritySettings={openSecuritySettings}
        groups={groups}
        activeGroup={activeGroup}
        onSelectGroup={selectGroup}
        onOpenCreateGroup={() => {
          setModalError("");
          setGroupModal({ mode: "create" });
          setMobileNav(false);
        }}
        currentUser={currentUser}
        authConfigured={authConfigured}
        isDemo={isDemo}
        unverifiedCount={summary.unverifiedCount}
        auditCount={auditEvents.filter((e) => e.groupId === activeGroup.id).length}
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
      />

      <main className="main-area">
        <Topbar
          screen={screen === "Settings" && settingsTab === "security" ? "Settings" : screen}
          groupName={activeGroup.name}
          groupCurrency={activeGroup.currency}
          unverifiedCount={summary.unverifiedCount}
          authConfigured={authConfigured}
          isDemo={isDemo}
          currentUser={currentUser}
          onOpenMobileNav={() => setMobileNav(true)}
          onOpenExpenses={() => pickScreen("Expenses")}
          onOpenCopilot={() => setCopilotDrawer(true)}
          onOpenSettings={() => pickScreen("Settings")}
          onOpenSecuritySettings={openSecuritySettings}
          onLogout={() => void handleLogout("local")}
        />

        <div className="page-content">
          {!authConfigured && (
            <div className="preview-mode-banner" role="status">
              <ShieldAlert size={15} />
              <span>
                <strong>Local preview mode</strong> — Supabase Auth credentials are not configured in this
                environment, so groups save in this browser without fake sign-in. Configure{" "}
                <code>SUPABASE_URL</code>, <code>SUPABASE_ANON_KEY</code>, and{" "}
                <code>SUPABASE_SERVICE_ROLE_KEY</code> to enable server authentication and RLS persistence.
              </span>
            </div>
          )}

          {isDemo && (
            <div className="demo-mode-banner" role="status">
              <div className="demo-mode-copy">
                <span className="demo-pill-tag">DEMO</span>
                <span>
                  <strong>Explore Demo Mode</strong> — You are exploring an isolated sample workspace seeded
                  with the Goa Trip 2026 ledger (8 friends, 3 days). Changes stay private to your demo
                  session and never trigger real payments.
                </span>
              </div>
              <div className="demo-mode-actions">
                <button
                  type="button"
                  className="button button-outline button-sm"
                  onClick={() => void handleLogout("local")}
                >
                  <LogOut size={13} /> Exit Demo / Return to Login
                </button>
              </div>
            </div>
          )}

          {isArchived && (
            <div className="preview-mode-banner" role="status">
              <ArchiveRestore size={15} />
              <span>
                <strong>{activeGroup.name} is archived</strong> (read-only). Restore it to add expenses or edit
                members.
              </span>
              <button
                type="button"
                className="button button-outline button-sm"
                onClick={() => void handleRestoreGroup(activeGroup)}
              >
                Restore group
              </button>
            </div>
          )}

          {banner && (
            <div
              className={`action-toast ${banner.tone === "error" ? "action-toast-error" : "action-toast-success"}`}
              role="status"
            >
              {banner.tone === "error" ? <ShieldAlert size={15} /> : <CheckCircle2 size={15} />}
              <span>{banner.text}</span>
              <button
                type="button"
                className="icon-button"
                onClick={() => setBanner(null)}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="welcome-row">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-dot" /> {activeGroup.name.toUpperCase()}{" "}
                <span className="eyebrow-divider">/</span> {planTypeLabel(activeGroup.planType).toUpperCase()}{" "}
                <span className="eyebrow-divider">/</span>{" "}
                {formatGroupDates(activeGroup.startDate, activeGroup.endDate).toUpperCase()}
              </div>
              <h1>
                {screen === "Overview" ? (
                  <>
                    {activeGroup.name} <span>Command</span>
                  </>
                ) : screen === "Settings" && settingsTab === "security" ? (
                  "Security & Activity"
                ) : (
                  SCREEN_COPY[screen].title
                )}
              </h1>
              <p className="page-subtitle">
                {screen === "Settings" && settingsTab === "security"
                  ? "Monitor login attempts, session controls, and immutable group financial audit history."
                  : SCREEN_COPY[screen].subtitle}
              </p>
            </div>

            <div className="header-buttons">
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  setModalError("");
                  setGroupModal({ mode: "create" });
                }}
              >
                <FolderPlus size={15} /> New group
              </button>
              <button
                type="button"
                className="button button-outline"
                disabled={isArchived}
                onClick={() => setExpenseModal({ open: true })}
              >
                <Plus size={15} /> Add expense
              </button>
              <button type="button" className="button button-primary" onClick={() => pickScreen("Budget planner")}>
                <Sparkles size={15} /> MoneyTwin
              </button>
            </div>
          </div>

          {screen === "Overview" && (
            <OverviewView
              groupName={activeGroup.name}
              currency={activeGroup.currency}
              isArchived={isArchived}
              members={activeGroup.members}
              categories={activeGroup.categories}
              expenses={activeGroup.expenses}
              balances={summary.balances}
              totalBudget={summary.totalBudget}
              totalSpent={summary.totalSpent}
              unverifiedCount={summary.unverifiedCount}
              onSelectScreen={pickScreen}
              onOpenAddMember={() => setMemberModal({ mode: "add" })}
              onOpenExpenseModal={() => setExpenseModal({ open: true })}
              onReviewExpense={(expense) => setReviewingExpenseId(expense.id)}
              onAskAgent={askFromOverview}
            />
          )}

          {screen === "Groups" && (
            <GroupsView
              groups={groups}
              activeGroup={activeGroup}
              balances={summary.balances}
              totalBudget={summary.totalBudget}
              totalSpent={summary.totalSpent}
              onSelectGroup={selectGroup}
              onOpenCreateGroup={() => {
                setModalError("");
                setGroupModal({ mode: "create" });
              }}
              onOpenEditGroup={(group) => {
                setModalError("");
                setGroupModal({ mode: "edit", group });
              }}
              onRequestArchiveGroup={(group) => setPendingConfirm({ kind: "archive_group", group })}
              onRestoreGroup={(group) => void handleRestoreGroup(group)}
              onOpenAddMember={() => setMemberModal({ mode: "add" })}
              onOpenEditMember={(member) => setMemberModal({ mode: "edit", member })}
              onRequestMakeOwner={(member) => setPendingConfirm({ kind: "transfer_owner", member })}
              onRequestRemoveMember={(member) => setPendingConfirm({ kind: "remove_member", member })}
              onOpenRecordContribution={() => setContributionModal(true)}
              onSelectScreen={pickScreen}
            />
          )}

          {screen === "Budget planner" && (
            <BudgetPlannerView
              groupName={activeGroup.name}
              currency={activeGroup.currency}
              isArchived={isArchived}
              categories={activeGroup.categories}
              draftCategories={activeGroup.draftCategories}
              members={activeGroup.members}
              totalBudget={summary.totalBudget}
              draftTotal={summary.draftTotal}
              totalSpent={summary.totalSpent}
              proposalRequested={activeGroup.proposalRequested}
              onUpdateCategory={updateDraftCategory}
              onAddCategory={(label, budget) => void handleAddBudgetCategory(label, budget)}
              onDiscardDraft={() =>
                replaceGroupInState({
                  ...activeGroup,
                  draftCategories: activeGroup.categories.map((c) => ({ ...c })),
                  proposalRequested: false,
                })
              }
              onRequestApproval={() => void handleRequestProposal()}
              onRequestApplyBudget={() => setPendingConfirm({ kind: "apply_budget" })}
              onShareSimulationToAgent={(sim) => {
                setChatByGroup((prev) => ({
                  ...prev,
                  [activeGroup.id]: [
                    ...(prev[activeGroup.id] ?? defaultChatForGroup(activeGroup, currentUser)),
                    {
                      role: "assistant",
                      text: `Simulation only: with ${sim.activeMembers} people and a ${money(sim.extraCost, activeGroup.currency)} unexpected cost, the suggested share would be ${money(sim.perPerson, activeGroup.currency)} per person. This does not change your agreed budget.`,
                      calculations: [
                        `Current planned total: ${money(summary.totalBudget, activeGroup.currency)}`,
                        `Unexpected cost: ${money(sim.extraCost, activeGroup.currency)}`,
                        `Revised scenario total: ${money(sim.revisedBudget, activeGroup.currency)}`,
                        `People in this scenario: ${sim.activeMembers}`,
                        `New suggested share: ${money(sim.perPerson, activeGroup.currency)}`,
                      ],
                      source: "SplitMind MoneyTwin",
                    },
                  ],
                }));
                if (typeof window !== "undefined" && window.innerWidth <= 1279) {
                  setCopilotDrawer(true);
                }
              }}
            />
          )}

          {screen === "Expenses" && (
            <ExpensesView
              groupName={activeGroup.name}
              currency={activeGroup.currency}
              isArchived={isArchived}
              expenses={activeGroup.expenses}
              categories={activeGroup.categories}
              onOpenExpenseModal={() => setExpenseModal({ open: true })}
              onReviewExpense={(expense) => setReviewingExpenseId(expense.id)}
              onEditExpense={(expense) => setExpenseModal({ open: true, editing: expense })}
              onRequestDeleteExpense={(expense) => setPendingConfirm({ kind: "delete_expense", expense })}
            />
          )}

          {screen === "Settlements" && (
            <SettlementsView
              groupName={activeGroup.name}
              currency={activeGroup.currency}
              isArchived={isArchived}
              members={activeGroup.members}
              balances={summary.balances}
              transfers={summary.transfers}
              recordedSettlements={activeGroup.settlements}
              settlementError={summary.settlementError}
              totalBudget={summary.totalBudget}
              totalSpent={summary.totalSpent}
              onRequestRecordSettlement={(transfer) =>
                setPendingConfirm({ kind: "record_settlement", transfer })
              }
            />
          )}

          {screen === "Payments" && (
            <PaymentsView
              groupName={activeGroup.name}
              groupCurrency={activeGroup.currency}
              isDemo={isDemo}
              paymentAmount={paymentAmount}
              paymentBusy={paymentBusy}
              paymentFeedback={paymentFeedback}
              onChangeAmount={setPaymentAmount}
              onCreateOrder={createOrder}
              onSimulateDemoPayment={handleSimulateDemoPayment}
            />
          )}

          {screen === "AI Financial Agent" && (
            <AgentView
              groupName={activeGroup.name}
              currency={activeGroup.currency}
              memberCount={activeGroup.members.length}
              userInitials={currentUser?.initials}
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
              groupId={activeGroup.id}
              groupName={activeGroup.name}
              currency={activeGroup.currency}
              audit={auditEvents}
              expenses={activeGroup.expenses}
              onReviewExpense={(expense) => setReviewingExpenseId(expense.id)}
              onOpenSecuritySettings={openSecuritySettings}
            />
          )}

          {screen === "Settings" && (
            <SettingsView
              activeTab={settingsTab}
              onChangeTab={setSettingsTab}
              activeGroup={activeGroup}
              groups={groups}
              currentUser={currentUser}
              authConfigured={authConfigured}
              session={initialSession}
              auditEvents={auditEvents}
              auditLoading={auditLoading}
              auditError={auditError}
              onRefreshAudit={() => void refreshServerAudit()}
              onSaveProfile={handleSaveProfile}
              onChangePassword={handleChangePassword}
              onLogoutLocal={() => void handleLogout("local")}
              onRequestRevokeOthers={() => setPendingConfirm({ kind: "revoke_others" })}
              onRequestRevokeAll={() => setPendingConfirm({ kind: "revoke_global" })}
              onRequestResetDemo={() => setPendingConfirm({ kind: "reset_demo" })}
            />
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
            <ShieldCheck size={13} /> {authConfigured ? "Protected by Supabase RLS." : "Local browser workspace."}
          </span>
        </footer>
      </main>

      <AgentRail
        groupName={activeGroup.name}
        memberCount={activeGroup.members.length}
        userInitials={currentUser?.initials}
        messages={messages}
        ask={ask}
        isThinking={isThinking}
        drawerOpen={copilotDrawer}
        onCloseDrawer={() => setCopilotDrawer(false)}
        onChangeAsk={setAsk}
        onSubmitQuestion={askAgent}
        onClear={resetChat}
      />

      {groupModal && (
        <GroupModal
          mode={groupModal.mode}
          initialGroup={groupModal.group}
          defaultCurrency={currentUser?.defaultCurrency ?? "INR"}
          busy={actionBusy}
          serverError={modalError}
          onClose={() => {
            if (!actionBusy) {
              setGroupModal(null);
              setModalError("");
            }
          }}
          onSubmit={(values) => void handleSubmitGroupModal(values)}
        />
      )}

      {expenseModal.open && (
        <ExpenseModal
          groupName={activeGroup.name}
          currency={activeGroup.currency}
          members={activeGroup.members}
          categories={activeGroup.categories}
          initialExpense={expenseModal.editing}
          busy={actionBusy}
          onClose={() => !actionBusy && setExpenseModal({ open: false })}
          onSave={(values) => void handleSaveExpense(values)}
        />
      )}

      {memberModal && (
        <MemberModal
          mode={memberModal.mode}
          groupName={activeGroup.name}
          currency={activeGroup.currency}
          members={activeGroup.members}
          initialMember={memberModal.member}
          busy={actionBusy}
          onClose={() => !actionBusy && setMemberModal(null)}
          onSubmit={(values) => void handleSubmitMemberModal(values)}
        />
      )}

      {contributionModal && (
        <ContributionModal
          groupName={activeGroup.name}
          currency={activeGroup.currency}
          members={activeGroup.members}
          busy={actionBusy}
          onClose={() => !actionBusy && setContributionModal(false)}
          onSubmit={(values) => void handleRecordContribution(values)}
        />
      )}

      {reviewingExpense && (
        <ReceiptReviewModal
          expense={reviewingExpense}
          currency={activeGroup.currency}
          onClose={() => setReviewingExpenseId(null)}
          onConfirmVerify={(id) => void confirmVerifyExpense(id)}
        />
      )}

      {confirmDialogProps && (
        <ConfirmDialog
          {...confirmDialogProps}
          busy={actionBusy}
          onCancel={() => !actionBusy && setPendingConfirm(null)}
          onConfirm={() => void executePendingConfirm()}
        />
      )}
    </div>
  );
}
