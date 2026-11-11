import { buildAuditEvent } from "@/lib/audit";
import { createInitialGoaGroup } from "@/lib/demo-data";
import { deriveInitials } from "@/lib/groups";
import { isDemoAuthUser, type SupabaseAuthUser } from "@/lib/supabase/auth";
import {
  getSupabaseAnonKey,
  getSupabaseServiceKey,
  getSupabaseUrl,
  isSupabaseDbConfigured,
} from "@/lib/supabase/config";
import type {
  AuditCategory,
  AuditEvent,
  AuditStatus,
  AuthUser,
  ContributionRecord,
  CurrencyCode,
  GroupExpense,
  GroupMember,
  GroupRecord,
  GroupRole,
  PlanType,
  SettlementRecord,
} from "@/lib/types";

type DbProfileRow = {
  id: string;
  email: string;
  phone?: string | null;
  full_name: string;
  initials: string;
  avatar_color: string;
  default_currency: CurrencyCode;
  workspace_initialized: boolean;
};

type DbGroupRow = {
  id: string;
  owner_id: string;
  name: string;
  plan_type: PlanType;
  description: string;
  currency: CurrencyCode;
  total_budget: number | string;
  start_date: string;
  end_date: string | null;
  is_demo: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type DbMemberRow = {
  id: string;
  group_id: string;
  user_id: string | null;
  display_name: string;
  email: string | null;
  initials: string;
  avatar_color: string;
  role: GroupRole;
  paid_amount: number | string;
};

type DbBudgetRow = {
  id: string;
  group_id: string;
  category_key: string;
  label: string;
  planned_amount: number | string;
  draft_amount: number | string;
  spent_amount: number | string;
  color: string;
  sort_order: number;
  proposal_requested: boolean;
};

type DbExpenseRow = {
  id: string;
  group_id: string;
  category_id: string | null;
  category_label: string;
  title: string;
  amount: number | string;
  paid_by_member_id: string;
  paid_by_name: string;
  verified: boolean;
  receipt_name: string | null;
  receipt_data: string | null;
  expense_date: string;
  notes: string;
  created_at: string;
};

type DbContributionRow = {
  id: string;
  group_id: string;
  member_id: string;
  recipient_member_id: string | null;
  amount: number | string;
  currency: CurrencyCode;
  source: ContributionRecord["source"];
  note: string;
  created_at: string;
};

type DbSettlementRow = {
  id: string;
  group_id: string;
  from_member_id: string;
  to_member_id: string;
  from_name: string;
  to_name: string;
  amount: number | string;
  currency: CurrencyCode;
  status: SettlementRecord["status"];
  note: string;
  settled_at: string;
};

type DbAuditRow = {
  id: string;
  category: AuditCategory;
  event_type: string;
  event_name: string;
  status: AuditStatus;
  actor_user_id: string | null;
  actor_label: string;
  group_id: string | null;
  group_name: string | null;
  description: string;
  metadata: Record<string, string | number | boolean | null> | null;
  created_at: string;
};

function toNum(value: number | string | null | undefined): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
}

