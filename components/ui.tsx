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
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="sm-vessel" x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0B1630" />
            <stop offset="100%" stopColor="#060D1E" />
          </linearGradient>
          <linearGradient id="sm-left-mind" x1="8" y1="10" x2="21" y2="29" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
          <linearGradient id="sm-right-mind" x1="20" y1="10" x2="32" y2="29" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
          <linearGradient id="sm-core-teal" x1="16" y1="16" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5EEAD4" />
            <stop offset="100%" stopColor="#0D9488" />
          </linearGradient>
        </defs>
        <rect
          x="1.5"
          y="1.5"
          width="37"
          height="37"
          rx="11"
          fill="url(#sm-vessel)"
          stroke="rgba(96, 165, 250, 0.38)"
          strokeWidth="1.2"
        />
        <path
          d="M11 12.5C14.8 12.5 17 15.8 20 20C17 24.2 14.8 27.5 11 27.5"
          stroke="url(#sm-left-mind)"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <path
          d="M29 12.5C25.2 12.5 23 15.8 20 20C23 24.2 25.2 27.5 29 27.5"
          stroke="url(#sm-right-mind)"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <path
          d="M11 12.5C16.5 10.2 23.5 10.2 29 12.5"
          stroke="#60A5FA"
          strokeOpacity="0.45"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M11 27.5C16.5 29.8 23.5 29.8 29 27.5"
          stroke="#A78BFA"
          strokeOpacity="0.45"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <circle cx="11" cy="12.5" r="2.6" fill="#60A5FA" />
        <circle cx="11" cy="27.5" r="2.6" fill="#3B82F6" />
        <circle cx="29" cy="12.5" r="2.6" fill="#A78BFA" />
        <circle cx="29" cy="27.5" r="2.6" fill="#8B5CF6" />
        <polygon points="20,14.6 25.4,20 20,25.4 14.6,20" fill="url(#sm-core-teal)" />
        <circle cx="20" cy="20" r="2.1" fill="#FFFFFF" />
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
