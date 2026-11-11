import {
  calculateBalances,
  formatCurrency,
  simulateBudget,
  type Category,
  type Member,
} from "@/lib/finance";
import { getRequestSession } from "@/lib/supabase/auth";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import type { CurrencyCode } from "@/lib/types";
import { NextResponse } from "next/server";

type AgentRequest = {
  question?: unknown;
  members?: unknown;
  categories?: unknown;
  currency?: unknown;
  groupName?: unknown;
};
const maxMembers = 30;

function isMembers(input: unknown): input is Member[] {
  return (
    Array.isArray(input) &&
    input.length > 0 &&
    input.length <= maxMembers &&
    input.every(
      (item) =>
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        item.name.length <= 80 &&
        typeof item.paid === "number" &&
        Number.isFinite(item.paid) &&
        item.paid >= 0 &&
        item.paid <= 100_000_000,
    )
  );
}

function isCategories(input: unknown): input is Category[] {
  return (
    Array.isArray(input) &&
    input.length > 0 &&
    input.length <= 30 &&
    input.every(
      (item) =>
        typeof item.id === "string" &&
        typeof item.label === "string" &&
        item.label.length <= 80 &&
        typeof item.budget === "number" &&
        Number.isFinite(item.budget) &&
        item.budget >= 0 &&
        item.budget <= 100_000_000 &&
        typeof item.spent === "number" &&
        Number.isFinite(item.spent) &&
        item.spent >= 0 &&
        item.spent <= 100_000_000,
    )
  );
}

function parseCurrency(raw: unknown): CurrencyCode {
  return raw === "USD" || raw === "EUR" || raw === "GBP" ? raw : "INR";
}

function deterministicAnswer(
  question: string,
  members: Member[],
  categories: Category[],
  currency: CurrencyCode,
  groupName?: string,
) {
  const fmt = (amount: number) => formatCurrency(amount, currency);
  const totalSpent = categories.reduce((sum, item) => sum + item.spent, 0);
  const totalBudget = categories.reduce((sum, item) => sum + item.budget, 0);
  const normalized = question.toLowerCase();
  const calculations: string[] = [];
  const label = groupName?.trim() || "this group";

  if (/cancel|drop out|can't make|cannot make/.test(normalized)) {
    const result = simulateBudget(categories, members, 0, members.at(-1)?.id);
    calculations.push(
      `Current planned total: ${fmt(totalBudget)}`,
      `People in this scenario: ${result.activeMembers}`,
      `Suggested share: ${fmt(result.perPerson)} each (was ${fmt(result.previousPerPerson)})`,
    );
    return {
      answer: `If one person drops out and the total plan stays the same, the suggested share rises to ${fmt(result.perPerson)} for each of the ${result.activeMembers} remaining friends. This is only a simulation—it does not change your agreement.`,
      calculations,
    };
  }
  if (/who|contribut|paid|owe|settle|balance/.test(normalized)) {
    const balances = calculateBalances(members, totalSpent);
    const owing = balances.filter((member) => member.outstanding >= 1);
    calculations.push(
      `Shared submitted spend: ${fmt(totalSpent)}`,
      `Equal share across ${members.length} members: ${fmt(totalSpent / members.length)} each`,
      `Contributions compared with each member's equal share`,
    );
    const answer = owing.length
      ? `Based on the expense entries so far, ${owing.map((member) => `${member.name} (${fmt(member.outstanding)})`).join(", ")} still need to cover their equal share. These are suggested balances, not confirmed debts.`
      : "Everyone has covered at least their equal share of submitted expenses so far. The current expense ledger may still contain unverified entries.";
    return { answer, calculations };
  }
  const costMatch = normalized.match(
    /(?:unexpected|extra|additional|hotel|expense|cost)[^\d₹$€£]{0,30}[₹$€£]?\s*([\d,]+(?:\.\d{1,2})?)/,
  );
  if (/budget|expense|cost|what if|what-if|recalculat/.test(normalized) && costMatch) {
    const extraCost = Number(costMatch[1].replaceAll(",", ""));
    if (!Number.isFinite(extraCost) || extraCost > 100_000_000)
      throw new Error("Please keep the simulated cost below 100,000,000.");
    const result = simulateBudget(categories, members, extraCost);
    calculations.push(
      `Current planned total: ${fmt(totalBudget)}`,
      `Unexpected cost: ${fmt(extraCost)}`,
      `Revised scenario total: ${fmt(result.revisedBudget)}`,
      `Suggested share across ${result.activeMembers} friends: ${fmt(result.perPerson)}`,
    );
    return {
      answer: `Adding ${fmt(extraCost)} would bring the scenario total to ${fmt(result.revisedBudget)}, or about ${fmt(result.perPerson)} per friend. This doesn't change your agreed budget.`,
      calculations,
    };
  }
  const numberWords: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const groupMatch = normalized.match(
    /(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:friends|people|members|of us)/,
  );
  const requestedPeople = groupMatch ? Number(groupMatch[1]) || numberWords[groupMatch[1]] : undefined;
  const budgetMatch = normalized.match(
    /(?:under|budget(?:\s+of)?|₹|\$|€|£|inr\s*|usd\s*)\s*[₹$€£]?\s*([\d,]+(?:\.\d{1,2})?)\s*(k)?/,
  );
  if (/\bplan\b/.test(normalized) && (groupMatch || budgetMatch)) {
    const count = requestedPeople ? Math.min(requestedPeople, maxMembers) : members.length;
    const proposedBudget = budgetMatch
      ? Number(budgetMatch[1].replaceAll(",", "")) * (budgetMatch[2] ? 1000 : 1)
      : totalBudget;
    if (proposedBudget > 0 && Number.isFinite(proposedBudget)) {
      const duration = normalized.match(/(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)[-\s]day/);
      const days = duration ? Number(duration[1]) || numberWords[duration[1]] : undefined;
      const destination = normalized.includes("goa")
        ? "Goa"
        : normalized.match(/\btrip to ([a-z]{3,20})\b/)?.[1];
      const context = [days && `${days}-day`, destination && `${destination}`, "trip"]
        .filter(Boolean)
        .join(" ");
      calculations.push(
        `Requested budget: ${fmt(proposedBudget)}`,
        `Group size: ${count}`,
        ...(days ? [`Duration: ${days} days`] : []),
        ...(destination ? [`Purpose: ${destination} trip`] : []),
        `Suggested equal contribution: ${fmt(proposedBudget / count)} each`,
        `Starting category mix based on this group's plan`,
      );
      return {
        answer: `For ${count} friends${context ? ` on a ${context}` : ""} with a ${fmt(proposedBudget)} cap, a good first draft is ${fmt(proposedBudget / count)} each. I can use your current category mix as a starting point. Review it with the group before treating it as agreed.`,
        calculations,
      };
    }
  }
  calculations.push(
    `Active group: ${label}`,
    `Current planned budget: ${fmt(totalBudget)}`,
    `Submitted expenses: ${fmt(totalSpent)}`,
    `Members in this group: ${members.length}`,
  );
  return {
    answer: `I can help with ${label}'s current budget, submitted expense balances, a member cancellation, or an unexpected cost. Try asking “What if we add 3,000?” or “Who hasn’t contributed yet?”`,
    calculations,
  };
}