export async function userRestFetch<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) {
    throw new Error("Supabase URL and anon key are required.");
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { message?: string; details?: string };
    const statusError = new Error(err.message || err.details || `Database request failed (${response.status}).`);
    (statusError as Error & { status?: number }).status = response.status;
    throw statusError;
  }

  if (response.status === 204 || init.method === "DELETE") {
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function adminRestFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceKey();
  if (!url || !serviceKey) {
    throw new Error("Supabase service role configuration is required for this server operation.");
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { message?: string; details?: string };
    throw new Error(err.message || err.details || `Server database request failed (${response.status}).`);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

function normalizeAuthUserPhone(rawPhone?: string | null): string {
  const cleaned = (rawPhone ?? "").trim().replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

export function authUserToFallbackProfile(user: SupabaseAuthUser): AuthUser {
  const isDemo = isDemoAuthUser(user);
  const phone = normalizeAuthUserPhone(user.phone || user.user_metadata?.contact_phone);
  const authProvider = isDemo ? "anonymous" : "email";
  const fullName =
    user.user_metadata?.full_name?.trim() ||
    user.user_metadata?.name?.trim() ||
    (isDemo
      ? "Demo Explorer"
      : user.email?.split("@")[0] || "") ||
    "SplitMind Member";
  const defaultCurrencyRaw = user.user_metadata?.default_currency;
  const defaultCurrency: CurrencyCode =
    defaultCurrencyRaw === "USD" || defaultCurrencyRaw === "EUR" || defaultCurrencyRaw === "GBP"
      ? defaultCurrencyRaw
      : "INR";

  return {
    id: user.id,
    email: user.email ?? "",
    phone,
    authProvider,
    fullName,
    initials: isDemo ? "DM" : deriveInitials(fullName),
    avatarColor: user.user_metadata?.avatar_color || "coral",
    defaultCurrency,
    isDemo,
  };
}

export async function ensureUserProfile(
  accessToken: string,
  authUser: SupabaseAuthUser,
): Promise<{ profile: AuthUser; workspaceInitialized: boolean }> {
  const isDemo = isDemoAuthUser(authUser);
  const fallback = authUserToFallbackProfile(authUser);
  // Look up strictly by verified authUser.id; never match or merge by unverified email/phone.
  const rows = await userRestFetch<DbProfileRow[]>(
    accessToken,
    `profiles?id=eq.${encodeURIComponent(authUser.id)}&select=*`,
  );

  if (rows?.[0]) {
    const row = rows[0];
    return {
      profile: {
        id: row.id,
        email: row.email || fallback.email,
        phone: normalizeAuthUserPhone(row.phone) || fallback.phone,
        authProvider: fallback.authProvider,
        fullName: row.full_name,
        initials: isDemo ? "DM" : row.initials,
        avatarColor: row.avatar_color,
        defaultCurrency: row.default_currency,
        isDemo,
      },
      workspaceInitialized: row.workspace_initialized,
    };
  }

  const basePayload = {
    id: authUser.id,
    email: fallback.email,
    full_name: fallback.fullName,
    initials: fallback.initials,
    avatar_color: fallback.avatarColor,
    default_currency: fallback.defaultCurrency,
  };

  let inserted: DbProfileRow[] | null = null;
  try {
    inserted = await userRestFetch<DbProfileRow[]>(accessToken, "profiles", {
      method: "POST",
      headers: { prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify({
        ...basePayload,
        ...(fallback.phone ? { phone: fallback.phone } : {}),
      }),
    });
  } catch (err) {
    const status = (err as Error & { status?: number })?.status;
    if (fallback.phone && (status === 409 || /unique|duplicate/i.test(err instanceof Error ? err.message : ""))) {
      // Never overwrite another user's phone number; create profile without conflicting phone.
      inserted = await userRestFetch<DbProfileRow[]>(accessToken, "profiles", {
        method: "POST",
        headers: { prefer: "return=representation,resolution=merge-duplicates" },
        body: JSON.stringify(basePayload),
      });
    } else {
      throw err;
    }
  }

  const row = inserted?.[0];
  return {
    profile: row
      ? {
          id: row.id,
          email: row.email || fallback.email,
          phone: normalizeAuthUserPhone(row.phone) || fallback.phone,
          authProvider: fallback.authProvider,
          fullName: row.full_name,
          initials: isDemo ? "DM" : row.initials,
          avatarColor: row.avatar_color,
          defaultCurrency: row.default_currency,
          isDemo,
        }
      : fallback,
    workspaceInitialized: row?.workspace_initialized ?? false,
  };
}

export async function recordServerAuditEvent(input: {
  category: AuditCategory;
  eventType: string;
  eventName: string;
  status: AuditStatus;
  actorUserId?: string | null;
  actorLabel: string;
  groupId?: string | null;
  groupName?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isSupabaseDbConfigured()) return;
  const sanitized = buildAuditEvent(input);
  try {
    await adminRestFetch("security_audit_events", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        id: sanitized.id,
        category: sanitized.category,
        event_type: sanitized.eventType,
        event_name: sanitized.eventName,
        status: sanitized.status,
        actor_user_id: sanitized.actorUserId,
        actor_label: sanitized.actorLabel,
        group_id: sanitized.groupId,
        group_name: sanitized.groupName,
        description: sanitized.description,
        metadata: sanitized.metadata ?? {},
      }),
    });
  } catch (error) {
    console.error("Failed to record server audit event:", error);
  }
}

export async function listAuditEventsForUser(accessToken: string, limit = 200): Promise<AuditEvent[]> {
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const rows = await userRestFetch<DbAuditRow[]>(
    accessToken,
    `security_audit_events?select=*&order=created_at.desc&limit=${safeLimit}`,
  );
  return (rows ?? []).map((row) => ({
    id: row.id,
    category: row.category,
    eventType: row.event_type,
    eventName: row.event_name,
    status: row.status,
    actorUserId: row.actor_user_id,
    actorLabel: row.actor_label,
    groupId: row.group_id,
    groupName: row.group_name,
    description: row.description,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }));
}

export async function persistNewGroupInDb(
  accessToken: string,
  userId: string,
  group: GroupRecord,
): Promise<GroupRecord> {
  const insertedGroups = await userRestFetch<DbGroupRow[]>(accessToken, "groups", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      id: group.id,
      owner_id: userId,
      name: group.name,
      plan_type: group.planType,
      description: group.description,
      currency: group.currency,
      total_budget: group.totalBudget,
      start_date: group.startDate,
      end_date: group.endDate,
      is_demo: Boolean(group.isDemo),
      archived_at: group.archivedAt,
    }),
  });

  const savedGroup = insertedGroups?.[0];
  if (!savedGroup) throw new Error("Could not save the new group.");

  const memberPayload = group.members.map((member, index) => ({
    id: member.id,
    group_id: savedGroup.id,
    user_id: index === 0 ? userId : member.userId ?? null,
    display_name: member.name,
    email: member.email ?? null,
    initials: member.initials,
    avatar_color: member.color,
    role: index === 0 ? "owner" : member.role,
    paid_amount: member.paid,
  }));

  const savedMembers = await userRestFetch<DbMemberRow[]>(accessToken, "group_memberships", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(memberPayload),
  });

  const budgetPayload = group.categories.map((cat, index) => ({
    group_id: savedGroup.id,
    category_key: cat.id,
    label: cat.label,
    planned_amount: cat.budget,
    draft_amount: group.draftCategories[index]?.budget ?? cat.budget,
    spent_amount: cat.spent,
    color: cat.color,
    sort_order: index,
    proposal_requested: group.proposalRequested,
    updated_by: userId,
  }));

  const savedBudgets = await userRestFetch<DbBudgetRow[]>(accessToken, "group_budgets", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(budgetPayload),
  });

  if (group.expenses.length > 0) {
    const memberIdMap = new Map<string, string>();
    group.members.forEach((m, idx) => {
      if (savedMembers?.[idx]?.id) memberIdMap.set(m.id, savedMembers[idx].id);
    });
    const budgetByLabel = new Map((savedBudgets ?? []).map((b) => [b.label, b.id]));

    await userRestFetch(accessToken, "expenses", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify(
        group.expenses.map((expense) => ({
          group_id: savedGroup.id,
          category_id: budgetByLabel.get(expense.category) ?? savedBudgets?.[0]?.id ?? null,
          category_label: expense.category,
          title: expense.title,
          amount: expense.amount,
          paid_by_member_id:
            memberIdMap.get(expense.paidByMemberId ?? "") ?? savedMembers[0].id,
          paid_by_name: expense.submittedBy,
          created_by_user_id: userId,
          verified: expense.verified,
          receipt_name: expense.receiptName ?? null,
          receipt_data: expense.receiptData ?? null,
          expense_date: expense.date ?? group.startDate,
          notes: expense.notes ?? "",
        })),
      ),
    });
  }

  if (group.contributions.length > 0) {
    const memberIdMap = new Map<string, string>();
    group.members.forEach((m, idx) => {
      if (savedMembers?.[idx]?.id) memberIdMap.set(m.id, savedMembers[idx].id);
    });
    await userRestFetch(accessToken, "contributions", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify(
        group.contributions.map((c) => ({
          group_id: savedGroup.id,
          member_id: memberIdMap.get(c.memberId) ?? savedMembers[0].id,
          recipient_member_id: c.recipientMemberId ? (memberIdMap.get(c.recipientMemberId) ?? null) : null,
          amount: c.amount,
          currency: c.currency,
          source: c.source,
          note: c.note,
          recorded_by_user_id: userId,
        })),
      ),
    });
  }

  const loaded = await fetchSingleGroupForUser(accessToken, savedGroup.id);
  return loaded ?? group;
}

