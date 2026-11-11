import { describe, expect, it } from "vitest";
import { createInitialGoaGroup } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/finance";
import {
  addGroupExpense,
  addGroupMember,
  applyGroupBudgetDraft,
  archiveGroupRecord,
  createGroupRecord,
  deleteGroupExpense,
  getGroupSummary,
  recordGroupSettlement,
  removeGroupMember,
  restoreGroupRecord,
  transferGroupOwnership,
  updateGroupExpense,
  updateGroupMember,
  updateGroupRecord,
  verifyGroupExpense,
} from "@/lib/groups";

describe("Multi-group isolation and financial lifecycle", () => {
  it("preserves Goa Trip 2026 sample data and balances", () => {
    const goa = createInitialGoaGroup();
    const summary = getGroupSummary(goa);

    expect(goa.name).toBe("Goa Trip 2026");
    expect(goa.currency).toBe("INR");
    expect(goa.members).toHaveLength(8);
    expect(goa.expenses).toHaveLength(4);
    expect(summary.totalBudget).toBe(40000);
    expect(summary.totalSpent).toBe(23550);
    expect(summary.remaining).toBe(16450);
    expect(summary.settlementError).toBe("");
    expect(summary.transfers.length).toBeGreaterThan(0);
  });

  it("creates independent groups without mixing expenses or financial calculations", () => {
    const goa = createInitialGoaGroup();
    const flat = createGroupRecord({
      name: "Indiranagar Flat 4B",
      planType: "roommates",
      description: "Shared apartment rent and utilities",
      currency: "USD",
      totalBudget: 2000,
      startDate: "2026-11-01",
      endDate: null,
      ownerName: "Alex Kim",
    });

    const flatSummary = getGroupSummary(flat);
    expect(flat.id).not.toBe(goa.id);
    expect(flat.expenses).toEqual([]);
    expect(flatSummary.totalBudget).toBe(2000);
    expect(flatSummary.totalSpent).toBe(0);
    expect(flatSummary.remaining).toBe(2000);
    expect(flat.members).toHaveLength(1);
    expect(flat.members[0].role).toBe("owner");

    // Add roommate and expense only in flat
    const added = addGroupMember(flat, { name: "Maya Patel" });
    const withExpense = addGroupExpense(added.group, {
      title: "November fiber internet",
      category: flat.categories[1].label,
      amount: 120,
      paidByMemberId: added.member.id,
      submittedBy: added.member.name,
    });

    const updatedFlatSummary = getGroupSummary(withExpense.group);
    const goaSummary = getGroupSummary(goa);

    expect(updatedFlatSummary.totalSpent).toBe(120);
    expect(updatedFlatSummary.remaining).toBe(1880);
    expect(updatedFlatSummary.transfers).toEqual([{ from: "Alex Kim", to: "Maya Patel", amount: 60 }]);

    // Goa remains completely untouched
    expect(goaSummary.totalSpent).toBe(23550);
    expect(goa.expenses).toHaveLength(4);
  });

  it("validates dates, edits group details, scales budgets, and archives/restores groups", () => {
    expect(() =>
      createGroupRecord({
        name: "Bad Dates",
        planType: "event",
        currency: "EUR",
        totalBudget: 500,
        startDate: "2026-12-10",
        endDate: "2026-12-01",
      }),
    ).toThrow(/End date cannot be earlier/);

    const group = createGroupRecord({
      name: "Winter Summit",
      planType: "event",
      currency: "EUR",
      totalBudget: 1000,
      startDate: "2026-12-01",
      endDate: "2026-12-03",
      ownerName: "Alex Kim",
    });

    const updated = updateGroupRecord(group, {
      name: "Winter Summit 2026",
      totalBudget: 2000,
    });
    expect(updated.name).toBe("Winter Summit 2026");
    expect(updated.categories.reduce((sum, c) => sum + c.budget, 0)).toBe(2000);

    const archived = archiveGroupRecord(updated);
    expect(archived.archivedAt).not.toBeNull();

    const restored = restoreGroupRecord(archived);
    expect(restored.archivedAt).toBeNull();
  });

  it("enforces member permissions and guards against removing owners or payers", () => {
    const group = createGroupRecord({
      name: "Hackathon Sprint",
      planType: "project",
      currency: "USD",
      totalBudget: 1200,
      startDate: "2026-11-11",
      ownerName: "Alex Kim",
    });
    const { group: g1, member: sam } = addGroupMember(group, { name: "Samira" });
    const { group: g2, member: leo } = addGroupMember(g1, { name: "Leo" });

    // Owner cannot be removed without transferring ownership
    expect(() => removeGroupMember(g2, g2.ownerMemberId)).toThrow(/Transfer group ownership/);

    // Member with recorded expense cannot be removed directly
    const { group: g3 } = addGroupExpense(g2, {
      title: "Cloud GPU credits",
      category: g2.categories[0].label,
      amount: 300,
      paidByMemberId: sam.id,
      submittedBy: sam.name,
    });
    expect(() => removeGroupMember(g3, sam.id)).toThrow(/has recorded payments or expenses/);

    // Member with 0 paid and no expenses can be removed cleanly
    const g4 = removeGroupMember(g3, leo.id);
    expect(g4.members.some((m) => m.id === leo.id)).toBe(false);

    // Transfer ownership to Samira and update member display name
    const g5 = transferGroupOwnership(g4, sam.id);
    expect(g5.ownerMemberId).toBe(sam.id);
    expect(g5.members.find((m) => m.id === sam.id)?.role).toBe("owner");
    expect(g5.members.find((m) => m.name === "Alex Kim")?.role).toBe("organizer");

    const g6 = updateGroupMember(g5, sam.id, { name: "Samira Rao" });
    expect(g6.expenses[0].submittedBy).toBe("Samira Rao");
  });

  it("handles expense edits, receipt verification, deletion, budget updates, and settlement recording", () => {
    const base = createGroupRecord({
      name: "Team Offsite",
      planType: "trip",
      currency: "GBP",
      totalBudget: 1000,
      startDate: "2026-11-12",
      ownerName: "Alex",
    });
    const { group: withMember, member: priya } = addGroupMember(base, { name: "Priya" });

    const { group: withExp, expense } = addGroupExpense(withMember, {
      title: "Train tickets",
      category: withMember.categories[1].label,
      amount: 200,
      paidByMemberId: priya.id,
      submittedBy: priya.name,
      receiptName: "ticket.png",
      receiptData: "data:image/png;base64,iVBORw0KGgo=",
    });

    // Receipt verification works with attachment
    const { group: verifiedGroup } = verifyGroupExpense(withExp, expense.id);
    expect(verifiedGroup.expenses[0].verified).toBe(true);

    // Editing amount recalculates spend and paid balance and resets verification
    const edited = updateGroupExpense(verifiedGroup, expense.id, { amount: 240 });
    expect(edited.expenses[0].verified).toBe(false);
    expect(getGroupSummary(edited).totalSpent).toBe(240);
    expect(edited.members.find((m) => m.id === priya.id)?.paid).toBe(240);

    // Record suggested settlement (Alex -> Priya 120)
    const beforeSettle = getGroupSummary(edited);
    expect(beforeSettle.transfers).toEqual([{ from: "Alex", to: "Priya", amount: 120 }]);
    const { group: settled } = recordGroupSettlement(edited, beforeSettle.transfers[0]);
    const afterSettle = getGroupSummary(settled);
    expect(afterSettle.transfers).toEqual([]);
    expect(settled.settlements).toHaveLength(1);

    // Budget update recalculates remaining balance
    const updatedBudgetGroup = applyGroupBudgetDraft(
      settled,
      settled.categories.map((c, idx) => (idx === 0 ? { ...c, budget: c.budget + 500 } : c)),
    );
    expect(getGroupSummary(updatedBudgetGroup).totalBudget).toBe(1500);
    expect(getGroupSummary(updatedBudgetGroup).remaining).toBe(1260);

    // Delete expense updates category spent cleanly
    const { group: deletedGroup } = deleteGroupExpense(updatedBudgetGroup, expense.id);
    expect(deletedGroup.expenses).toHaveLength(0);
    expect(getGroupSummary(deletedGroup).totalSpent).toBe(0);

    // Multi-currency formatter works cleanly
    expect(formatCurrency(120, "USD")).toContain("$120");
    expect(formatCurrency(120, "GBP")).toContain("£120");
  });
});
