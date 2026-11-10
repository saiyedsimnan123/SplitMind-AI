export type Member = { id: string; name: string; initials: string; color: string; paid: number };
export type Category = { id: string; label: string; budget: number; spent: number; color: string };
export type Expense = { id: string; title: string; category: string; amount: number; submittedBy: string; verified: boolean; createdAt: string; receiptName?: string; receiptData?: string };

export function splitAmount(total: number, people: number): number[] {
  if (!Number.isSafeInteger(people) || people < 1) throw new Error("People must be a positive whole number.");
  return splitByWeights(total, Array.from({ length: people }, () => 1));
}

export function splitByWeights(total: number, weights: number[]): number[] {
  if (!Number.isSafeInteger(total) || total < 0) throw new Error("Total must be a non-negative whole number of paise.");
  if (!weights.length || weights.some((weight) => !Number.isFinite(weight) || weight < 0) || weights.every((weight) => weight === 0)) {
    throw new Error("Split weights must be non-negative and include at least one positive value.");
  }
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  if (!Number.isFinite(weightTotal)) throw new Error("Split weights exceed the supported range.");
  const portions = weights.map((weight) => total * (weight / weightTotal));
  const result = portions.map(Math.floor);
  let remainder = total - result.reduce((sum, value) => sum + value, 0);
  const order = portions.map((portion, index) => ({ index, fraction: portion - result[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; remainder > 0; index++, remainder--) result[order[index % order.length].index]++;
  return result;
}

export function validateCustomSplit(total: number, amounts: number[]) {
  if (!Number.isSafeInteger(total) || total < 0 || !amounts.length ||
      amounts.some((amount) => !Number.isSafeInteger(amount) || amount < 0) ||
      amounts.reduce((sum, amount) => sum + amount, 0) !== total) {
    throw new Error("Custom shares must be non-negative whole paise and add up to the exact group total.");
  }
  return [...amounts];
}

export function calculateBalances(members: Member[], totalSpent: number) {
  if (!Number.isFinite(totalSpent) || totalSpent < 0) throw new Error("Total spent must be a non-negative amount.");
  if (!members.length) throw new Error("At least one member is required.");
  const share = totalSpent / members.length;
  return members.map((member) => ({
    ...member,
    share,
    balance: member.paid - share,
    outstanding: Math.max(0, share - member.paid),
  })).sort((a, b) => b.balance - a.balance);
}

export function optimizeSettlements(members: Member[], totalSpent: number) {
  const balances = calculateBalances(members, totalSpent).map(({ id, name, balance }) => ({ id, name, balance }));
  const unbalancedTotal = balances.reduce((sum, item) => sum + item.balance, 0);
  if (Math.abs(unbalancedTotal) > 0.01) throw new Error("Recorded payments must match submitted group expenses before settlements can be suggested.");
  const creditors = balances.filter((item) => item.balance > 0.005).sort((a, b) => b.balance - a.balance);
  const debtors = balances.filter((item) => item.balance < -0.005).sort((a, b) => a.balance - b.balance);
  const transfers: { from: string; to: string; amount: number }[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(-debtors[d].balance, creditors[c].balance);
    if (amount > 0.005) transfers.push({ from: debtors[d].name, to: creditors[c].name, amount: Math.round(amount * 100) / 100 });
    debtors[d].balance += amount;
    creditors[c].balance -= amount;
    if (Math.abs(debtors[d].balance) < 0.005) d++;
    if (Math.abs(creditors[c].balance) < 0.005) c++;
  }
  return transfers;
}

export function simulateBudget(categories: Category[], members: Member[], extraCost: number, cancelledMemberId?: string) {
  if (!Number.isFinite(extraCost) || extraCost < 0) throw new Error("Unexpected cost must be a non-negative amount.");
  const active = members.filter((member) => member.id !== cancelledMemberId);
  if (!active.length) throw new Error("At least one member must remain in the group.");
  const revisedBudget = categories.reduce((sum, category) => sum + category.budget, 0) + extraCost;
  const currentBudget = revisedBudget - extraCost;
  return {
    activeMembers: active.length,
    revisedBudget,
    perPerson: revisedBudget / active.length,
    previousPerPerson: currentBudget / members.length,
    extraCost,
  };
}

export function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