export async function seedInitialGoaWorkspaceIfNeeded(
  accessToken: string,
  profile: AuthUser,
  workspaceInitialized: boolean,
): Promise<void> {
  if (workspaceInitialized) return;

  const existingGroups = await userRestFetch<Pick<DbGroupRow, "id">[]>(
    accessToken,
    "groups?select=id&limit=1",
  );

  if (!existingGroups?.length) {
    const goaDemo = createInitialGoaGroup({
      ownerUserId: profile.id,
      ownerDisplayName: profile.fullName,
      ownerInitials: profile.initials,
    });
    goaDemo.id = crypto.randomUUID();
    goaDemo.members = goaDemo.members.map((m) => ({ ...m, id: crypto.randomUUID() }));
    const memberByName = new Map(goaDemo.members.map((m) => [m.name, m]));
    goaDemo.ownerMemberId = goaDemo.members[0].id;
    goaDemo.expenses = goaDemo.expenses.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      paidByMemberId: memberByName.get(e.submittedBy)?.id ?? goaDemo.members[0].id,
    }));
    goaDemo.contributions = goaDemo.contributions.map((c) => ({
      ...c,
      id: crypto.randomUUID(),
      memberId: memberByName.get(c.memberName)?.id ?? goaDemo.members[0].id,
    }));

    await persistNewGroupInDb(accessToken, profile.id, goaDemo);
  }

  await userRestFetch(accessToken, `profiles?id=eq.${encodeURIComponent(profile.id)}`, {
    method: "PATCH",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ workspace_initialized: true }),
  });
}