export async function POST(request: Request) {
  try {
    if (isSupabaseAuthConfigured()) {
      const session = await getRequestSession(request);
      if (!session) {
        return NextResponse.json({ error: "Authentication is required to use the financial agent." }, { status: 401 });
      }
    }

    const body = (await request.json()) as AgentRequest;
    if (typeof body.question !== "string" || body.question.trim().length < 2 || body.question.length > 600) {
      return NextResponse.json({ error: "Ask a question between 2 and 600 characters." }, { status: 400 });
    }
    if (!isMembers(body.members) || !isCategories(body.categories)) {
      return NextResponse.json({ error: "The group context is incomplete or invalid." }, { status: 400 });
    }
    const currency = parseCurrency(body.currency);
    const groupName = typeof body.groupName === "string" ? body.groupName.slice(0, 100) : undefined;
    const result = deterministicAnswer(body.question.trim(), body.members, body.categories, currency, groupName);
    const key = process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({ ...result, source: "SplitMind deterministic engine" });

    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Answer the group's question in a friendly concise way using only these verified calculation results. Do not recalculate, add facts, or claim to change an agreement. If something is only a simulation, say so. Group: ${groupName ?? "SplitMind group"}\nQuestion: ${body.question}\nCalculation results: ${JSON.stringify(result.calculations)}\nDeterministic answer: ${result.answer}`,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.2, maxOutputTokens: 220 },
        }),
      },
    );
    if (!response.ok)
      return NextResponse.json(
        { error: "Gemini is configured but unavailable. Please retry; the app did not silently switch providers." },
        { status: 502 },
      );
    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!answer?.trim())
      return NextResponse.json({ error: "Gemini returned no explanation. Please retry." }, { status: 502 });
    return NextResponse.json({ ...result, answer, source: `Gemini (${model}) · calculation results from SplitMind` });
  } catch (error) {
    if (error instanceof SyntaxError)
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The financial calculation could not be completed." },
      { status: 400 },
    );
  }
}
