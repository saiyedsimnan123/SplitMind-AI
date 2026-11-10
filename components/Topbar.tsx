"use client";

import { Bell, Bot, ChevronRight, Menu } from "lucide-react";
import type { Screen } from "@/lib/types";

export function Topbar({
  screen,
  unverifiedCount,
  onOpenMobileNav,
  onOpenExpenses,
  onOpenCopilot,
  onOpenSettings,
}: {
  screen: Screen;
  unverifiedCount: number;
  onOpenMobileNav: () => void;
  onOpenExpenses: () => void;
  onOpenCopilot: () => void;
  onOpenSettings: () => void;
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
        <span className="breadcrumb">Goa Trip 2026</span>
        <ChevronRight size={14} className="breadcrumb-sep" />
        <strong>{screen}</strong>
      </div>

      <div className="topbar-actions">
        <span className="sync-status" title="Demo data saves automatically to this browser">
          <span className="sync-dot" />
          <span className="sync-text">Local workspace synced</span>
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

        <button
          type="button"
          className="top-avatar"
          onClick={onOpenSettings}
          aria-label="Workspace settings for Alex Kim"
          title="Alex Kim · Settings"
        >
          AK
        </button>
      </div>
    </header>
  );
}
