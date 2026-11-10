import type { Member } from "@/lib/finance";

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

export type ChatMessage = {
  role: "assistant" | "user";
  text: string;
  calculations?: string[];
  source?: string;
};

export type AuditEvent = {
  id: string;
  action: string;
  detail: string;
  createdAt: string;
};

export type MemberBalance = Member & {
  share: number;
  balance: number;
  outstanding: number;
};

export type SettlementTransfer = {
  from: string;
  to: string;
  amount: number;
};

export type PaymentFeedback = {
  tone: "idle" | "pending" | "success" | "warning" | "error";
  headline: string;
  detail?: string;
  captureId?: string;
  amount?: string;
  currency?: string;
};
