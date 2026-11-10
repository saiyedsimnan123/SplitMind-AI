"use client";

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Bot,
  ChevronDown,
  Clock3,
  CreditCard,
  LayoutDashboard,
  MoreHorizontal,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/ui";
import type { Screen } from "@/lib/types";

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
  onSelectScreen,
  memberCount,
  expenseCount,
  unverifiedCount,
  auditCount,
  mobileOpen,
  onCloseMobile,
}: {
  screen: Screen;
  onSelectScreen: (screen: Screen) => void;
  memberCount: number;
  expenseCount: number;
  unverifiedCount: number;
  auditCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
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

      <button type="button" className="group-switcher" onClick={() => onSelectScreen("Groups")}>
        <span className="group-icon">G</span>
        <span className="group-text">
          <strong>Goa Trip 2026</strong>
          <small>{memberCount} members · local demo</small>
        </span>
        <ChevronDown size={15} />
      </button>

      <div className="side-label">WORKSPACE</div>

      <nav className="nav-list" aria-label="Main navigation">
        {navItems.map(({ label, icon: Icon }) => {
          const isActive = screen === label;
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
              {label === "Expenses" && (
                <span
                  className={`nav-count ${unverifiedCount > 0 ? "nav-count-warn" : ""}`}
                  title={
                    unverifiedCount > 0
                      ? `${unverifiedCount} unverified of ${expenseCount} expenses`
                      : `${expenseCount} verified expenses`
                  }
                >
                  {expenseCount}
                </span>
              )}
              {label === "Activity" && auditCount > 0 && <span className="nav-count">{auditCount}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="upgrade-card">
          <div className="upgrade-card-top">
            <span className="upgrade-icon">
              <Sparkles size={15} />
            </span>
            <span className="upgrade-pill">
              <ShieldCheck size={12} /> Local-first
            </span>
          </div>
          <strong>Good money energy.</strong>
          <p>Deterministic math, explicit receipt review, and verifiable Sandbox checkout.</p>
          <button
            type="button"
            className="upgrade-link"
            onClick={() => onSelectScreen("AI Financial Agent")}
          >
            Ask AI Money Mind <ArrowUpRight size={13} />
          </button>
        </div>

        <button type="button" className="profile-button" onClick={() => onSelectScreen("Settings")}>
          <span className="profile-avatar">AK</span>
          <span className="profile-meta">
            <strong>Alex Kim</strong>
            <small>Personal space</small>
          </span>
          <MoreHorizontal size={17} />
        </button>
      </div>
    </aside>
  );
}
