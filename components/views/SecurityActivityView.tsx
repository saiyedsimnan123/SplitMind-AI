"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  KeyRound,
  Laptop,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";
import { filterAuditEvents, isAuthenticationCategory } from "@/lib/audit";
import type { AuditEvent, AuditStatus, GroupRecord, SessionSummary } from "@/lib/types";

export function SecurityActivityView({
  events,
  groups,
  session,
  authConfigured,
  loading,
  error,
  onRefreshEvents,
  onLogoutLocal,
  onRequestRevokeOthers,
  onRequestRevokeAll,
}: {
  events: AuditEvent[];
  groups: GroupRecord[];
  session: SessionSummary;
  authConfigured: boolean;
  loading: boolean;
  error: string;
  onRefreshEvents: () => void;
  onLogoutLocal: () => void;
  onRequestRevokeOthers: () => void;
  onRequestRevokeAll: () => void;
}) {
  const [categoryTab, setCategoryTab] = useState<"all" | "auth_security" | "financial_group" | "security">("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<AuditStatus | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [query, setQuery] = useState("");

  const availableEventTypes = useMemo(() => {
    const map = new Map<string, string>();
    for (const ev of events) {
      map.set(ev.eventType, ev.eventName);
    }
    return [...map.entries()];
  }, [events]);

  const filteredEvents = useMemo(
    () =>
      filterAuditEvents(events, {
        category: categoryTab,
        eventType: eventTypeFilter,
        groupId: groupFilter,
        status: statusFilter,
        dateFrom,
        dateTo,
        query,
      }),
    [events, categoryTab, eventTypeFilter, groupFilter, statusFilter, dateFrom, dateTo, query],
  );

  const authEventsCount = events.filter((ev) => isAuthenticationCategory(ev.category)).length;
  const financialEventsCount = events.length - authEventsCount;
  const warningEventsCount = events.filter(
    (ev) => ev.category === "security" || ev.status === "warning" || ev.status === "failure",
  ).length;

  return (
    <div className="stack-layout">
      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">SESSION &amp; DEVICE OVERVIEW</div>
            <h2>Active session &amp; revocation controls</h2>
          </div>
          <span className="save-badge">
            <LockKeyhole size={13} /> {authConfigured ? "HttpOnly Server Cookies" : "Local Preview"}
          </span>
        </div>

        <p className="muted-copy">
          {authConfigured
            ? "Your Supabase access and refresh tokens remain inside server-set HttpOnly cookies and are never stored in browser localStorage."
            : "Supabase Auth environment variables are not set. Running in unauthenticated local preview mode without fake sign-in simulation."}
        </p>

        <div className="session-device-card">
          <div className="session-device-meta">
            <span className="activity-icon activity-verified">
              <Laptop size={17} />
            </span>
            <div>
              <strong>{session.deviceLabel || "Current browser session"}</strong>
              <small>
                {session.provider} ·{" "}
                {session.sessionId ? `Session ID: ${session.sessionId}` : "No server session active"}
                {session.createdAt ? ` · Started ${new Date(session.createdAt).toLocaleString()}` : ""}
              </small>
            </div>
          </div>

          {authConfigured && session.authenticated && (
            <div className="header-actions-inline">
              <button type="button" className="button button-outline button-sm" onClick={onLogoutLocal}>
                <LogOut size={13} /> Sign out device
              </button>
              <button
                type="button"
                className="button button-outline button-sm"
                onClick={onRequestRevokeOthers}
              >
                Revoke other sessions
              </button>
              <button
                type="button"
                className="button button-danger button-sm"
                onClick={onRequestRevokeAll}
              >
                Sign out everywhere
              </button>
            </div>
          )}
        </div>

        <div className="safety-note">
          <ShieldCheck size={14} />
          <span>
            Supabase Auth supports revoking your current session, all other active refresh sessions
            (<code>scope=&quot;others&quot;</code>), or every session globally (<code>scope=&quot;global&quot;</code>).
            Per-device session lists from external browsers are not exposed by Supabase client tokens.
          </span>
        </div>
      </section>

      <section className="panel full-panel">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">APPEND-ONLY AUDIT LEDGER</div>
            <h2>Security &amp; financial audit events</h2>
          </div>
          <div className="header-actions-inline">
            <span className="save-badge">
              <LockKeyhole size={13} /> Immutable · RLS protected
            </span>
            {authConfigured && (
              <button
                type="button"
                className="button button-outline button-sm"
                onClick={onRefreshEvents}
                disabled={loading}
              >
                <RefreshCw size={13} className={loading ? "spin" : ""} /> Refresh
              </button>
            )}
          </div>
        </div>

        <p className="muted-copy">
          Authentication &amp; session security events are clearly separated from group financial &amp; ledger
          events. Audit rows cannot be edited or deleted from the client; passwords, access tokens, and full
          payment credentials are never logged.
        </p>

        <div className="kpi-inline-strip">
          <div className="kpi-inline-card">
            <span>Total events</span>
            <strong className="tabular">{events.length}</strong>
          </div>
          <div className="kpi-inline-card">
            <span>Auth &amp; sessions</span>
            <strong className="tabular">{authEventsCount}</strong>
          </div>
          <div className="kpi-inline-card">
            <span>Financial &amp; groups</span>
            <strong className="tabular">{financialEventsCount}</strong>
          </div>
          <div className="kpi-inline-card">
            <span>Warnings &amp; failures</span>
            <strong className={`tabular ${warningEventsCount > 0 ? "warn-text" : ""}`}>
              {warningEventsCount}
            </strong>
          </div>
        </div>

        <div className="filter-toolbar">
          <div className="filter-pills" role="tablist" aria-label="Filter audit events by domain">
            <button
              type="button"
              role="tab"
              aria-selected={categoryTab === "all"}
              className={`filter-pill ${categoryTab === "all" ? "active" : ""}`}
              onClick={() => setCategoryTab("all")}
            >
              All ({events.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={categoryTab === "auth_security"}
              className={`filter-pill ${categoryTab === "auth_security" ? "active" : ""}`}
              onClick={() => setCategoryTab("auth_security")}
            >
              Auth &amp; Sessions ({authEventsCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={categoryTab === "financial_group"}
              className={`filter-pill ${categoryTab === "financial_group" ? "active" : ""}`}
              onClick={() => setCategoryTab("financial_group")}
            >
              Financial &amp; Groups ({financialEventsCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={categoryTab === "security"}
              className={`filter-pill ${categoryTab === "security" ? "active" : ""}`}
              onClick={() => setCategoryTab("security")}
            >
              Security Warnings
            </button>
          </div>
        </div>

        <div className="audit-filter-grid">
          <label className="search-input-box">
            <Search size={14} />
            <input
              aria-label="Search security and activity events"
              placeholder="Search event, user, group, description..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <select
            aria-label="Filter by event type"
            className="compact-select"
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
          >
            <option value="all">All event types</option>
            {availableEventTypes.map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by group"
            className="compact-select"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
          >
            <option value="all">All groups &amp; account</option>
            <option value="global">Account / Global only</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by status"
            className="compact-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AuditStatus | "all")}
          >
            <option value="all">All statuses</option>
            <option value="success">Success</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="failure">Failure</option>
          </select>

          <input
            aria-label="From date"
            type="date"
            className="compact-date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="Start date"
          />

          <input
            aria-label="To date"
            type="date"
            className="compact-date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="End date"
          />
        </div>

        {error && (
          <div className="payment-banner payment-banner-error" role="alert" style={{ marginBottom: 12 }}>
            <AlertTriangle size={16} />
            <div className="payment-banner-copy">
              <strong>Could not load server audit log</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {filteredEvents.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={22} />
            <strong>No audit events match your current filters.</strong>
            <span>
              Authentication attempts, session events, group changes, expenses, and settlements appear here as
              append-only audit records.
            </span>
          </div>
        ) : (
          <div className="security-audit-table" role="region" aria-label="Security and activity audit trail">
            {filteredEvents.map((event) => {
              const isAuth = isAuthenticationCategory(event.category);
              return (
                <article className="security-audit-row" key={event.id}>
                  <div className="security-audit-icon">
                    <span
                      className={`activity-icon ${
                        event.status === "failure"
                          ? "activity-danger"
                          : event.status === "warning"
                            ? "activity-pending"
                            : "activity-verified"
                      }`}
                    >
                      {event.category === "security" ? (
                        <ShieldAlert size={15} />
                      ) : isAuth ? (
                        <KeyRound size={15} />
                      ) : (
                        <WalletCards size={15} />
                      )}
                    </span>
                  </div>

                  <div className="security-audit-main">
                    <div className="security-audit-header">
                      <strong>{event.eventName}</strong>
                      <span className={`domain-badge ${isAuth ? "domain-auth" : "domain-finance"}`}>
                        {isAuth ? "Auth & Security" : event.category === "group" ? "Group" : "Financial"}
                      </span>
                      <span className={`audit-status-pill audit-status-${event.status}`}>
                        {event.status === "success" && <CheckCircle2 size={11} />}
                        {event.status === "warning" && <AlertTriangle size={11} />}
                        {event.status === "failure" && <ShieldAlert size={11} />}
                        {event.status === "info" && <Clock3 size={11} />}
                        {event.status}
                      </span>
                    </div>

                    <p className="security-audit-desc">{event.description}</p>

                    <div className="security-audit-meta">
                      <span>
                        User: <strong>{event.actorLabel}</strong>
                      </span>
                      <span>·</span>
                      <span>
                        Group: <strong>{event.groupName ?? "Account / Global"}</strong>
                      </span>
                      <span>·</span>
                      <time dateTime={event.createdAt}>
                        {new Date(event.createdAt).toLocaleString()}
                      </time>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
