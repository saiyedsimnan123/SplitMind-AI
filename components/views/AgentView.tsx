"use client";

import { LockKeyhole, RotateCcw, Send } from "lucide-react";
import { getCurrencySymbol } from "@/lib/finance";
import type { ChatMessage, CurrencyCode } from "@/lib/types";
import { AgentMessageList } from "@/components/AgentRail";

export function AgentView({
  groupName,
  currency,
  memberCount,
  userInitials,
  messages,
  ask,
  isThinking,
  onChangeAsk,
  onSubmitQuestion,
  onClear,
}: {
  groupName: string;
  currency: CurrencyCode;
  memberCount: number;
  userInitials?: string;
  messages: ChatMessage[];
  ask: string;
  isThinking: boolean;
  onChangeAsk: (value: string) => void;
  onSubmitQuestion: (question?: string) => void;
  onClear: () => void;
}) {
  const symbol = getCurrencySymbol(currency);
  const starterPrompts = [
    {
      label: `Who has not contributed yet?`,
      prompt: `Who has not contributed yet?`,
    },
    {
      label: `What happens if someone cancels?`,
      prompt: `What happens if one member cancels?`,
    },
    {
      label: `What if expenses rise by ${symbol}3,000?`,
      prompt: `We have an unexpected expense of ${symbol}3,000. Recalculate our budget.`,
    },
    {
      label: `Plan a ${memberCount}-person budget under ${symbol}40,000`,
      prompt: `Plan a three-day trip for ${memberCount} friends under ${symbol}40,000.`,
    },
  ];

  return (
    <section className="panel agent-page">
      <div className="panel-heading">
        <div>
          <div className="section-kicker">
            GROUP CONTEXT · {groupName.toUpperCase()} · {memberCount} MEMBER{memberCount === 1 ? "" : "S"}
          </div>
          <h2>Ask your group&apos;s money mind.</h2>
        </div>
        <button type="button" className="button button-outline" onClick={onClear}>
          <RotateCcw size={14} /> Reset chat
        </button>
      </div>

      <p className="muted-copy">
        Answers are computed from {groupName}&apos;s current numbers in {currency} using deterministic
        calculation functions.
      </p>

      <div className="agent-page-prompts">
        {starterPrompts.map((item) => (
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

      <AgentMessageList
        messages={messages}
        isThinking={isThinking}
        userInitials={userInitials}
        variant="page"
      />

      <form
        className="agent-page-composer"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitQuestion();
        }}
      >
        <input
          aria-label="Ask the group financial agent"
          placeholder={`Ask a question about ${groupName}…`}
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
