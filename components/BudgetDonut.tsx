"use client";

import { useState } from "react";
import type { Category } from "@/lib/finance";
import { money } from "@/components/ui";

export function BudgetDonut({
  categories,
  totalBudget,
  totalSpent,
}: {
  categories: Category[];
  totalBudget: number;
  totalSpent: number;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeCategory = categories.find((item) => item.id === selectedId) ?? null;

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const positiveCategories = categories.filter((item) => item.budget > 0);
  const gap = positiveCategories.length > 1 ? 3 : 0;

  let cumulativeLength = 0;
  const segments = positiveCategories.map((category) => {
    const fraction = totalBudget > 0 ? category.budget / totalBudget : 0;
    const rawLength = fraction * circumference;
    const dashLength = Math.max(0, rawLength - gap);
    const dashOffset = -cumulativeLength;
    cumulativeLength += rawLength;
    return { category, fraction, dashLength, dashOffset };
  });

  const centerKicker = activeCategory ? activeCategory.label : "TOTAL PLANNED";
  const centerValue = activeCategory ? money(activeCategory.budget) : money(totalBudget);
  const centerSub = activeCategory
    ? `${money(activeCategory.spent)} spent · ${totalBudget > 0 ? Math.round((activeCategory.budget / totalBudget) * 100) : 0}%`
    : `${money(totalSpent)} spent (${totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}%)`;

  return (
    <div className="budget-chart-row">
      <div className="donut-wrap">
        <svg className="donut-svg" viewBox="0 0 144 144" role="img" aria-label="Budget breakdown by category">
          <circle className="donut-track" cx="72" cy="72" r={radius} />
          <g transform="rotate(-90 72 72)">
            {segments.map(({ category, dashLength, dashOffset }) => {
              const isActive = selectedId === category.id;
              const isDimmed = selectedId !== null && !isActive;
              return (
                <circle
                  key={category.id}
                  cx="72"
                  cy="72"
                  r={radius}
                  fill="none"
                  stroke={category.color}
                  strokeWidth={isActive ? 18 : 15}
                  strokeLinecap="round"
                  strokeDasharray={`${dashLength} ${circumference}`}
                  strokeDashoffset={dashOffset}
                  opacity={isDimmed ? 0.35 : 1}
                  className="donut-segment"
                  onMouseEnter={() => setSelectedId(category.id)}
                  onMouseLeave={() => setSelectedId(null)}
                  onClick={() => setSelectedId((current) => (current === category.id ? null : category.id))}
                />
              );
            })}
          </g>
        </svg>
        <div className="donut-center">
          <small title={centerKicker}>{centerKicker}</small>
          <strong>{centerValue}</strong>
          <span>{centerSub}</span>
        </div>
      </div>

      <div className="legend-list" role="list">
        {categories.map((category) => {
          const sharePct = totalBudget > 0 ? Math.round((category.budget / totalBudget) * 100) : 0;
          const isSelected = selectedId === category.id;
          return (
            <button
              type="button"
              key={category.id}
              className={`legend-row ${isSelected ? "legend-row-active" : ""}`}
              onMouseEnter={() => setSelectedId(category.id)}
              onMouseLeave={() => setSelectedId(null)}
              onClick={() => setSelectedId((current) => (current === category.id ? null : category.id))}
            >
              <span className="legend-dot" style={{ background: category.color }} />
              <span className="legend-copy">
                <span className="legend-name">{category.label}</span>
                <small className="legend-meta">
                  {money(category.spent)} spent · {sharePct}%
                </small>
              </span>
              <strong className="tabular">{money(category.budget)}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}
