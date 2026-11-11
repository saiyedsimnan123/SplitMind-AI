import {
  Bot,
  Calculator,
  CreditCard,
  GitCompareArrows,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { formatCurrency, PLAN_TYPE_LABELS, type Member } from "@/lib/finance";
import type { CurrencyCode, PlanType } from "@/lib/types";

export const money = (value: number, currency: CurrencyCode = "INR") =>
  formatCurrency(value, currency);

export function formatGroupDates(startDate: string, endDate?: string | null): string {
  const fmt = (raw: string) => {
    const parsed = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return raw;
    return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  if (!startDate) return "Flexible dates";
  if (!endDate || endDate === startDate) return fmt(startDate);
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

export function planTypeLabel(planType: PlanType): string {
  return PLAN_TYPE_LABELS[planType] ?? "Shared plan";
}

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="sm-left-mind" x1="4" y1="6" x2="18" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
          <linearGradient id="sm-right-mind" x1="18" y1="6" x2="32" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>
        <rect
          x="1"
          y="1"
          width="34"
          height="34"
          rx="10"
          fill="#0B162C"
          stroke="rgba(148, 163, 184, 0.28)"
        />
        <path
          d="M16.2 9.5C11.4 9.5 8 13.1 8 18C8 22.9 11.4 26.5 16.2 26.5V22.1C13.8 22.1 12.2 20.4 12.2 18C12.2 15.6 13.8 13.9 16.2 13.9V9.5Z"
          fill="url(#sm-left-mind)"
        />
        <path
          d="M19.8 9.5C24.6 9.5 28 13.1 28 18C28 22.9 24.6 26.5 19.8 26.5V22.1C22.2 22.1 23.8 20.4 23.8 18C23.8 15.6 22.2 13.9 19.8 13.9V9.5Z"
          fill="url(#sm-right-mind)"
        />
        <line x1="14.5" y1="18" x2="21.5" y2="18" stroke="#2DD4BF" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="18" cy="18" r="2.7" fill="#2DD4BF" />
        <circle cx="15.4" cy="11.7" r="1.35" fill="#93C5FD" />
        <circle cx="20.6" cy="24.3" r="1.35" fill="#C4B5FD" />
      </svg>
    </span>
  );
}

export type EngineId =
  | "agent"
  | "smartsplit"
  | "intentpay"
  | "proof"
  | "moneytwin"
  | "settlement";

const ENGINE_META: Record<
  EngineId,
  { label: string; tone: "indigo" | "teal" | "blue" | "navy"; icon: typeof Bot }
> = {
  agent: { label: "AI Group Financial Agent", tone: "indigo", icon: Bot },
  smartsplit: { label: "SmartSplit Engine", tone: "blue", icon: Calculator },
  intentpay: { label: "IntentPay Engine", tone: "navy", icon: CreditCard },
  proof: { label: "Proof Engine", tone: "teal", icon: ShieldCheck },
  moneytwin: { label: "MoneyTwin Engine", tone: "indigo", icon: Sparkles },
  settlement: { label: "Settlement Intelligence", tone: "teal", icon: GitCompareArrows },
};

export function EngineBadge({ engine }: { engine: EngineId }) {
  const meta = ENGINE_META[engine];
  const Icon = meta.icon;
  return (
    <span className={`engine-badge engine-badge-${meta.tone}`}>
      <Icon size={12} />
      <span>{meta.label}</span>
    </span>
  );
}

export function Avatar({
  member,
  size = "md",
}: {
  member: Pick<Member, "initials" | "color" | "name">;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span className={`avatar avatar-${size} ${member.color}`} title={member.name}>
      {member.initials}
    </span>
  );
}

export function ProgressBar({
  value,
  color = "var(--brand)",
  label,
}: {
  value: number;
  color?: string;
  label?: string;
}) {
  const safe = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  const width = safe === 0 ? 0 : Math.max(safe, 2);
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-valuenow={Math.round(safe)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span style={{ width: `${width}%`, background: color }} />
    </div>
  );
}
