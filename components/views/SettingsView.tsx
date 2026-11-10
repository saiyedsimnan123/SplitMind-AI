"use client";

import { RotateCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";

export function SettingsView({
  memberCount,
  expenseCount,
  onResetDemo,
}: {
  memberCount: number;
  expenseCount: number;
  onResetDemo: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <section className="panel settings-panel">
      <div className="section-kicker">YOUR SPACE</div>
      <h2>Workspace settings</h2>
      <p className="muted-copy">
        Manage local workspace preferences for the Goa Trip 2026 demo. All group edits stay in your browser.
      </p>

      <div className="settings-row">
        <div>
          <strong>Group name</strong>
          <small>Displayed across navigation, reports, and AI context</small>
        </div>
        <input value="Goa Trip 2026" readOnly aria-label="Group name" />
      </div>

      <div className="settings-row">
        <div>
          <strong>Workspace summary</strong>
          <small>Current browser session state</small>
        </div>
        <span className="save-badge">
          <span /> {memberCount} members · {expenseCount} expenses
        </span>
      </div>

      <div className="settings-row">
        <div>
          <strong>Local demo data</strong>
          <small>Stored in this browser&apos;s local storage, not shared with other members</small>
        </div>
        {confirmReset ? (
          <div className="header-actions-inline">
            <button type="button" className="button button-outline" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
            <button type="button" className="button button-danger" onClick={onResetDemo}>
              <RotateCcw size={14} /> Confirm reset
            </button>
          </div>
        ) : (
          <button type="button" className="button button-outline" onClick={() => setConfirmReset(true)}>
            Reset demo
          </button>
        )}
      </div>

      <div className="safety-note">
        <ShieldCheck size={14} />
        <span>
          Do not enter real payment credentials into this demo workspace. PayPal checkout uses USD Sandbox
          accounts only.
        </span>
      </div>
    </section>
  );
}
