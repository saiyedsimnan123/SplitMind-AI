import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/agent/route";
import { initialCategories, initialMembers } from "@/lib/demo-data";

describe("AI group financial agent", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the financial functions and identifies outstanding contributions", async () => {
    const response = await POST(new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "Who has not contributed?", members: initialMembers, categories: initialCategories }),
    }));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.source).toBe("SplitMind deterministic engine");
    expect(result.answer).toContain("Sana Khan");
    expect(result.calculations).toContain("Equal share across 8 members: ₹2,943.75 each");
  });

  it("describes a cancellation as a simulation without changing the plan", async () => {
    const response = await POST(new Request("http://localhost/api/agent", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "What happens if one member cancels?", members: initialMembers, categories: initialCategories }),
    }));
    const result = await response.json();
    expect(result.answer).toContain("7 remaining friends");
    expect(result.answer).toContain("does not change your agreement");
    expect(result.source).toBe("SplitMind deterministic engine");
  });

  it("extracts numeric group size, trip duration, purpose, and budget from a natural-language plan", async () => {
    const response = await POST(new Request("http://localhost/api/agent", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "Plan a three-day Goa trip for eight friends under ₹40,000.", members: initialMembers, categories: initialCategories }),
    }));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.calculations).toContain("Group size: 8");
    expect(result.calculations).toContain("Duration: 3 days");
    expect(result.calculations).toContain("Purpose: Goa trip");
    expect(result.calculations).toContain("Suggested equal contribution: ₹5,000 each");
  });

  it("validates request shape and question length", async () => {
    const response = await POST(new Request("http://localhost/api/agent", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "x", members: [], categories: [] }),
    }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/question/i);
  });

  it("does not silently fall back when configured Gemini is unavailable", async () => {
    const priorKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
    try {
      const response = await POST(new Request("http://localhost/api/agent", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: "Who has not contributed?", members: initialMembers, categories: initialCategories }),
      }));
      expect(response.status).toBe(502);
      expect((await response.json()).error).toContain("did not silently switch providers");
    } finally {
      if (priorKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = priorKey;
    }
  });
});
