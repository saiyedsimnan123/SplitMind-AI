"use client";

import Link from "next/link";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogIn,
  LogOut,
  RotateCcw,
  Save,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useState } from "react";
import { CURRENCY_META } from "@/lib/finance";
import { SecurityActivityView } from "@/components/views/SecurityActivityView";
import type {
  AuditEvent,
  AuthUser,
  CurrencyCode,
  GroupRecord,
  SessionSummary,
  SettingsTab,
} from "@/lib/types";

export function SettingsView({
  activeTab,
  onChangeTab,
  activeGroup,
  groups,
  currentUser,
  authConfigured,
  session,
  auditEvents,
  auditLoading,
  auditError,
  onRefreshAudit,
  onSaveProfile,
  onChangePassword,
  onLogoutLocal,
  onRequestRevokeOthers,
  onRequestRevokeAll,
  onRequestResetDemo,
}: {
  activeTab: SettingsTab;
  onChangeTab: (tab: SettingsTab) => void;
  activeGroup: GroupRecord;
  groups: GroupRecord[];
  currentUser: AuthUser | null;
  authConfigured: boolean;
  session: SessionSummary;
  auditEvents: AuditEvent[];
  auditLoading: boolean;
  auditError: string;
  onRefreshAudit: () => void;
  onSaveProfile: (values: { fullName: string; defaultCurrency: CurrencyCode }) => Promise<void>;
  onChangePassword: (values: { currentPassword: string; newPassword: string }) => Promise<void>;
  onLogoutLocal: () => void;
  onRequestRevokeOthers: () => void;
  onRequestRevokeAll: () => void;
  onRequestResetDemo: () => void;
}) {
  const [fullName, setFullName] = useState(currentUser?.fullName ?? "");
  const [defaultCurrency, setDefaultCurrency] = useState<CurrencyCode>(
    currentUser?.defaultCurrency ?? activeGroup.currency,
  );
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordErr, setPasswordErr] = useState("");

  const submitProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileMsg("");
    setProfileErr("");
    if (!fullName.trim() || fullName.trim().length > 80) {
      setProfileErr("Enter a full name between 1 and 80 characters.");
      return;
    }
    setProfileBusy(true);
    try {
      await onSaveProfile({ fullName: fullName.trim(), defaultCurrency });
      setProfileMsg("Profile preferences updated.");
    } catch (error) {
      setProfileErr(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setProfileBusy(false);
    }
  };

  const isDemoAccount = Boolean(currentUser?.isDemo || session.isDemo);

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordMsg("");
    setPasswordErr("");
    if (!currentPassword) {
      setPasswordErr("Enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordErr("Choose a new password with at least 8 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordErr("New passwords do not match.");
      return;
    }
    setPasswordBusy(true);
    try {
      await onChangePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordMsg("Password updated and logged in Security & Activity.");
    } catch (error) {
      setPasswordErr(error instanceof Error ? error.message : "Could not update password.");
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <div className="stack-layout">
      <div className="settings-subnav" role="tablist" aria-label="Settings sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "account"}
          className={`filter-pill ${activeTab === "account" ? "active" : ""}`}
          onClick={() => onChangeTab("account")}
        >
          <UserCheck size={13} /> Profile &amp; Account
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "security"}
          className={`filter-pill ${activeTab === "security" ? "active" : ""}`}
          onClick={() => onChangeTab("security")}
        >
          <LockKeyhole size={13} /> Security &amp; Activity ({auditEvents.length})
        </button>
      </div>

      {activeTab === "security" ? (
        <SecurityActivityView
          events={auditEvents}
          groups={groups}
          session={session}
          authConfigured={authConfigured}
          loading={auditLoading}
          error={auditError}
          onRefreshEvents={onRefreshAudit}
          onLogoutLocal={onLogoutLocal}
          onRequestRevokeOthers={onRequestRevokeOthers}
          onRequestRevokeAll={onRequestRevokeAll}
        />
      ) : (
        <div className="stack-layout">
          <section className="panel settings-panel">
            <div className="panel-heading">
              <div>
                <div className="section-kicker">PROFILE &amp; ACCOUNT</div>
                <h2>Your SplitMind account</h2>
              </div>
              {authConfigured && currentUser ? (
                <button type="button" className="button button-outline button-sm" onClick={onLogoutLocal}>
                  <LogOut size={13} /> {isDemoAccount ? "Exit Demo" : "Sign out"}
                </button>
              ) : (
                <Link href="/login" className="button button-outline button-sm">
                  <LogIn size={13} /> Sign in
                </Link>
              )}
            </div>

            {authConfigured && currentUser && isDemoAccount ? (
              <div className="stack-layout" style={{ marginTop: 14 }}>
                <div className="safety-note">
                  <ShieldCheck size={15} />
                  <span>
                    <strong>DEMO Session</strong> — You are signed in as{" "}
                    <strong>Demo Explorer (DEMO)</strong> with an isolated temporary workspace.
                    Account credentials and email settings cannot be modified in Demo Mode.
                  </span>
                </div>
                <div className="proposal-actions">
                  <button type="button" className="button button-outline" onClick={onLogoutLocal}>
                    <LogOut size={14} /> Exit Demo / Return to Login
                  </button>
                  <Link href="/signup" className="button button-primary">
                    Create full account
                  </Link>
                </div>
              </div>
            ) : authConfigured && currentUser ? (
              <form onSubmit={submitProfile} style={{ marginTop: 14 }}>
                {currentUser.email && (
                  <div className="settings-row">
                    <div>
                      <strong>Email address</strong>
                      <small>
                        {currentUser.authProvider === "google"
                          ? "Verified Google OAuth email"
                          : "Verified Supabase Auth identity"}
                      </small>
                    </div>
                    <input value={currentUser.email} readOnly aria-label="Email address" />
                  </div>
                )}

                {currentUser.phone && (
                  <div className="settings-row">
                    <div>
                      <strong>Phone number</strong>
                      <small>Verified via SMS OTP (Supabase Phone Auth)</small>
                    </div>
                    <input value={currentUser.phone} readOnly aria-label="Phone number" />
                  </div>
                )}

                <div className="settings-row">
                  <div>
                    <strong>Authentication method</strong>
                    <small>Active identity provider linked to your SplitMind profile</small>
                  </div>
                  <input
                    value={
                      currentUser.authProvider === "google"
                        ? "Google OAuth (PKCE)"
                        : currentUser.authProvider === "phone" || (!currentUser.email && currentUser.phone)
                          ? "Phone OTP (SMS)"
                          : "Email & OTP"
                    }
                    readOnly
                    aria-label="Authentication method"
                  />
                </div>

                <div className="settings-row">
                  <div>
                    <strong>Display name</strong>
                    <small>Shown in group rosters, expenses, and audit trails</small>
                  </div>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    aria-label="Full name"
                    disabled={profileBusy}
                  />
                </div>

                <div className="settings-row">
                  <div>
                    <strong>Default currency</strong>
                    <small>Pre-selected when creating new groups</small>
                  </div>
                  <select
                    aria-label="Default currency"
                    className="compact-select"
                    value={defaultCurrency}
                    onChange={(e) => setDefaultCurrency(e.target.value as CurrencyCode)}
                    disabled={profileBusy}
                  >
                    {(Object.keys(CURRENCY_META) as CurrencyCode[]).map((code) => (
                      <option key={code} value={code}>
                        {CURRENCY_META[code].label}
                      </option>
                    ))}
                  </select>
                </div>

                {profileErr && (
                  <p className="form-error" role="alert" style={{ marginTop: 10 }}>
                    {profileErr}
                  </p>
                )}
                {profileMsg && (
                  <div className="payment-banner payment-banner-success" role="status" style={{ marginTop: 10 }}>
                    <CheckCircle2 size={16} />
                    <strong>{profileMsg}</strong>
                  </div>
                )}

                <div className="proposal-actions">
                  <button type="submit" className="button button-primary" disabled={profileBusy}>
                    {profileBusy ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                    {profileBusy ? "Saving..." : "Save account settings"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="safety-note" style={{ marginTop: 14 }}>
                <ShieldCheck size={15} />
                <span>
                  Running in local multi-group preview mode. Add <code>SUPABASE_URL</code>,{" "}
                  <code>SUPABASE_ANON_KEY</code>, and <code>SUPABASE_SERVICE_ROLE_KEY</code> to{" "}
                  <code>.env.local</code> and apply the migrations to enable Supabase account profiles and
                  server-side authentication.
                </span>
              </div>
            )}
          </section>

          {authConfigured &&
            currentUser &&
            !isDemoAccount &&
            Boolean(currentUser.email) &&
            currentUser.authProvider !== "google" &&
            currentUser.authProvider !== "phone" && (
            <section className="panel settings-panel">
              <div className="section-kicker">CREDENTIALS</div>
              <h2>Change password</h2>
              <p className="muted-copy">
                Requires your current password before updating Supabase Auth credentials.
              </p>

              <form onSubmit={submitPassword}>
                <div className="form-two-col">
                  <label className="form-label">
                    Current password
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      disabled={passwordBusy}
                    />
                  </label>
                  <label className="form-label">
                    New password
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      disabled={passwordBusy}
                    />
                  </label>
                </div>

                <label className="form-label">
                  Confirm new password
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    disabled={passwordBusy}
                  />
                </label>

                {passwordErr && (
                  <p className="form-error" role="alert">
                    {passwordErr}
                  </p>
                )}
                {passwordMsg && (
                  <div className="payment-banner payment-banner-success" role="status">
                    <CheckCircle2 size={16} />
                    <strong>{passwordMsg}</strong>
                  </div>
                )}

                <div className="proposal-actions">
                  <button type="submit" className="button button-primary" disabled={passwordBusy}>
                    {passwordBusy ? <Loader2 size={14} className="spin" /> : <KeyRound size={14} />}
                    {passwordBusy ? "Updating..." : "Update password"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="panel settings-panel">
            <div className="section-kicker">WORKSPACE SUMMARY</div>
            <h2>Active group &amp; storage</h2>

            <div className="settings-row">
              <div>
                <strong>Active group</strong>
                <small>Switch groups anytime from the sidebar or Groups page</small>
              </div>
              <input value={`${activeGroup.name} (${activeGroup.currency})`} readOnly aria-label="Active group" />
            </div>

            <div className="settings-row">
              <div>
                <strong>Workspace count</strong>
                <small>Isolated groups in current workspace</small>
              </div>
              <span className="save-badge">
                <span /> {groups.length} group{groups.length === 1 ? "" : "s"} ·{" "}
                {activeGroup.members.length} members · {activeGroup.expenses.length} expenses
              </span>
            </div>

            {!authConfigured && (
              <div className="settings-row">
                <div>
                  <strong>Reset local preview</strong>
                  <small>Restores the initial Goa Trip 2026 demo group in this browser</small>
                </div>
                <button type="button" className="button button-outline" onClick={onRequestResetDemo}>
                  <RotateCcw size={14} /> Reset local preview
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
