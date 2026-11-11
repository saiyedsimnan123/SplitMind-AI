import {
  allocateBudgetCategories,
  calculateBalances,
  optimizeSettlements,
  scaleCategoriesToBudget,
  type Category,
} from "@/lib/finance";
import type {
  ContributionRecord,
  CurrencyCode,
  GroupExpense,
  GroupMember,
  GroupRecord,
  GroupRole,
  PlanType,
  SettlementRecord,
  SettlementTransfer,
} from "@/lib/types";

export const AVATAR_PALETTE = ["coral", "violet", "blue", "mint", "yellow", "pink", "sky", "lime"] as const;
const MAX_MEMBERS_PER_GROUP = 30;
const MAX_BUDGET = 100_000_000;

export function deriveInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "GM";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase() || "GM";
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export type CreateGroupInput = {
  name: string;
  planType: PlanType;
  description?: string;
  currency: CurrencyCode;
  totalBudget: number;
  startDate: string;
  endDate?: string | null;
  ownerName?: string;
  ownerEmail?: string;
  ownerUserId?: string | null;
};

export function validateGroupDates(startDate: string, endDate?: string | null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw new Error("Select a valid start date.");
  }
  const trimmedEnd = endDate?.trim() || null;
  if (trimmedEnd) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedEnd)) {
      throw new Error("Select a valid end date or leave it blank.");
    }
    if (trimmedEnd < startDate) {
      throw new Error("End date cannot be earlier than the start date.");
    }
  }
  return { startDate, endDate: trimmedEnd };
}

export function createGroupRecord(input: CreateGroupInput): GroupRecord {
  const name = input.name.trim();
  if (!name || name.length > 100) {
    throw new Error("Enter a group name between 1 and 100 characters.");
  }
  const description = (input.description ?? "").trim();
  if (description.length > 500) {
    throw new Error("Keep the group description under 500 characters.");
  }
  if (!Number.isFinite(input.totalBudget) || input.totalBudget < 0 || input.totalBudget > MAX_BUDGET) {
    throw new Error("Enter a valid total budget between 0 and 100,000,000.");
  }
  const { startDate, endDate } = validateGroupDates(input.startDate, input.endDate);

  const now = new Date().toISOString();
  const groupId = crypto.randomUUID();
  const ownerMemberId = crypto.randomUUID();
  const ownerName = input.ownerName?.trim() || "You";

  const categories = allocateBudgetCategories(roundMoney(input.totalBudget), input.planType);

  return {
    id: groupId,
    name,
    planType: input.planType,
    description,
    currency: input.currency,
    totalBudget: roundMoney(input.totalBudget),
    startDate,
    endDate,
    ownerMemberId,
    ownerUserId: input.ownerUserId ?? null,
    archivedAt: null,
    isDemo: false,
    members: [
      {
        id: ownerMemberId,
        name: ownerName,
        initials: deriveInitials(ownerName),
        color: AVATAR_PALETTE[0],
        paid: 0,
        role: "owner",
        userId: input.ownerUserId ?? null,
        email: input.ownerEmail,
      },
    ],
    categories,
    draftCategories: categories.map((category) => ({ ...category })),
    proposalRequested: false,
    expenses: [],
    contributions: [],
    settlements: [],
    createdAt: now,
    updatedAt: now,
  };
}

export type UpdateGroupInput = {
  name?: string;
  planType?: PlanType;
  description?: string;
  currency?: CurrencyCode;
  totalBudget?: number;
  startDate?: string;
  endDate?: string | null;
};

export function updateGroupRecord(group: GroupRecord, patch: UpdateGroupInput): GroupRecord {
  const nextName = patch.name !== undefined ? patch.name.trim() : group.name;
  if (!nextName || nextName.length > 100) {
    throw new Error("Enter a group name between 1 and 100 characters.");
  }
  const nextDescription = patch.description !== undefined ? patch.description.trim() : group.description;
  if (nextDescription.length > 500) {
    throw new Error("Keep the group description under 500 characters.");
  }
  const nextStart = patch.startDate ?? group.startDate;
  const nextEnd = patch.endDate !== undefined ? patch.endDate : group.endDate;
  const dates = validateGroupDates(nextStart, nextEnd);

  let nextCategories = group.categories;
  let nextDraftCategories = group.draftCategories;
  let nextTotalBudget = group.totalBudget;

  if (patch.totalBudget !== undefined) {
    if (!Number.isFinite(patch.totalBudget) || patch.totalBudget < 0 || patch.totalBudget > MAX_BUDGET) {
      throw new Error("Enter a valid total budget between 0 and 100,000,000.");
    }
    nextTotalBudget = roundMoney(patch.totalBudget);
    nextCategories = scaleCategoriesToBudget(group.categories, nextTotalBudget);
    nextDraftCategories = scaleCategoriesToBudget(group.draftCategories, nextTotalBudget);
  }

  return {
    ...group,
    name: nextName,
    planType: patch.planType ?? group.planType,
    description: nextDescription,
    currency: patch.currency ?? group.currency,
    totalBudget: nextTotalBudget,
    startDate: dates.startDate,
    endDate: dates.endDate,
    categories: nextCategories,
    draftCategories: nextDraftCategories,
    updatedAt: new Date().toISOString(),
  };
}

