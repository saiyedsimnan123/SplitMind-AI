"use client";

import { ArrowRight, CheckCircle2, LockKeyhole, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Member } from "@/lib/finance";
import type { MemberBalance, SettlementTransfer } from "@/lib/types";
import { Avatar, money } from "@/components/ui";

export function SettlementsView({
  members,
  balances,
  transfers,
  settlementError,
  totalBudget,
  totalSpent,
}: {
  members: Member[];
  balances: MemberBalance[];
  transfers: SettlementTransfer[];
  settlementError: string;
  totalBudget: number;
  totalSpent: number;
}) {
  const remaining = totalBudget - totalSpent;

  return (
    <div className="workspace-grid">
      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">FEWEST TRANSFERS, CLEAR MATH</div>
            <h2>A fair way to settle up.</h2>
          </div>
          <span className="save-badge">
            <ShieldCheck size={14} /> Suggested, not sent
          </span>
        </div>

        <p className="muted-copy">
          Calculated deterministically from submitted expenses to date. No automatic transfer or wallet debit is
          initiated here.
        </p>

        {settlementError ? (
          <div className="receipt-missing-box" role="alert">
            <ShieldAlert size={18} />
            <div>
              <strong>Reconciliation required</strong>
              <p>{settlementError}</p>
            </div>
          </div>
        ) : transfers.length === 0 ? (
          <div className="empty-state">
            <CheckCircle2 size={22} />
            <strong>Everything is balanced.</strong>
            <span>Every member&apos;s contribution matches their equal share of submitted spend.</span>
          </div>
        ) : (
          <div className="settlement-list" role="list" aria-label="Suggested settlement transfers">
            {transfers.map((transfer, index) => {
              const fromMember = members.find((member) => member.name === transfer.from) ?? members[0];
              const toMember = members.find((member) => member.name === transfer.to) ?? members[0];
              return (
                <div className="settlement-row" role="listitem" key={`${transfer.from}-${transfer.to}-${index}`}>
                  <div className="settlement-party">
                    <Avatar member={fromMember} size="sm" />
                    <strong>{transfer.from}</strong>
                  </div>
                  <span className="settlement-verb">
                    pays <ArrowRight size={14} className="settlement-arrow" />
                  </span>
                  <div className="settlement-party">
                    <Avatar member={toMember} size="sm" />
                    <strong>{transfer.to}</strong>
                  </div>
                  <b className="tabular">{money(transfer.amount)}</b>
                </div>
              );
            })}
          </div>
        )}

        <div className="safety-note">
          <LockKeyhole size={14} />
          <span>SplitMind never holds, escrows, or moves group funds without explicit payer authorization.</span>
        </div>
      </section>

      <aside className="panel">
        <div className="section-kicker">AT A GLANCE</div>
        <h2>Group balance</h2>

        <div className="balance-summary">
          <div>
            <span>Total submitted spend</span>
            <strong className="tabular">{money(totalSpent)}</strong>
          </div>
          <div>
            <span>Budget remaining</span>
            <strong className={`tabular ${remaining < 0 ? "warn-text" : ""}`}>{money(remaining)}</strong>
          </div>
          <div>
            <span>Suggested transfers</span>
            <strong className="tabular">
              {settlementError ? "—" : `${transfers.length} transfer${transfers.length === 1 ? "" : "s"}`}
            </strong>
          </div>
        </div>

        <div className="mini-balances">
          <div className="section-kicker" style={{ marginBottom: 8 }}>
            NET MEMBER BALANCES
          </div>
          {balances.map((member) => (
            <div className="mini-balance-row" key={member.id}>
              <span>{member.name}</span>
              <strong
                className={`tabular ${
                  member.outstanding >= 1 ? "warn-text" : member.balance >= 1 ? "positive" : ""
                }`}
              >
                {member.balance >= 0.01 ? `+${money(member.balance)}` : money(member.balance)}
              </strong>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
