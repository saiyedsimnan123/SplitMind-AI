"use client";

import { Bell, Bot, ChevronRight, LockKeyhole, LogIn, LogOut, Menu } from "lucide-react";
import Link from "next/link";
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
        <strong>{screen}</strong>
      </div>

      <div className="topbar-actions">
        <span
          className="sync-status"
          title={
            authConfigured
              ? "Authenticated via Supabase HttpOnly session and Row Level Security"
              : "Running in local preview mode; configure Supabase env vars for live auth and sync"
          }
        >
          <span className={`sync-dot ${authConfigured ? "" : "sync-dot-amber"}`} />
          <span className="sync-text">{authConfigured ? "Supabase RLS synced" : "Local preview"}</span>
        </span>

        <button
          type="button"
          className="copilot-trigger"
          onClick={onOpenCopilot}
          aria-label="Open AI Money Mind assistant"
        >
          <Bot size={15} />
          <span>Money Mind</span>
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
              ? `${unverifiedCount} expenses awaiting receipt review`
              : "View expenses"
          }
        >
          <Bell size={17} />
          {unverifiedCount > 0 && <i aria-hidden="true" />}
        </button>

        {authConfigured && currentUser ? (
          <>
            <button
              type="button"
              className="top-avatar"
              onClick={onOpenSettings}
              aria-label={`Workspace settings for ${currentUser.fullName}`}
              title={`${currentUser.fullName} · Settings`}
            >
              {currentUser.initials}
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={onLogout}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </>
        ) : (
          <Link href="/login" className="button button-outline topbar-auth-link" title="Account sign in">
            <LogIn size={14} /> Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
