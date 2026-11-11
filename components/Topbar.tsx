"use client";

import { Bell, Bot, ChevronRight, LockKeyhole, LogOut, Menu, ShieldCheck } from "lucide-react";
import type { AuthUser, CurrencyCode, Screen } from "@/lib/types";

export function Topbar({
  screen,
  groupName,
  groupCurrency,
  unverifiedCount,
  authConfigured,
  currentUser,
  onOpenMobileNav,
  onOpenExpenses,
  onOpenCopilot,
  onOpenSettings,
  onOpenSecuritySettings,
  onLogout,
}: {
  screen: Screen;
  groupName: string;
  groupCurrency: CurrencyCode;
  unverifiedCount: number;
  authConfigured: boolean;
  currentUser: AuthUser | null;
  onOpenMobileNav: () => void;
  onOpenExpenses: () => void;
  onOpenCopilot: () => void;
  onOpenSettings: () => void;
  onOpenSecuritySettings: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="mobile-menu"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <span className="breadcrumb">{groupName}</span>
        <span className="currency-badge">{groupCurrency}</span>
        <ChevronRight size={14} className="breadcrumb-sep" />
        <strong>{screen === "Overview" ? "Dashboard" : screen}</strong>
      </div>

      <div className="topbar-actions">
        <span
          className="sync-status"
          title="Authenticated via Supabase HttpOnly session and Row Level Security"
        >
          <ShieldCheck size={13} className="teal-accent" />
          <span className="sync-text">{authConfigured ? "RLS Session Active" : "Protected"}</span>
        </span>

        <button
          type="button"
          className="copilot-trigger"
          onClick={onOpenCopilot}
          aria-label="Open AI Group Financial Agent"
        >
          <Bot size={15} />
          <span>AI Agent</span>
        </button>

        <button
          type="button"
          className="icon-button"
          onClick={onOpenSecuritySettings}
          aria-label="Open Security and Activity settings"
          title="Security & Activity"
        >
          <LockKeyhole size={16} />
        </button>

        <button
          type="button"
          className="icon-button"
          onClick={onOpenExpenses}
          aria-label={
            unverifiedCount > 0
              ? `${unverifiedCount} unverified expenses pending receipt review`
              : "All expenses reviewed"
          }
          title={
            unverifiedCount > 0
              ? `${unverifiedCount} expenses awaiting Proof Engine review`
              : "View expenses"
          }
        >
          <Bell size={17} />
          {unverifiedCount > 0 && <i aria-hidden="true" />}
        </button>

        {currentUser && (
          <>
            <button
              type="button"
              className="top-avatar"
              onClick={onOpenSettings}
              aria-label={`Workspace settings for ${currentUser.fullName}`}
              title={`${currentUser.fullName} · Account settings`}
            >
              {currentUser.initials}
            </button>
            <button
              type="button"
              className="button button-outline button-sm"
              onClick={onLogout}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={14} />
              <span className="logout-label">Sign out</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