export function archiveGroupRecord(group: GroupRecord): GroupRecord {
  return {
    ...group,
    archivedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function restoreGroupRecord(group: GroupRecord): GroupRecord {
  return {
    ...group,
    archivedAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function addGroupMember(
  group: GroupRecord,
  input: { name: string; role?: GroupRole; email?: string; userId?: string | null },
): { group: GroupRecord; member: GroupMember } {
  const trimmed = input.name.trim();
  if (!trimmed || trimmed.length > 80) {
    throw new Error("Enter a member name between 1 and 80 characters.");
  }
  if (group.members.length >= MAX_MEMBERS_PER_GROUP) {
    throw new Error(`A group can have up to ${MAX_MEMBERS_PER_GROUP} members.`);
  }
  if (group.members.some((member) => member.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
    throw new Error(`${trimmed} is already in ${group.name}.`);
  }

  const role: GroupRole = input.role === "owner" ? "organizer" : (input.role ?? "member");
  const member: GroupMember = {
    id: crypto.randomUUID(),
    name: trimmed,
    initials: deriveInitials(trimmed),
    color: AVATAR_PALETTE[group.members.length % AVATAR_PALETTE.length],
    paid: 0,
    role,
    email: input.email?.trim() || undefined,
    userId: input.userId ?? null,
  };

  return {
    member,
    group: {
      ...group,
      members: [...group.members, member],
      updatedAt: new Date().toISOString(),
    },
  };
}

export function updateGroupMember(
  group: GroupRecord,
  memberId: string,
  patch: { name?: string; role?: GroupRole; email?: string },
): GroupRecord {
  const existing = group.members.find((m) => m.id === memberId);
  if (!existing) throw new Error("Member not found in this group.");

  const nextName = patch.name !== undefined ? patch.name.trim() : existing.name;
  if (!nextName || nextName.length > 80) {
    throw new Error("Enter a member name between 1 and 80 characters.");
  }
  if (
    group.members.some(
      (member) => member.id !== memberId && member.name.toLocaleLowerCase() === nextName.toLocaleLowerCase(),
    )
  ) {
    throw new Error(`${nextName} is already in ${group.name}.`);
  }

  const nextRole = patch.role ?? existing.role;
  const transferringOwnership = nextRole === "owner" && existing.id !== group.ownerMemberId;
  if (existing.id === group.ownerMemberId && nextRole !== "owner") {
    throw new Error("Transfer ownership to another member before changing the current owner's role.");
  }

  const updatedMembers = group.members.map((member) => {
    if (member.id === memberId) {
      return {
        ...member,
        name: nextName,
        initials: deriveInitials(nextName),
        role: nextRole,
        email: patch.email !== undefined ? patch.email.trim() || undefined : member.email,
      };
    }
    if (transferringOwnership && member.role === "owner") {
      return { ...member, role: "organizer" as GroupRole };
    }
    return member;
  });

  const nameChanged = nextName !== existing.name;
  const updatedExpenses = nameChanged
    ? group.expenses.map((expense) =>
        expense.paidByMemberId === memberId || expense.submittedBy === existing.name
          ? { ...expense, submittedBy: nextName }
          : expense,
      )
    : group.expenses;

  const updatedSettlements = nameChanged
    ? group.settlements.map((s) => ({
        ...s,
        fromName: s.fromMemberId === memberId ? nextName : s.fromName,
        toName: s.toMemberId === memberId ? nextName : s.toName,
      }))
    : group.settlements;

  return {
    ...group,
    ownerMemberId: transferringOwnership ? memberId : group.ownerMemberId,
    members: updatedMembers,
    expenses: updatedExpenses,
    settlements: updatedSettlements,
    updatedAt: new Date().toISOString(),
  };
}

export function transferGroupOwnership(group: GroupRecord, newOwnerMemberId: string): GroupRecord {
  return updateGroupMember(group, newOwnerMemberId, { role: "owner" });
}

export function removeGroupMember(group: GroupRecord, memberId: string): GroupRecord {
  const target = group.members.find((m) => m.id === memberId);
  if (!target) throw new Error("Member not found in this group.");
  if (group.members.length <= 1) {
    throw new Error("A group must keep at least one member.");
  }
  if (target.id === group.ownerMemberId || target.role === "owner") {
    throw new Error("Transfer group ownership to another member before removing the current organizer/owner.");
  }
  const hasExpenses = group.expenses.some(
    (expense) => expense.paidByMemberId === memberId || expense.submittedBy === target.name,
  );
  if (hasExpenses || target.paid > 0.005) {
    throw new Error(
      `${target.name} has recorded payments or expenses in this group. Reassign or remove those expenses before removing them.`,
    );
  }
  return {
    ...group,
    members: group.members.filter((m) => m.id !== memberId),
    updatedAt: new Date().toISOString(),
  };
}

export function addGroupExpense(
  group: GroupRecord,
  expense: Omit<GroupExpense, "id" | "verified" | "createdAt"> & { id?: string; createdAt?: string },
): { group: GroupRecord; expense: GroupExpense } {
  const title = expense.title.trim();
  if (!title || title.length > 140) {
    throw new Error("Enter an expense title under 140 characters.");
  }
  if (!Number.isFinite(expense.amount) || expense.amount <= 0 || expense.amount > 10_000_000) {
    throw new Error("Enter a valid expense amount greater than 0.");
  }
  const payer =
    group.members.find((m) => m.id === expense.paidByMemberId) ??
    group.members.find((m) => m.name === expense.submittedBy);
  if (!payer) throw new Error("Select a valid group member who paid this expense.");

  const created: GroupExpense = {
    id: expense.id ?? crypto.randomUUID(),
    title,
    category: expense.category,
    amount: roundMoney(expense.amount),
    submittedBy: payer.name,
    paidByMemberId: payer.id,
    verified: false,
    createdAt: expense.createdAt ?? "Just now",
    date: expense.date ?? new Date().toISOString().slice(0, 10),
    notes: expense.notes?.trim() ?? "",
    receiptName: expense.receiptName,
    receiptData: expense.receiptData,
  };

  const hasMatchingCategory = group.categories.some((c) => c.label === created.category);
  const nextCategories = group.categories.map((item) =>
    item.label === created.category || (!hasMatchingCategory && item.id === group.categories[0]?.id)
      ? { ...item, spent: roundMoney(item.spent + created.amount) }
      : item,
  );
  const nextDraft = group.draftCategories.map((item) =>
    item.label === created.category || (!hasMatchingCategory && item.id === group.draftCategories[0]?.id)
      ? { ...item, spent: roundMoney(item.spent + created.amount) }
      : item,
  );

  const contribution: ContributionRecord = {
    id: crypto.randomUUID(),
    memberId: payer.id,
    memberName: payer.name,
    amount: created.amount,
    currency: group.currency,
    source: "expense",
    note: created.title,
    createdAt: new Date().toISOString(),
  };

  return {
    expense: created,
    group: {
      ...group,
      expenses: [created, ...group.expenses],
      categories: nextCategories,
      draftCategories: nextDraft,
      members: group.members.map((m) =>
        m.id === payer.id ? { ...m, paid: roundMoney(m.paid + created.amount) } : m,
      ),
      contributions: [contribution, ...group.contributions],
      updatedAt: new Date().toISOString(),
    },
  };
}

export function updateGroupExpense(
  group: GroupRecord,
  expenseId: string,
  patch: {
    title?: string;
    amount?: number;
    category?: string;
    paidByMemberId?: string;
    date?: string;
    notes?: string;
  },
): GroupRecord {
  const existing = group.expenses.find((item) => item.id === expenseId);
  if (!existing) throw new Error("Expense not found.");

  const nextTitle = patch.title !== undefined ? patch.title.trim() : existing.title;
  if (!nextTitle || nextTitle.length > 140) {
    throw new Error("Enter an expense title under 140 characters.");
  }
  const nextAmount = patch.amount !== undefined ? roundMoney(patch.amount) : existing.amount;
  if (!Number.isFinite(nextAmount) || nextAmount <= 0 || nextAmount > 10_000_000) {
    throw new Error("Enter a valid expense amount greater than 0.");
  }

  const oldPayer =
    group.members.find((m) => m.id === existing.paidByMemberId) ??
    group.members.find((m) => m.name === existing.submittedBy);
  const newPayer =
    (patch.paidByMemberId
      ? group.members.find((m) => m.id === patch.paidByMemberId)
      : oldPayer) ?? oldPayer;
  if (!newPayer) throw new Error("Select a valid group member who paid.");

  const nextCategory = patch.category ?? existing.category;
  const amountChanged = Math.abs(nextAmount - existing.amount) > 0.001;

  const adjustCategories = (cats: Category[]) =>
    cats.map((cat) => {
      let spent = cat.spent;
      if (cat.label === existing.category) spent = Math.max(0, roundMoney(spent - existing.amount));
      if (cat.label === nextCategory) spent = roundMoney(spent + nextAmount);
      return { ...cat, spent };
    });

  const updatedMembers = group.members.map((member) => {
    let paid = member.paid;
    if (oldPayer && member.id === oldPayer.id) paid = Math.max(0, roundMoney(paid - existing.amount));
    if (member.id === newPayer.id) paid = roundMoney(paid + nextAmount);
    return { ...member, paid };
  });

  return {
    ...group,
    categories: adjustCategories(group.categories),
    draftCategories: adjustCategories(group.draftCategories),
    members: updatedMembers,
    expenses: group.expenses.map((item) =>
      item.id === expenseId
        ? {
            ...item,
            title: nextTitle,
            amount: nextAmount,
            category: nextCategory,
            paidByMemberId: newPayer.id,
            submittedBy: newPayer.name,
            date: patch.date ?? item.date,
            notes: patch.notes !== undefined ? patch.notes.trim() : item.notes,
            verified: amountChanged ? false : item.verified,
          }
        : item,
    ),
    updatedAt: new Date().toISOString(),
  };
}

export function verifyGroupExpense(group: GroupRecord, expenseId: string): { group: GroupRecord; expense: GroupExpense } {
  const expense = group.expenses.find((item) => item.id === expenseId);
  if (!expense) throw new Error("Expense not found.");
  if (!expense.receiptData) {
    throw new Error("A receipt attachment is required before verifying an expense.");
  }
  const updated = { ...expense, verified: true };
  return {
    expense: updated,
    group: {
      ...group,
      expenses: group.expenses.map((item) => (item.id === expenseId ? updated : item)),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function deleteGroupExpense(group: GroupRecord, expenseId: string): { group: GroupRecord; deleted: GroupExpense } {
  const existing = group.expenses.find((item) => item.id === expenseId);
  if (!existing) throw new Error("Expense not found.");

  const payer =
    group.members.find((m) => m.id === existing.paidByMemberId) ??
    group.members.find((m) => m.name === existing.submittedBy);

  const deductCategory = (cats: Category[]) =>
    cats.map((cat) =>
      cat.label === existing.category
        ? { ...cat, spent: Math.max(0, roundMoney(cat.spent - existing.amount)) }
        : cat,
    );

  return {
    deleted: existing,
    group: {
      ...group,
      categories: deductCategory(group.categories),
      draftCategories: deductCategory(group.draftCategories),
      members: group.members.map((m) =>
        payer && m.id === payer.id ? { ...m, paid: Math.max(0, roundMoney(m.paid - existing.amount)) } : m,
      ),
      expenses: group.expenses.filter((item) => item.id !== expenseId),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function applyGroupBudgetDraft(group: GroupRecord, draftCategories: Category[]): GroupRecord {
  const sanitized = draftCategories.map((item) => ({
    ...item,
    budget: Number.isFinite(item.budget) ? Math.max(0, Math.min(roundMoney(item.budget), MAX_BUDGET)) : 0,
  }));
  const totalBudget = roundMoney(sanitized.reduce((sum, item) => sum + item.budget, 0));
  return {
    ...group,
    totalBudget,
    categories: sanitized.map((item) => ({ ...item })),
    draftCategories: sanitized.map((item) => ({ ...item })),
    proposalRequested: false,
    updatedAt: new Date().toISOString(),
  };
}

export function addGroupBudgetCategory(
  group: GroupRecord,
  label: string,
  budget: number,
  color = "#9ccbf5",
): GroupRecord {
  const trimmed = label.trim();
  if (!trimmed || trimmed.length > 80) throw new Error("Enter a category name under 80 characters.");
  if (!Number.isFinite(budget) || budget < 0 || budget > MAX_BUDGET) {
    throw new Error("Enter a valid non-negative category budget.");
  }
  if (group.categories.some((c) => c.label.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
    throw new Error(`${trimmed} already exists in this group's budget.`);
  }
  const nextCat: Category = {
    id: `${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto.randomUUID().slice(0, 6)}`,
    label: trimmed,
    budget: roundMoney(budget),
    spent: 0,
    color,
  };
  const nextCategories = [...group.categories, nextCat];
  const nextDraft = [...group.draftCategories, { ...nextCat }];
  return {
    ...group,
    categories: nextCategories,
    draftCategories: nextDraft,
    totalBudget: roundMoney(nextCategories.reduce((sum, item) => sum + item.budget, 0)),
    updatedAt: new Date().toISOString(),
  };
}

export function recordGroupSettlement(
  group: GroupRecord,
  transfer: SettlementTransfer,
  note = "Recorded group settlement",
): { group: GroupRecord; settlement: SettlementRecord } {
  const fromMember = group.members.find((m) => m.name === transfer.from);
  const toMember = group.members.find((m) => m.name === transfer.to);
  if (!fromMember || !toMember || fromMember.id === toMember.id) {
    throw new Error("Select two distinct group members for this settlement.");
  }
  const amount = roundMoney(transfer.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Settlement amount must be greater than 0.");
  }
  if (toMember.paid + 0.01 < amount) {
    throw new Error(`Settlement exceeds ${toMember.name}'s recorded contribution balance.`);
  }

  const now = new Date().toISOString();
  const settlement: SettlementRecord = {
    id: crypto.randomUUID(),
    fromMemberId: fromMember.id,
    toMemberId: toMember.id,
    fromName: fromMember.name,
    toName: toMember.name,
    amount,
    currency: group.currency,
    status: "recorded",
    note: note.trim(),
    settledAt: now,
  };

  const contribution: ContributionRecord = {
    id: crypto.randomUUID(),
    memberId: fromMember.id,
    memberName: fromMember.name,
    recipientMemberId: toMember.id,
    recipientName: toMember.name,
    amount,
    currency: group.currency,
    source: "settlement",
    note: `Settled with ${toMember.name}`,
    createdAt: now,
  };

  return {
    settlement,
    group: {
      ...group,
      members: group.members.map((m) => {
        if (m.id === fromMember.id) return { ...m, paid: roundMoney(m.paid + amount) };
        if (m.id === toMember.id) return { ...m, paid: Math.max(0, roundMoney(m.paid - amount)) };
        return m;
      }),
      settlements: [settlement, ...group.settlements],
      contributions: [contribution, ...group.contributions],
      updatedAt: now,
    },
  };
}

export function getGroupSummary(group: GroupRecord) {
  const totalBudget = roundMoney(group.categories.reduce((sum, item) => sum + item.budget, 0));
  const draftTotal = roundMoney(group.draftCategories.reduce((sum, item) => sum + item.budget, 0));
  const totalSpent = roundMoney(group.categories.reduce((sum, item) => sum + item.spent, 0));
  const remaining = roundMoney(totalBudget - totalSpent);
  const unverifiedCount = group.expenses.filter((item) => !item.verified).length;
  const memberCount = group.members.length;
  const ownerMember =
    group.members.find((m) => m.id === group.ownerMemberId) ??
    group.members.find((m) => m.role === "owner") ??
    group.members[0] ??
    null;

  let balances = [] as ReturnType<typeof calculateBalances>;
  try {
    balances = calculateBalances(group.members, totalSpent);
  } catch {
    balances = [];
  }

  let transfers: SettlementTransfer[] = [];
  let settlementError = "";
  try {
    transfers = optimizeSettlements(group.members, totalSpent);
  } catch (error) {
    settlementError = error instanceof Error ? error.message : "Balances could not be reconciled.";
  }

  return {
    totalBudget,
    draftTotal,
    totalSpent,
    remaining,
    unverifiedCount,
    memberCount,
    ownerMember,
    balances,
    transfers,
    settlementError,
  };
}
