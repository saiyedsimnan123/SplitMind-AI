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

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
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
  color = "var(--emerald)",
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
