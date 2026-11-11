"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  CheckCircle2,
  Crown,
  FolderPlus,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PLAN_TYPE_LABELS } from "@/lib/finance";
import { getGroupSummary } from "@/lib/groups";
import type { GroupMember, GroupRecord, MemberBalance, PlanType, Screen } from "@/lib/types";
import { Avatar, EngineBadge, ProgressBar, formatGroupDates, money, planTypeLabel } from "@/components/ui";

export function GroupsView({
  groups,
  activeGroup,
  balances,
  totalBudget,
  totalSpent,
  onSelectGroup,
  onOpenCreateGroup,
  onOpenEditGroup,
  onRequestArchiveGroup,
  onRestoreGroup,
  onOpenAddMember,
  onOpenEditMember,
  onRequestMakeOwner,
  onRequestRemoveMember,
  onOpenRecordContribution,
  onSelectScreen,
}: {
  groups: GroupRecord[];
  activeGroup: GroupRecord;
  balances: MemberBalance[];
  totalBudget: number;
  totalSpent: number;
  onSelectGroup: (groupId: string) => void;
  onOpenCreateGroup: () => void;
  onOpenEditGroup: (group: GroupRecord) => void;
  onRequestArchiveGroup: (group: GroupRecord) => void;
  onRestoreGroup: (group: GroupRecord) => void;
  onOpenAddMember: () => void;
  onOpenEditMember: (member: GroupMember) => void;
  onRequestMakeOwner: (member: GroupMember) => void;
  onRequestRemoveMember: (member: GroupMember) => void;
  onOpenRecordContribution: () => void;
  onSelectScreen: (screen: Screen) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");
  const [typeFilter, setTypeFilter] = useState<PlanType | "all">("all");

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return groups.filter((group) => {
      if (statusFilter === "active" && group.archivedAt) return false;
      if (statusFilter === "archived" && !group.archivedAt) return false;
      if (typeFilter !== "all" && group.planType !== typeFilter) return false;
      if (q) {
        const hay = `${group.name} ${group.description} ${group.currency} ${planTypeLabel(group.planType)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [groups, searchQuery, statusFilter, typeFilter]);

  const activeCount = groups.filter((g) => !g.archivedAt).length;
  const archivedCount = groups.length - activeCount;
  const equalShare = totalSpent / Math.max(balances.length, 1);
  const plannedPerPerson = totalBudget / Math.max(balances.length, 1);
  const isArchived = Boolean(activeGroup.archivedAt);

  return (
    <div className="stack-layout">
      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <div className="panel-kicker-row">
              <span className="section-kicker">MULTI-GROUP DIRECTORY</span>
              <EngineBadge engine="smartsplit" />
            </div>
            <h2>All shared plans ({groups.length})</h2>
          </div>
          <button type="button" className="button button-primary" onClick={onOpenCreateGroup}>
            <FolderPlus size={15} /> Create new group
          </button>
        </div>

        <p className="muted-copy">
          Each group maintains completely isolated budgets, expenses, member contributions, and settlement math.
        </p>

        <div className="filter-toolbar">
          <div className="filter-pills" role="tablist" aria-label="Filter groups by archive status">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "active"}
              className={`filter-pill ${statusFilter === "active" ? "active" : ""}`}
              onClick={() => setStatusFilter("active")}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "archived"}
              className={`filter-pill ${statusFilter === "archived" ? "active" : ""}`}
              onClick={() => setStatusFilter("archived")}
            >
              Archived ({archivedCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "all"}
              className={`filter-pill ${statusFilter === "all" ? "active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              All ({groups.length})
            </button>
          </div>

          <div className="search-filter-pair">
            <label className="search-input-box">
              <Search size={14} />
              <input
                aria-label="Search groups"
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>

            <select
              aria-label="Filter by plan type"
              className="compact-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as PlanType | "all")}
            >
              <option value="all">All plan types</option>
              {(Object.keys(PLAN_TYPE_LABELS) as PlanType[]).map((key) => (
                <option key={key} value={key}>
                  {PLAN_TYPE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredGroups.length === 0 ? (
          <div className="empty-state">
            <Users size={22} />
            <strong>No groups match this view.</strong>
            <span>Create a new group or clear your search and status filters.</span>
            <button type="button" className="button button-primary" onClick={onOpenCreateGroup}>
              <FolderPlus size={14} /> Create new group
            </button>
          </div>
        ) : (
          <div className="groups-card-grid">
            {filteredGroups.map((group) => {
              const summary = getGroupSummary(group);
              const isSelected = group.id === activeGroup.id;
              const pct =
                summary.totalBudget > 0 ? Math.round((summary.totalSpent / summary.totalBudget) * 100) : 0;
              const remaining = summary.totalBudget - summary.totalSpent;

              return (
                <article
                  key={group.id}
                  className={`group-summary-card ${isSelected ? "group-summary-card-active" : ""} ${
                    group.archivedAt ? "group-summary-card-archived" : ""
                  }`}
                >
                  <div className="group-card-top">
                    <div className="group-card-badges">
                      <span className="category-pill">{planTypeLabel(group.planType)}</span>
                      <span className="currency-badge">{group.currency}</span>
                      {group.archivedAt && (
                        <span className="status-pill status-pill-unverified">Archived</span>
                      )}
                      {isSelected && (
                        <span className="status-pill status-pill-verified">
                          <CheckCircle2 size={11} /> Active
                        </span>
                      )}
                    </div>
                  </div>

                  <h3>{group.name}</h3>
                  <p className="group-card-desc">
                    {group.description || formatGroupDates(group.startDate, group.endDate)}
                  </p>
                  <small className="group-card-dates">
                    {formatGroupDates(group.startDate, group.endDate)} · Organizer:{" "}
                    {summary.ownerMember?.name ?? "Owner"}
                  </small>

                  <div className="group-card-metrics">
                    <div>
                      <span>Budget</span>
                      <strong className="tabular">{money(summary.totalBudget, group.currency)}</strong>
                    </div>
                    <div>
                      <span>Spent</span>
                      <strong className="tabular">{money(summary.totalSpent, group.currency)}</strong>
                    </div>
                    <div>
                      <span>Remaining</span>
                      <strong className={`tabular ${remaining < 0 ? "warn-text" : "positive"}`}>
                        {money(remaining, group.currency)}
                      </strong>
                    </div>
                  </div>

                  <ProgressBar
                    value={pct}
                    color={pct > 95 ? "var(--danger)" : "var(--brand)"}
                    label={`${group.name} budget usage`}
                  />

                  <div className="group-card-footer">
                    <div className="avatar-stack">
                      {group.members.slice(0, 4).map((m) => (
                        <Avatar key={m.id} member={m} size="sm" />
                      ))}
                      {group.members.length > 4 && (
                        <span className="stack-more">+{group.members.length - 4}</span>
                      )}
                    </div>

                    <div className="group-card-actions">
                      {!isSelected && (
                        <button
                          type="button"
                          className="button button-outline button-sm"
                          onClick={() => onSelectGroup(group.id)}
                        >
                          Open
                        </button>
                      )}
                      <button
                        type="button"
                        className="row-icon-btn"
                        onClick={() => onOpenEditGroup(group)}
                        title={`Edit ${group.name}`}
                        aria-label={`Edit ${group.name}`}
                      >
                        <Pencil size={13} />
                      </button>
                      {group.archivedAt ? (
                        <button
                          type="button"
                          className="row-icon-btn"
                          onClick={() => onRestoreGroup(group)}
                          title={`Restore ${group.name}`}
                          aria-label={`Restore ${group.name}`}
                        >
                          <ArchiveRestore size={13} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="row-icon-btn row-icon-btn-danger"
                          onClick={() => onRequestArchiveGroup(group)}
                          title={`Archive ${group.name}`}
                          aria-label={`Archive ${group.name}`}
                        >
                          <Archive size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">
              SELECTED GROUP · {formatGroupDates(activeGroup.startDate, activeGroup.endDate).toUpperCase()}
            </div>
            <h2>{activeGroup.name} Roster &amp; Contributions</h2>
          </div>
          <div className="header-actions-inline">
            <button type="button" className="button button-outline" onClick={() => onSelectScreen("Settlements")}>
              Settlement plan <ArrowUpRight size={14} />
            </button>
            <button
              type="button"
              className="button button-outline"
              onClick={onOpenRecordContribution}
              disabled={isArchived || activeGroup.members.length < 2}
            >
              <Plus size={14} /> Record contribution
            </button>
            <button type="button" className="button button-primary" onClick={onOpenAddMember} disabled={isArchived}>
              <UserPlus size={15} /> Add member
            </button>
          </div>
        </div>

        <div className="kpi-inline-strip">
          <div className="kpi-inline-card">
            <span>Active members</span>
            <strong className="tabular">{balances.length}</strong>
          </div>
          <div className="kpi-inline-card">
            <span>Planned per person</span>
            <strong className="tabular">{money(plannedPerPerson, activeGroup.currency)}</strong>
          </div>
          <div className="kpi-inline-card">
            <span>Current equal spend share</span>
            <strong className="tabular">{money(equalShare, activeGroup.currency)}</strong>
          </div>
          <div className="kpi-inline-card">
            <span>Submitted spend total</span>
            <strong className="tabular">{money(totalSpent, activeGroup.currency)}</strong>
          </div>
        </div>

        <div className="member-ledger" role="region" aria-label="Member contributions and balances">
          <div className="member-ledger-head member-ledger-head-actions">
            <span>MEMBER</span>
            <span className="text-right">PAID</span>
            <span className="text-right">EQUAL SHARE</span>
            <span className="text-right">NET POSITION</span>
            <span className="text-right">MANAGE</span>
          </div>

          {balances.map((member) => {
            const isAhead = member.balance >= 1;
            const owes = member.outstanding >= 1;
            const fullMember = activeGroup.members.find((m) => m.id === member.id)!;
            const isOwner = fullMember?.role === "owner" || fullMember?.id === activeGroup.ownerMemberId;

            return (
              <div className="member-ledger-row member-ledger-row-actions" key={member.id}>
                <div className="member-cell">
                  <Avatar member={member} size="md" />
                  <div>
                    <strong>
                      {member.name}{" "}
                      {isOwner && (
                        <span className="owner-tag" title="Group owner / organizer">
                          <Crown size={11} /> Owner
                        </span>
                      )}
                      {!isOwner && fullMember?.role === "organizer" && (
                        <span className="organizer-tag">Organizer</span>
                      )}
                    </strong>
                    <small>{fullMember?.email || (isOwner ? "Primary group organizer" : "Group member")}</small>
                  </div>
                </div>

                <div className="text-right tabular">
                  <strong>{money(member.paid, activeGroup.currency)}</strong>
                </div>

                <div className="text-right tabular muted-cell">
                  {money(member.share, activeGroup.currency)}
                </div>

                <div className="text-right">
                  <span
                    className={`status-pill tabular ${
                      owes ? "status-pill-unverified" : "status-pill-verified"
                    }`}
                  >
                    {owes
                      ? `Owes ${money(member.outstanding, activeGroup.currency)}`
                      : isAhead
                        ? `Ahead +${money(member.balance, activeGroup.currency)}`
                        : "Settled"}
                  </span>
                </div>

                <div className="member-row-actions">
                  {!isArchived && fullMember && (
                    <>
                      <button
                        type="button"
                        className="row-icon-btn"
                        onClick={() => onOpenEditMember(fullMember)}
                        title={`Edit ${member.name}`}
                        aria-label={`Edit ${member.name}`}
                      >
                        <Pencil size={12} />
                      </button>
                      {!isOwner && (
                        <button
                          type="button"
                          className="row-icon-btn"
                          onClick={() => onRequestMakeOwner(fullMember)}
                          title={`Make ${member.name} group owner`}
                          aria-label={`Transfer ownership to ${member.name}`}
                        >
                          <Crown size={12} />
                        </button>
                      )}
                      {!isOwner && (
                        <button
                          type="button"
                          className="row-icon-btn row-icon-btn-danger"
                          onClick={() => onRequestRemoveMember(fullMember)}
                          title={`Remove ${member.name}`}
                          aria-label={`Remove ${member.name}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {activeGroup.contributions.length > 0 && (
          <>
            <h3 className="ledger-heading">Group contribution ledger</h3>
            <div className="audit-list">
              {activeGroup.contributions.slice(0, 8).map((item) => (
                <div className="audit-row" key={item.id}>
                  <span className="activity-icon activity-verified">
                    <ShieldCheck size={14} />
                  </span>
                  <span className="audit-copy">
                    <strong>
                      {item.memberName}
                      {item.recipientName ? ` → ${item.recipientName}` : ""} ·{" "}
                      {money(item.amount, activeGroup.currency)}
                    </strong>
                    <small>
                      {item.source.replace("_", " ")} · {item.note}
                    </small>
                  </span>
                  <time>{new Date(item.createdAt).toLocaleDateString()}</time>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
