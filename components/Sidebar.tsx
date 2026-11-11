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

export const navGroups: {
  title: string;
  items: { label: Screen; displayLabel?: string; icon: typeof LayoutDashboard }[];
}[] = [
  {
    title: "CORE WORKSPACE",
    items: [
      { label: "Overview", displayLabel: "Dashboard", icon: LayoutDashboard },
      { label: "Groups", icon: WalletCards },
      { label: "Expenses", icon: ReceiptText },
      { label: "Settlements", icon: ArrowDownLeft },
    ],
  },
  {
    title: "FINANCIAL ENGINES",
    items: [
      { label: "Budget planner", displayLabel: "Budget & MoneyTwin", icon: ArrowLeftRight },
      { label: "Payments", displayLabel: "IntentPay", icon: CreditCard },
      { label: "AI Financial Agent", displayLabel: "AI Financial Agent", icon: Bot },
    ],
  },
  {
    title: "GOVERNANCE",
    items: [
      { label: "Activity", icon: Clock3 },
      { label: "Settings", icon: Settings2 },
    ],
  },
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
  isDemo,
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
  isDemo?: boolean;
  unverifiedCount: number;
  auditCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const demoMode = Boolean(isDemo || currentUser?.isDemo);
  const activeGroups = groups.filter((group) => !group.archivedAt);
  const groupIconChar = activeGroup.name.trim()[0]?.toUpperCase() || "G";

  return (
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`} aria-label="Workspace sidebar">
      <div className="sidebar-brand-row">
        <a
          className="brand brand-light"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            onSelectScreen("Overview");
          }}
        >
          <BrandMark />
          <span className="brand-name brand-name-light">
            SplitMind<span> AI</span>
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
                    {selected && <Check size={14} className="teal-accent" />}
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
                <FolderPlus size={14} /> Create group
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

      <nav className="nav-sections" aria-label="Main navigation">
        {navGroups.map((section) => (
          <div key={section.title} className="nav-section">
            <div className="side-label">{section.title}</div>
            <div className="nav-list">
              {section.items.map(({ label, displayLabel, icon: Icon }) => {
                const isActive = screen === label && !(label === "Settings" && settingsTab === "security");
                return (
                  <button
                    type="button"
                    key={label}
                    onClick={() => onSelectScreen(label)}
                    className={`nav-item ${isActive ? "active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon size={16} strokeWidth={1.9} />
                    <span>{displayLabel ?? label}</span>
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

              {section.title === "GOVERNANCE" && (
                <button
                  type="button"
                  onClick={onOpenSecuritySettings}
                  className={`nav-item ${
                    screen === "Settings" && settingsTab === "security" ? "active" : ""
                  }`}
                  aria-current={screen === "Settings" && settingsTab === "security" ? "page" : undefined}
                >
                  <LockKeyhole size={16} strokeWidth={1.9} />
                  <span>Security &amp; Activity</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="upgrade-card">
          <div className="upgrade-card-top">
            <span className="upgrade-icon">
              <Sparkles size={14} />
            </span>
            <span className="upgrade-pill">
              <ShieldCheck size={12} />{" "}
              {demoMode ? "DEMO Session" : authConfigured ? "RLS Verified" : "Protected"}
            </span>
          </div>
          <strong>Smart Money Mind</strong>
          <p>Deterministic SmartSplit, Proof review, MoneyTwin &amp; IntentPay.</p>
          <button
            type="button"
            className="upgrade-link"
            onClick={() => onSelectScreen("AI Financial Agent")}
          >
            Launch AI Agent <ArrowUpRight size={13} />
          </button>
        </div>

        <button type="button" className="profile-button" onClick={() => onSelectScreen("Settings")}>
          <span className="profile-avatar">{currentUser?.initials ?? "SM"}</span>
          <span className="profile-meta">
            <strong>{demoMode ? "Demo Explorer (DEMO)" : (currentUser?.fullName ?? "Account")}</strong>
            <small>{demoMode ? "Sample workspace · Isolated" : (currentUser?.email || "Workspace member")}</small>
          </span>
          <MoreHorizontal size={17} />
        </button>
      </div>
    </aside>
  );
}
