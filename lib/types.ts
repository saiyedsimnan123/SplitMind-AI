import type { Category, Expense, Member } from "@/lib/finance";

export type Screen =
  | "Overview"
  | "Groups"
  | "Budget planner"
  | "Expenses"
  | "Payments"
  | "Settlements"
  | "AI Financial Agent"
  | "Activity"
  | "Settings";

export type SettingsTab = "account" | "security";

export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP";

export type PlanType = "trip" | "roommates" | "event" | "project" | "other";

export type GroupRole = "owner" | "organizer" | "member";

export type ChatMessage = {
  role: "assistant" | "user";
  text: string;
  calculations?: string[];
  source?: string;
};

export type AuditCategory = "authentication" | "financial" | "group" | "security";

export type AuditStatus = "success" | "failure" | "warning" | "info";

export type AuditEvent = {
  id: string;
  category: AuditCategory;
  eventType: string;
  eventName: string;
  status: AuditStatus;
  actorUserId: string | null;
  actorLabel: string;
  groupId: string | null;
  groupName: string | null;
  description: string;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
};

export type MemberBalance = Member & {
  role?: GroupRole;
  userId?: string | null;
  email?: string;
  share: number;
  balance: number;
  outstanding: number;
};

export type SettlementTransfer = {
  from: string;
  to: string;
  amount: number;
};

export type GroupMember = Member & {
  role: GroupRole;
  userId?: string | null;
  email?: string;
};

export type ContributionRecord = {
  id: string;
  memberId: string;
  memberName: string;
  recipientMemberId?: string | null;
  recipientName?: string | null;
  amount: number;
  currency: CurrencyCode;
  source: "manual" | "expense" | "settlement" | "paypal_sandbox";
  note: string;
  createdAt: string;
};

export type SettlementRecord = {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  fromName: string;
  toName: string;
  amount: number;
  currency: CurrencyCode;
  status: "suggested" | "recorded" | "verified";
  note: string;
  settledAt: string;
};

export type GroupExpense = Expense & {
  paidByMemberId?: string;
  date?: string;
  notes?: string;
};

export type GroupRecord = {
  id: string;
  name: string;
  planType: PlanType;
  description: string;
  currency: CurrencyCode;
  totalBudget: number;
  startDate: string;
  endDate: string | null;
  ownerMemberId: string;
  ownerUserId?: string | null;
  archivedAt: string | null;
  isDemo?: boolean;
  members: GroupMember[];
  categories: Category[];
  draftCategories: Category[];
  proposalRequested: boolean;
  expenses: GroupExpense[];
  contributions: ContributionRecord[];
  settlements: SettlementRecord[];
  createdAt: string;
  updatedAt: string;
};

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  initials: string;
  avatarColor: string;
  defaultCurrency: CurrencyCode;
  isDemo?: boolean;
};

export type SessionSummary = {
  authenticated: boolean;
  authConfigured: boolean;
  isDemo?: boolean;
  sessionId: string | null;
  provider: string;
  createdAt: string | null;
  deviceLabel: string;
  storageMode: "supabase_http_only" | "local_preview";
};

export type PaymentFeedback = {
  tone: "idle" | "pending" | "success" | "warning" | "error";
  headline: string;
  detail?: string;
  captureId?: string;
  amount?: string;
  currency?: string;
};
