"use client";

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  Clock3,
  CreditCard,
  FolderPlus,
  LayoutDashboard,
  LockKeyhole,
  MoreHorizontal,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { useState } from "react";
import { BrandMark, planTypeLabel } from "@/components/ui";
import type { AuthUser, GroupRecord, Screen, SettingsTab } from "@/lib/types";

export const navItems: { label: Screen; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Groups", icon: WalletCards },
  { label: "Budget planner", icon: ArrowLeftRight },
  { label: "Expenses", icon: ReceiptText },
  { label: "Payments", icon: CreditCard },
  { label: "Settlements", icon: ArrowDownLeft },
  { label: "AI Financial Agent", icon: Bot },
  { label: "Activity", icon: Clock3 },
  { label: "Settings", icon: Settings2 },
];

export function Sidebar({
  screen,
  settingsTab,
  onSelectScreen,
  onOpenSecuritySettings,
  groups,
  activeGroup,
  onSelectGroup,
  onOpenCreateGroup,
  currentUser,
  authConfigured,
  unverifiedCount,
  auditCount,
  mobileOpen,
  onCloseMobile,
}: {
  screen: Screen;
  settingsTab: SettingsTab;
  onSelectScreen: (screen: Screen) => void;
  onOpenSecuritySettings: () => void;
  groups: GroupRecord[];
  activeGroup: GroupRecord;
  onSelectGroup: (groupId: string) => void;
  onOpenCreateGroup: () => void;
  currentUser: AuthUser | null;
  authConfigured: boolean;
  unverifiedCount: number;
  auditCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const activeGroups = groups.filter((group) => !group.archivedAt);
  const groupIconChar = activeGroup.name.trim()[0]?.toUpperCase() || "G";

  return (
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`} aria-label="Workspace sidebar">
      <div className="sidebar-brand-row">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            onSelectScreen("Overview");
          }}
        >
          <BrandMark />
          <span className="brand-name">
            splitmind<span>.</span>
          </span>
        </a>
        <button
          type="button"
          className="icon-button mobile-close-nav"
          onClick={onCloseMobile}
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
      </div>

      <div className="switcher-wrap">
        <button
          type="button"
          className="group-switcher"
          aria-expanded={switcherOpen}
          aria-label={`Switch active group (${activeGroup.name})`}
          onClick={() => setSwitcherOpen((open) => !open)}
        >
          <span className="group-icon">{groupIconChar}</span>
          <span className="group-text">
            <strong>{activeGroup.name}</strong>
            <small>
              {activeGroup.members.length} member{activeGroup.members.length === 1 ? "" : "s"} ·{" "}
              {activeGroup.currency}
            </small>
          </span>
          <ChevronDown size={15} className={switcherOpen ? "chevron-rotated" : ""} />
        </button>

        {switcherOpen && (
          <div className="switcher-popover" role="region" aria-label="Group switcher">
            <div className="switcher-popover-label">SWITCH GROUP ({activeGroups.length})</div>
            <div className="switcher-list">
              {activeGroups.map((group) => {
                const selected = group.id === activeGroup.id;
                return (
                  <button
                    type="button"
                    key={group.id}
                    className={`switcher-option ${selected ? "selected" : ""}`}
                    onClick={() => {
                      onSelectGroup(group.id);
                      setSwitcherOpen(false);
                      onCloseMobile();
                    }}
                  >
                    <span className="switcher-option-badge">
                      {group.name.trim()[0]?.toUpperCase() || "G"}
                    </span>
                    <span className="switcher-option-copy">
                      <strong>{group.name}</strong>
                      <small>
                        {planTypeLabel(group.planType)} · {group.currency}
                      </small>
                    </span>
                    {selected && <Check size={14} className="positive" />}
                  </button>
                );
              })}
            </div>
            <div className="switcher-actions">
              <button
                type="button"
                className="switcher-action-btn"
                onClick={() => {
                  setSwitcherOpen(false);
                  onOpenCreateGroup();
                }}
              >
                <FolderPlus size={14} /> Create new group
              </button>
              <button
                type="button"
                className="switcher-link-btn"
                onClick={() => {
                  setSwitcherOpen(false);
                  onSelectScreen("Groups");
                }}
              >
                All groups
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          className="sidebar-create-group"
          onClick={() => {
            setSwitcherOpen(false);
            onOpenCreateGroup();
          }}
        >
          <FolderPlus size={14} />
          <span>Create new group</span>
        </button>
      </div>

      <div className="side-label">WORKSPACE</div>

      <nav className="nav-list" aria-label="Main navigation">
        {navItems.map(({ label, icon: Icon }) => {
          const isActive = screen === label && !(label === "Settings" && settingsTab === "security");
          return (
            <button
              type="button"
              key={label}
              onClick={() => onSelectScreen(label)}
              className={`nav-item ${isActive ? "active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={17} strokeWidth={1.85} />
              <span>{label}</span>
              {label === "Groups" && (
                <span className="nav-count" title={`${activeGroups.length} active groups`}>
                  {activeGroups.length}
                </span>
              )}
              {label === "Expenses" && (
                <span
                  className={`nav-count ${unverifiedCount > 0 ? "nav-count-warn" : ""}`}
                  title={
                    unverifiedCount > 0
                      ? `${unverifiedCount} unverified of ${activeGroup.expenses.length} expenses`
                      : `${activeGroup.expenses.length} verified expenses`
                  }
                >
                  {activeGroup.expenses.length}
                </span>
              )}
              {label === "Activity" && auditCount > 0 && <span className="nav-count">{auditCount}</span>}
            </button>
          );
        })}

        <button
          type="button"
          onClick={onOpenSecuritySettings}
          className={`nav-item nav-subitem ${
            screen === "Settings" && settingsTab === "security" ? "active" : ""
          }`}
          aria-current={screen === "Settings" && settingsTab === "security" ? "page" : undefined}
        >
          <LockKeyhole size={16} strokeWidth={1.85} />
          <span>Security &amp; Activity</span>
        </button>
      </nav>

      <div className="sidebar-bottom">
        <div className="upgrade-card">
          <div className="upgrade-card-top">
            <span className="upgrade-icon">
              <Sparkles size={15} />
            </span>
            <span className="upgrade-pill">
              <ShieldCheck size={12} /> {authConfigured ? "RLS Synced" : "Local Preview"}
            </span>
          </div>
          <strong>Good money energy.</strong>
          <p>Isolated group ledgers, explicit receipt review, and verifiable Sandbox checkout.</p>
          <button
            type="button"
            className="upgrade-link"
            onClick={() => onSelectScreen("AI Financial Agent")}
          >
            Ask AI Money Mind <ArrowUpRight size={13} />
          </button>
        </div>

        <button type="button" className="profile-button" onClick={() => onSelectScreen("Settings")}>
          <span className="profile-avatar">{currentUser?.initials ?? "LP"}</span>
          <span className="profile-meta">
            <strong>{currentUser?.fullName ?? "Local Preview"}</strong>
            <small>{currentUser?.email ?? "No Supabase session"}</small>
          </span>
          <MoreHorizontal size={17} />
        </button>
      </div>
    </aside>
  );
}
