import { describe, expect, it } from "vitest";
import { calculateBalances, optimizeSettlements, simulateBudget, splitAmount, splitByWeights, validateCustomSplit } from "@/lib/finance";
import { initialCategories, initialMembers } from "@/lib/demo-data";

describe("SmartSplit calculations", () => {
  it("allocates integer paise fairly without losing remainder", () => {
    const shares = splitAmount(10001, 3);
    expect(shares).toEqual([3334, 3334, 3333]);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(10001);
  });

  it("rejects fractional paise and invalid group sizes", () => {
    expect(() => splitAmount(1.5, 3)).toThrow(/whole number of paise/);
    expect(() => splitAmount(100, 0)).toThrow(/positive whole number/);
  });

  it("allocates weighted percentage or usage-based shares with exact paise totals", () => {
    expect(splitByWeights(101, [50, 30, 20])).toEqual([51, 30, 20]);
    expect(splitByWeights(100, [1, 2, 1])).toEqual([25, 50, 25]);
    expect(splitByWeights(100, [0, 3])).toEqual([0, 100]);
    expect(() => splitByWeights(100, [0, 0])).toThrow(/at least one positive value/);
  });

  it("accepts custom shares only when they reconcile exactly", () => {
    expect(validateCustomSplit(1000, [250, 300, 450])).toEqual([250, 300, 450]);
    expect(() => validateCustomSplit(1000, [250, 300, 449])).toThrow(/exact group total/);
  });

  it("calculates contributions against a shared equal share", () => {
    const balances = calculateBalances(initialMembers, 23550);
    expect(balances).toHaveLength(8);
    expect(balances.reduce((sum, member) => sum + member.balance, 0)).toBeCloseTo(0, 8);
    expect(balances.find((member) => member.name === "Sana Khan")?.outstanding).toBeCloseTo(2943.75);
  });

  it("reduces settlement to a small set of exact, balanced transfers", () => {
    const transfers = optimizeSettlements(initialMembers, 23550);
    expect(transfers.length).toBeLessThanOrEqual(initialMembers.length - 1);
    expect(transfers.every((transfer) => transfer.amount > 0)).toBe(true);
    const debtors = new Map<string, number>();
    const creditors = new Map<string, number>();
    transfers.forEach(({ from, to, amount }) => {
      debtors.set(from, (debtors.get(from) ?? 0) + amount);
      creditors.set(to, (creditors.get(to) ?? 0) + amount);
    });

    expect([...debtors.values()].reduce((sum, amount) => sum + amount, 0)).toBeCloseTo(9525);
    expect([...creditors.values()].reduce((sum, amount) => sum + amount, 0)).toBeCloseTo(9525);
  });

  it("does not suggest a settlement if submitted expenses exceed payments", () => {
    expect(() => optimizeSettlements(initialMembers, 24550)).toThrow(/must match submitted group expenses/);
  });

  it("simulates a cost and a cancellation without mutating the plan", () => {
    const original = JSON.stringify(initialCategories);
    const result = simulateBudget(initialCategories, initialMembers, 3000, "m8");
    expect(result).toMatchObject({ activeMembers: 7, revisedBudget: 43000, extraCost: 3000 });
    expect(result.perPerson).toBeCloseTo(43000 / 7);
    expect(JSON.stringify(initialCategories)).toBe(original);
  });

  it("rejects a simulation that removes every member", () => {
    expect(() => simulateBudget(initialCategories, [initialMembers[0]], 0, "m1")).toThrow(/At least one member/);
  });
});
