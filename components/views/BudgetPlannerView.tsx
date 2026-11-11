"use client";

import { ArrowUpRight, Check, Clock3, LockKeyhole, Plus, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { getCurrencySymbol, simulateBudget, type Category } from "@/lib/finance";
import type { CurrencyCode, GroupMember } from "@/lib/types";
import { ProgressBar, money } from "@/components/ui";

type SimulationSnapshot = {
  activeMembers: number;
  revisedBudget: number;
  perPerson: number;
  previousPerPerson: number;
  extraCost: number;
  cancelledName?: string;
};

export function BudgetPlannerView({
  groupName,
  currency,
  isArchived,
  categories,
  draftCategories,
  members,
  totalBudget,
  draftTotal,
  totalSpent,
  proposalRequested,
  onUpdateCategory,
  onAddCategory,
  onDiscardDraft,
  onRequestApproval,
  onRequestApplyBudget,
  onShareSimulationToAgent,
}: {
  groupName: string;
  currency: CurrencyCode;
  isArchived: boolean;
  categories: Category[];
  draftCategories: Category[];
  members: GroupMember[];
  totalBudget: number;
  draftTotal: number;
  totalSpent: number;
  proposalRequested: boolean;
  onUpdateCategory: (id: string, value: number) => void;
  onAddCategory: (label: string, budget: number) => void;
  onDiscardDraft: () => void;
  onRequestApproval: () => void;
  onRequestApplyBudget: () => void;
  onShareSimulationToAgent: (sim: SimulationSnapshot) => void;
}) {
  const [extraCostInput, setExtraCostInput] = useState("3000");
  const [cancelledMemberId, setCancelledMemberId] = useState("");
  const [simulation, setSimulation] = useState<SimulationSnapshot | null>(null);
  const [simError, setSimError] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatBudget, setNewCatBudget] = useState("");
  const [catError, setCatError] = useState("");

  const symbol = getCurrencySymbol(currency);
  const remainingAgreed = totalBudget - totalSpent;
  const remainingDraft = draftTotal - totalSpent;
  const hasChanges = draftCategories.some(
    (item, idx) => item.budget !== (categories[idx]?.budget ?? item.budget),
  );

  const runSimulation = () => {
    const parsedExtra = Number(extraCostInput);
    if (!Number.isFinite(parsedExtra) || parsedExtra < 0 || parsedExtra > 100_000_000) {
      setSimError("Enter a valid non-negative cost up to 100,000,000.");
      return;
    }
    try {
      const result = simulateBudget(categories, members, parsedExtra, cancelledMemberId || undefined);
      const cancelledMember = members.find((m) => m.id === cancelledMemberId);
      setSimulation({
        ...result,
        cancelledName: cancelledMember?.name,
      });
      setSimError("");
    } catch (error) {
      setSimError(error instanceof Error ? error.message : "Could not run simulation.");
    }
  };

  const handleAddCategory = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = newCatName.trim();
    const parsed = Number(newCatBudget || "0");
    if (!trimmed || trimmed.length > 80) {
      setCatError("Enter a category name under 80 characters.");
      return;
    }
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100_000_000) {
      setCatError("Enter a valid non-negative budget amount.");
      return;
    }
    if (categories.some((c) => c.label.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      setCatError(`${trimmed} already exists.`);
      return;
    }
    setCatError("");
    onAddCategory(trimmed, Math.round(parsed * 100) / 100);
    setNewCatName("");
    setNewCatBudget("");
  };

  return (
    <div className="workspace-grid">
      <section className="panel planner-panel">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">{groupName.toUpperCase()} · BUDGET</div>
            <h2>Shape your shared plan.</h2>
          </div>
          <span className="save-badge">
            <span /> {money(remainingAgreed, currency)} remaining
          </span>
        </div>

        <p className="muted-copy">
          Edit category caps below. Save a draft for discussion or apply changes directly to recalculate the
          group&apos;s agreed budget and remaining balance.
        </p>

        {draftCategories.map((category) => {
          const pct = Math.round((category.spent / Math.max(category.budget, 1)) * 100);
          const overDraft = category.spent > category.budget;
          return (
            <label className="budget-edit-row" key={category.id}>
              <span className="legend-dot" style={{ background: category.color }} />
              <span className="budget-edit-label">
                <span>{category.label}</span>
                <small className={overDraft ? "warn-text" : ""}>
                  {money(category.spent, currency)} spent{overDraft ? " · over draft cap" : ""}
                </small>
              </span>

              <span className="currency-input">
                <span>{symbol}</span>
                <input
                  aria-label={`${category.label} budget proposal`}
                  inputMode="decimal"
                  type="number"
                  min="0"
                  max="100000000"
                  step="any"
                  value={category.budget}
                  disabled={isArchived}
                  onChange={(event) => onUpdateCategory(category.id, Number(event.target.value))}
                />
              </span>

              <span className="category-progress">
                <ProgressBar
                  value={pct}
                  color={overDraft ? "#c96f4a" : category.color}
                  label={`${category.label} spent percentage`}
                />
                <small className="tabular">{pct}%</small>
              </span>
            </label>
          );
        })}

        {!isArchived && (
          <form className="add-category-inline" onSubmit={handleAddCategory}>
            <input
              aria-label="New budget category name"
              placeholder="Add category (e.g. Gear, Tickets)"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
            />
            <input
              aria-label="New budget category amount"
              type="number"
              min="0"
              step="any"
              placeholder={`Budget (${symbol})`}
              value={newCatBudget}
              onChange={(e) => setNewCatBudget(e.target.value)}
            />
            <button type="submit" className="button button-outline button-sm">
              <Plus size={13} /> Add
            </button>
          </form>
        )}
        {catError && (
          <p className="form-error" role="alert">
            {catError}
          </p>
        )}

        <div className="planner-total">
          <div>
            <small>
              DRAFT TOTAL · {members.length} MEMBER{members.length === 1 ? "" : "S"}
            </small>
            <strong className="tabular">{money(draftTotal, currency)}</strong>
            <small>
              Remaining after {money(totalSpent, currency)} spend:{" "}
              <span className={remainingDraft < 0 ? "warn-text" : "positive"}>
                {money(remainingDraft, currency)}
              </span>
            </small>
          </div>
          <div className="per-person tabular">
            {money(draftTotal / Math.max(members.length, 1), currency)}
            <small>
              suggested per person (agreed: {money(totalBudget / Math.max(members.length, 1), currency)})
            </small>
          </div>
        </div>

        <div className="proposal-actions">
          <button
            type="button"
            className="button button-outline"
            disabled={isArchived || (!hasChanges && !proposalRequested)}
            onClick={onDiscardDraft}
          >
            Discard draft
          </button>
          <button
            type="button"
            className="button button-outline"
            disabled={isArchived}
            onClick={onRequestApproval}
          >
            Save proposal <ArrowUpRight size={14} />
          </button>
          <button
            type="button"
            className="button button-dark"
            disabled={isArchived || !hasChanges}
            onClick={onRequestApplyBudget}
          >
            <Check size={14} /> Apply budget update
          </button>
        </div>

        {proposalRequested && (
          <div className="proposal-status" role="status">
            <Clock3 size={15} />
            <span>
              <strong>Draft proposal saved for {groupName}.</strong>
              <br />
              Agreed budget remains {money(totalBudget, currency)} until you click &ldquo;Apply budget
              update&rdquo;.
            </span>
          </div>
        )}
      </section>

      <aside className="panel planner-aside">
        <div className="section-kicker">YOUR MONEY TWIN</div>
        <h2>
          Plans change.
          <br />
          <span>Your math doesn&apos;t have to.</span>
        </h2>
        <p>Run a non-destructive what-if against {groupName}&apos;s agreed budget before updating it.</p>

        <label className="form-label">
          Unexpected expense ({symbol})
          <input
            type="number"
            min="0"
            max="100000000"
            value={extraCostInput}
            onChange={(event) => {
              setExtraCostInput(event.target.value);
              setSimError("");
            }}
          />
        </label>

        <div className="preset-chips" aria-label="Quick unexpected expense presets">
          {["1500", "3000", "5000"].map((preset) => (
            <button
              type="button"
              key={preset}
              className={`preset-chip ${extraCostInput === preset ? "active" : ""}`}
              onClick={() => setExtraCostInput(preset)}
            >
              +{money(Number(preset), currency)}
            </button>
          ))}
        </div>

        <label className="form-label">
          Member who might cancel
          <select value={cancelledMemberId} onChange={(event) => setCancelledMemberId(event.target.value)}>
            <option value="">No one — keep all {members.length}</option>
            {members.map((member) => (
              <option value={member.id} key={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>

        {simError && (
          <p className="form-error" role="alert">
            {simError}
          </p>
        )}

        <button type="button" className="button button-dark full-button" onClick={runSimulation}>
          <Sparkles size={14} /> Run MoneyTwin simulation
        </button>

        {simulation && (
          <div className="simulation-result-card" role="region" aria-label="MoneyTwin simulation result">
            <div className="simulation-badge">
              <span>SIMULATION ONLY</span>
              <span>{simulation.activeMembers} active</span>
            </div>

            <div className="simulation-metrics">
              <div>
                <small>New per-person share</small>
                <strong className="tabular">{money(simulation.perPerson, currency)}</strong>
              </div>
              <div>
                <small>Delta vs current</small>
                <strong className="tabular delta-up">
                  +{money(Math.max(0, simulation.perPerson - simulation.previousPerPerson), currency)}
                </strong>
              </div>
            </div>

            <div className="simulation-details">
              <div>
                <span>Scenario total</span>
                <strong className="tabular">{money(simulation.revisedBudget, currency)}</strong>
              </div>
              <div>
                <span>Extra cost</span>
                <strong className="tabular">{money(simulation.extraCost, currency)}</strong>
              </div>
              {simulation.cancelledName && (
                <div>
                  <span>Cancelled</span>
                  <strong>{simulation.cancelledName}</strong>
                </div>
              )}
            </div>

            <button
              type="button"
              className="button button-outline full-button"
              onClick={() => onShareSimulationToAgent(simulation)}
            >
              <Send size={13} /> Post to AI Money Mind
            </button>
          </div>
        )}

        <div className="safety-note">
          <LockKeyhole size={14} />
          <span>Simulations never alter your group&apos;s agreed plan.</span>
        </div>
      </aside>
    </div>
  );
}
