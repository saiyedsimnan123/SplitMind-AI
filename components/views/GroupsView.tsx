"use client";

import { ArrowUpRight, ShieldCheck, UserPlus, Users } from "lucide-react";
import type { MemberBalance, Screen } from "@/lib/types";
import { Avatar, money } from "@/components/ui";

export function GroupsView({
  balances,
  totalBudget,
  totalSpent,
  onOpenAddMember,
  onSelectScreen,
}: {
  balances: MemberBalance[];
  totalBudget: number;
  totalSpent: number;
  onOpenAddMember: () => void;
  onSelectScreen: (screen: Screen) => void;
}) {
  const equalShare = totalSpent / Math.max(balances.length, 1);
  const plannedPerPerson = totalBudget / Math.max(balances.length, 1);

  return (
    <div className="stack-layout">
      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">GROUP WORKSPACE · NOV 14–16, 2026</div>
            <h2>Goa Trip 2026 Roster</h2>
          </div>
          <div className="header-actions-inline">
            <button type="button" className="button button-outline" onClick={() => onSelectScreen("Settlements")}>
              Settlement plan <ArrowUpRight size={14} />
            </button>
            <button type="button" className="button button-dark" onClick={onOpenAddMember}>
              <UserPlus size={15} /> Add member
            </button>
          </div>
        </div>

        <div className="kpi-inline-strip">
          <div className="kpi-inline-card">
            <span>Active members</span>
            <strong className="tabular">{balances.length} friends</strong>
          </div>
          <div className="kpi-inline-card">
            <span>Planned per person</span>
            <strong className="tabular">{money(plannedPerPerson)}</strong>
          </div>
          <div className="kpi-inline-card">
            <span>Current equal spend share</span>
            <strong className="tabular">{money(equalShare)}</strong>
          </div>
          <div className="kpi-inline-card">
            <span>Submitted spend total</span>
            <strong className="tabular">{money(totalSpent)}</strong>
          </div>
        </div>

        <div className="member-ledger" role="region" aria-label="Member contributions and balances">
          <div className="member-ledger-head">
            <span>MEMBER</span>
            <span className="text-right">PAID</span>
            <span className="text-right">EQUAL SHARE</span>
            <span className="text-right">NET POSITION</span>
          </div>

          {balances.map((member) => {
            const isAhead = member.balance >= 1;
            const owes = member.outstanding >= 1;
            return (
              <div className="member-ledger-row" key={member.id}>
                <div className="member-cell">
                  <Avatar member={member} size="md" />
                  <div>
                    <strong>{member.name}</strong>
                    <small>{member.id === "m1" ? "Workspace owner (local)" : "Trip member"}</small>
                  </div>
                </div>

                <div className="text-right tabular">
                  <strong>{money(member.paid)}</strong>
                </div>

                <div className="text-right tabular muted-cell">{money(member.share)}</div>

                <div className="text-right">
                  <span
                    className={`status-pill tabular ${
                      owes ? "status-pill-unverified" : "status-pill-verified"
                    }`}
                  >
                    {owes
                      ? `Owes ${money(member.outstanding)}`
                      : isAhead
                        ? `Ahead +${money(member.balance)}`
                        : "Settled"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="safety-note">
          <ShieldCheck size={14} />
          <span>
            <Users size={12} style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }} />
            Group data in this demo stays in your browser&apos;s local storage and is not synced across devices.
          </span>
        </div>
      </section>
    </div>
  );
}