function hydrateGroups(
  groupRows: DbGroupRow[],
  memberRows: DbMemberRow[],
  budgetRows: DbBudgetRow[],
  expenseRows: DbExpenseRow[],
  contributionRows: DbContributionRow[],
  settlementRows: DbSettlementRow[],
): GroupRecord[] {
  const membersByGroup = new Map<string, GroupMember[]>();
  const memberNameById = new Map<string, string>();
  for (const row of memberRows) {
    memberNameById.set(row.id, row.display_name);
    const list = membersByGroup.get(row.group_id) ?? [];
    list.push({
      id: row.id,
      name: row.display_name,
      initials: row.initials,
      color: row.avatar_color,
      paid: toNum(row.paid_amount),
      role: row.role,
      userId: row.user_id,
      email: row.email ?? undefined,
    });
    membersByGroup.set(row.group_id, list);
  }

  const budgetsByGroup = new Map<string, DbBudgetRow[]>();
  for (const row of budgetRows) {
    const list = budgetsByGroup.get(row.group_id) ?? [];
    list.push(row);
    budgetsByGroup.set(row.group_id, list);
  }

  const expensesByGroup = new Map<string, GroupExpense[]>();
  for (const row of expenseRows) {
    const list = expensesByGroup.get(row.group_id) ?? [];
    list.push({
      id: row.id,
      title: row.title,
      category: row.category_label,
      amount: toNum(row.amount),
      submittedBy: row.paid_by_name,
      paidByMemberId: row.paid_by_member_id,
      verified: row.verified,
      createdAt: new Date(row.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      date: row.expense_date,
      notes: row.notes,
      receiptName: row.receipt_name ?? undefined,
      receiptData: row.receipt_data ?? undefined,
    });
    expensesByGroup.set(row.group_id, list);
  }

  const contributionsByGroup = new Map<string, ContributionRecord[]>();
  for (const row of contributionRows) {
    const list = contributionsByGroup.get(row.group_id) ?? [];
    list.push({
      id: row.id,
      memberId: row.member_id,
      memberName: memberNameById.get(row.member_id) ?? "Member",
      recipientMemberId: row.recipient_member_id,
      recipientName: row.recipient_member_id ? (memberNameById.get(row.recipient_member_id) ?? null) : null,
      amount: toNum(row.amount),
      currency: row.currency,
      source: row.source,
      note: row.note,
      createdAt: row.created_at,
    });
    contributionsByGroup.set(row.group_id, list);
  }

  const settlementsByGroup = new Map<string, SettlementRecord[]>();
  for (const row of settlementRows) {
    const list = settlementsByGroup.get(row.group_id) ?? [];
    list.push({
      id: row.id,
      fromMemberId: row.from_member_id,
      toMemberId: row.to_member_id,
      fromName: row.from_name,
      toName: row.to_name,
      amount: toNum(row.amount),
      currency: row.currency,
      status: row.status,
      note: row.note,
      settledAt: row.settled_at,
    });
    settlementsByGroup.set(row.group_id, list);
  }

  return groupRows.map((row) => {
    const members = membersByGroup.get(row.id) ?? [];
    const ownerMember =
      members.find((m) => m.role === "owner") ??
      members.find((m) => m.userId === row.owner_id) ??
      members[0];
    const budgets = (budgetsByGroup.get(row.id) ?? []).sort((a, b) => a.sort_order - b.sort_order);

    return {
      id: row.id,
      name: row.name,
      planType: row.plan_type,
      description: row.description,
      currency: row.currency,
      totalBudget: toNum(row.total_budget),
      startDate: row.start_date,
      endDate: row.end_date,
      ownerMemberId: ownerMember?.id ?? "",
      ownerUserId: row.owner_id,
      archivedAt: row.archived_at,
      isDemo: row.is_demo,
      members,
      categories: budgets.map((b) => ({
        id: b.category_key,
        label: b.label,
        budget: toNum(b.planned_amount),
        spent: toNum(b.spent_amount),
        color: b.color,
      })),
      draftCategories: budgets.map((b) => ({
        id: b.category_key,
        label: b.label,
        budget: toNum(b.draft_amount),
        spent: toNum(b.spent_amount),
        color: b.color,
      })),
      proposalRequested: budgets.some((b) => b.proposal_requested),
      expenses: expensesByGroup.get(row.id) ?? [],
      contributions: contributionsByGroup.get(row.id) ?? [],
      settlements: settlementsByGroup.get(row.id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export async function fetchAllGroupsForUser(accessToken: string): Promise<GroupRecord[]> {
  const groupRows = await userRestFetch<DbGroupRow[]>(
    accessToken,
    "groups?select=*&order=created_at.asc",
  );
  if (!groupRows?.length) return [];

  const [memberRows, budgetRows, expenseRows, contributionRows, settlementRows] = await Promise.all([
    userRestFetch<DbMemberRow[]>(accessToken, "group_memberships?select=*&order=created_at.asc"),
    userRestFetch<DbBudgetRow[]>(accessToken, "group_budgets?select=*&order=sort_order.asc"),
    userRestFetch<DbExpenseRow[]>(accessToken, "expenses?select=*&order=created_at.desc"),
    userRestFetch<DbContributionRow[]>(accessToken, "contributions?select=*&order=created_at.desc"),
    userRestFetch<DbSettlementRow[]>(accessToken, "settlements?select=*&order=created_at.desc"),
  ]);

  return hydrateGroups(
    groupRows,
    memberRows ?? [],
    budgetRows ?? [],
    expenseRows ?? [],
    contributionRows ?? [],
    settlementRows ?? [],
  );
}

export async function fetchSingleGroupForUser(
  accessToken: string,
  groupId: string,
): Promise<GroupRecord | null> {
  const encodedId = encodeURIComponent(groupId);
  const groupRows = await userRestFetch<DbGroupRow[]>(accessToken, `groups?id=eq.${encodedId}&select=*`);
  if (!groupRows?.length) return null;

  const [memberRows, budgetRows, expenseRows, contributionRows, settlementRows] = await Promise.all([
    userRestFetch<DbMemberRow[]>(accessToken, `group_memberships?group_id=eq.${encodedId}&select=*&order=created_at.asc`),
    userRestFetch<DbBudgetRow[]>(accessToken, `group_budgets?group_id=eq.${encodedId}&select=*&order=sort_order.asc`),
    userRestFetch<DbExpenseRow[]>(accessToken, `expenses?group_id=eq.${encodedId}&select=*&order=created_at.desc`),
    userRestFetch<DbContributionRow[]>(accessToken, `contributions?group_id=eq.${encodedId}&select=*&order=created_at.desc`),
    userRestFetch<DbSettlementRow[]>(accessToken, `settlements?group_id=eq.${encodedId}&select=*&order=created_at.desc`),
  ]);

  return (
    hydrateGroups(
      groupRows,
      memberRows ?? [],
      budgetRows ?? [],
      expenseRows ?? [],
      contributionRows ?? [],
      settlementRows ?? [],
    )[0] ?? null
  );
}

export async function requireGroupAccess(
  accessToken: string,
  userId: string,
  groupId: string,
  level: "member" | "organizer" | "owner" = "member",
): Promise<GroupRecord> {
  const group = await fetchSingleGroupForUser(accessToken, groupId);
  if (!group) {
    const err = new Error("Group not found or you do not have access to it.");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  const membership = group.members.find((m) => m.userId === userId);
  const isOwner = group.ownerUserId === userId || membership?.role === "owner";
  const isOrganizer = isOwner || membership?.role === "organizer";
  const isMember = isOrganizer || Boolean(membership);

  if (level === "owner" && !isOwner) {
    const err = new Error("Only the group owner can perform this action.");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  if (level === "organizer" && !isOrganizer) {
    const err = new Error("Only a group organizer or owner can perform this action.");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  if (!isMember) {
    const err = new Error("You are not a member of this group.");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return group;
}
