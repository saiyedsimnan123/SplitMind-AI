"use client";

import { LockKeyhole, RotateCcw, Send } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { AgentMessageList } from "@/components/AgentRail";

const STARTER_PROMPTS = [
  {
    label: "Plan a 3-day Goa trip for 8 under ₹40,000",
    prompt: "Plan a three-day Goa trip for eight friends under ₹40,000.",
  },
  {
    label: "What happens if someone cancels?",
    prompt: "What happens if one member cancels?",
  },
  {
    label: "What if hotel costs ₹3,000 more?",
    prompt: "We have an unexpected hotel expense of ₹3,000. Recalculate our budget.",
  },
  {
    label: "Who has not contributed yet?",
    prompt: "Who has not contributed yet?",
  },
];

export function AgentView({
  memberCount,
  messages,
  ask,
  isThinking,
  onChangeAsk,
  onSubmitQuestion,
  onClear,
}: {
  memberCount: number;
  messages: ChatMessage[];
  ask: string;
  isThinking: boolean;
  onChangeAsk: (value: string) => void;
  onSubmitQuestion: (question?: string) => void;
  onClear: () => void;
}) {
  return (
    <section className="panel agent-page">
      <div className="panel-heading">
        <div>
          <div className="section-kicker">YOUR GROUP CONTEXT · GOA TRIP 2026 · {memberCount} MEMBERS</div>
          <h2>Ask your group&apos;s money mind.</h2>
        </div>
        <button type="button" className="button button-outline" onClick={onClear}>
          <RotateCcw size={14} /> Reset chat
        </button>
      </div>

      <p className="muted-copy">
        Answers are computed from your current group numbers using deterministic calculation functions. Try a
        cancellation, an unexpected expense, or a contribution check.
      </p>

      <div className="agent-page-prompts">
        {STARTER_PROMPTS.map((item) => (
          <button
            type="button"
            key={item.label}
            onClick={() => onSubmitQuestion(item.prompt)}
            disabled={isThinking}
          >
            {item.label}
          </button>
        ))}
      </div>

      <AgentMessageList messages={messages} isThinking={isThinking} variant="page" />

      <form
        className="agent-page-composer"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitQuestion();
        }}
      >
        <input
          aria-label="Ask the group financial agent"
          placeholder="Ask a question about this group…"
          value={ask}
          onChange={(event) => onChangeAsk(event.target.value)}
        />
        <button className="button button-dark" type="submit" disabled={!ask.trim() || isThinking}>
          <Send size={14} /> Ask
        </button>
      </form>

      <div className="safety-note">
        <LockKeyhole size={14} />
        <span>
          Nothing changes without your say-so. Financial calculations always run deterministically on the server.
        </span>
      </div>
    </section>
  );
}
