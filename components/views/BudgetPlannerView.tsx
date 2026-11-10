"use client";

import { ArrowUpRight, Clock3, LockKeyhole, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { simulateBudget, type Category, type Member } from "@/lib/finance";
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
  categories,
  draftCategories,
  members,
  totalBudget,
  draftTotal,
  proposalRequested,
  onUpdateCategory,
  onDiscardDraft,
  onRequestApproval,
  onShareSimulationToAgent,
}: {
  categories: Category[];
  draftCategories: Category[];
  members: Member[];
  totalBudget: number;
  draftTotal: number;
  proposalRequested: boolean;
  onUpdateCategory: (id: string, value: number) => void;
  onDiscardDraft: () => void;
  onRequestApproval: () => void;
  onShareSimulationToAgent: (sim: SimulationSnapshot) => void;
}) {
  const [extraCostInput, setExtraCostInput] = useState("3000");
  const [cancelledMemberId, setCancelledMemberId] = useState("");
  const [simulation, setSimulation] = useState<SimulationSnapshot | null>(null);
  const [simError, setSimError] = useState("");

  const hasChanges = draftCategories.some(
    (item, idx) => item.budget !== (categories[idx]?.budget ?? item.budget),
  );

  const runSimulation = () => {
    const parsedExtra = Number(extraCostInput);
    if (!Number.isFinite(parsedExtra) || parsedExtra < 0 || parsedExtra > 100_000_000) {
      setSimError("Enter a valid non-negative cost up to ₹10 crore.");
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

  return (
    <div className="workspace-grid">
      <section className="panel planner-panel">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">YOUR SHARED PLAN</div>
            <h2>Give every rupee a reason.</h2>
          </div>
          <span className="save-badge">
            <span /> Draft saves on this device
          </span>
        </div>

        <p className="muted-copy">
          Adjust a draft and see per-person estimates update immediately. Your agreed group budget stays
          unchanged until the group reviews the proposal.
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
                  {money(category.spent)} spent so far{overDraft ? " · over draft cap" : ""}
                </small>
              </span>

              <span className="currency-input">
                <span>₹</span>
                <input
                  aria-label={`${category.label} budget proposal`}
                  inputMode="numeric"
                  type="number"
                  min="0"
                  max="100000000"
                  value={category.budget}
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

        <div className="planner-total">
          <div>
            <small>DRAFT TOTAL · {members.length} FRIENDS</small>
            <strong className="tabular">{money(draftTotal)}</strong>
          </div>
          <div className="per-person tabular">
            {money(draftTotal / Math.max(members.length, 1))}
            <small>suggested per person (agreed: {money(totalBudget / Math.max(members.length, 1))})</small>
          </div>
        </div>

        <div className="proposal-actions">
          <button
            type="button"
            className="button button-outline"
            disabled={!hasChanges && !proposalRequested}
            onClick={onDiscardDraft}
          >
            Discard draft
          </button>
          <button type="button" className="button button-dark" onClick={onRequestApproval}>
            Request group approval <ArrowUpRight size={14} />
          </button>
        </div>

        {proposalRequested && (
          <div className="proposal-status" role="status">
            <Clock3 size={15} />
            <span>
              <strong>Proposal saved for group review.</strong>
              <br />
              The agreed budget remains {money(totalBudget)}. Group approval is not simulated in this local
              demo.
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
        <p>Run a non-destructive what-if against the agreed budget before raising it with friends.</p>

        <label className="form-label">
          Unexpected expense (₹)
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
              +₹{Number(preset).toLocaleString("en-IN")}
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
                <strong className="tabular">{money(simulation.perPerson)}</strong>
              </div>
              <div>
                <small>Delta vs current</small>
                <strong className="tabular delta-up">
                  +{money(Math.max(0, simulation.perPerson - simulation.previousPerPerson))}
                </strong>
              </div>
            </div>

            <div className="simulation-details">
              <div>
                <span>Scenario total</span>
                <strong className="tabular">{money(simulation.revisedBudget)}</strong>
              </div>
              <div>
                <span>Extra cost</span>
                <strong className="tabular">{money(simulation.extraCost)}</strong>
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
