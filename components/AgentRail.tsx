"use client";

import { ArrowUpRight, Bot, CircleHelp, FileText, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";

export function AgentMessageList({
  messages,
  isThinking,
  userInitials = "AK",
  variant = "rail",
}: {
  messages: ChatMessage[];
  isThinking: boolean;
  userInitials?: string;
  variant?: "rail" | "page";
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isThinking]);

  return (
    <div className={variant === "rail" ? "chat-log" : "agent-page-messages"}>
      {messages.map((message, index) => (
        <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
          <span className="message-avatar" aria-hidden="true">
            {message.role === "assistant" ? <Sparkles size={13} /> : userInitials}
          </span>
          <div className="message-body">
            <div className="message-text">{message.text}</div>
            {message.calculations && message.calculations.length > 0 && (
              <div className="calculation-card">
                <div className="calc-head">
                  <FileText size={12} /> THE MATH
                </div>
                {message.calculations.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            )}
            {message.source && <small className="message-source">{message.source}</small>}
          </div>
        </div>
      ))}
      {isThinking && (
        <div className="message assistant">
          <span className="message-avatar" aria-hidden="true">
            <Sparkles size={13} />
          </span>
          <div className="thinking" aria-label="Calculating from group numbers">
            <i />
            <i />
            <i />
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

export function AgentRail({
  groupName,
  memberCount,
  userInitials,
  messages,
  ask,
  isThinking,
  drawerOpen,
  onCloseDrawer,
  onChangeAsk,
  onSubmitQuestion,
  onClear,
}: {
  groupName: string;
  memberCount: number;
  userInitials?: string;
  messages: ChatMessage[];
  ask: string;
  isThinking: boolean;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
  onChangeAsk: (value: string) => void;
  onSubmitQuestion: (question?: string) => void;
  onClear: () => void;
}) {
  return (
    <>
      {drawerOpen && (
        <button
          type="button"
          className="mobile-backdrop copilot-backdrop"
          onClick={onCloseDrawer}
          aria-label="Close AI Money Mind panel"
        />
      )}
      <aside className={`agent-rail ${drawerOpen ? "agent-rail-open" : ""}`} aria-label="Group money mind assistant">
        <div className="rail-head">
          <div className="rail-title">
            <span className="rail-mark">
              <Bot size={17} />
            </span>
            <div>
              <strong>AI Group Agent</strong>
              <small>
                <i /> DETERMINISTIC + GEMINI
              </small>
            </div>
          </div>

          <div className="rail-head-actions">
            <button
              type="button"
              className="more-button"
              onClick={onClear}
              aria-label="Reset conversation"
              title="Reset conversation"
            >
              <RotateCcw size={15} />
            </button>
            <button
              type="button"
              className="icon-button copilot-close"
              onClick={onCloseDrawer}
              aria-label="Close Money Mind panel"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="context-chip">
          <span>✦</span> {groupName} <span className="context-divider" /> {memberCount} member
          {memberCount === 1 ? "" : "s"}
        </div>

        <AgentMessageList
          messages={messages}
          isThinking={isThinking}
          userInitials={userInitials}
          variant="rail"
        />

        <div className="chat-suggestions">
          <span>TRY ASKING</span>
          <button type="button" onClick={() => onSubmitQuestion("Who hasn't contributed yet?")}>
            <span>Who hasn&apos;t contributed yet?</span>
            <ArrowUpRight size={13} />
          </button>
          <button type="button" onClick={() => onSubmitQuestion("What happens if one member cancels?")}>
            <span>What if one person cancels?</span>
            <ArrowUpRight size={13} />
          </button>
        </div>

        <form
          className="chat-composer"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitQuestion();
          }}
        >
          <input
            aria-label="Ask your group money mind"
            placeholder={`Ask about ${groupName}...`}
            value={ask}
            onChange={(event) => onChangeAsk(event.target.value)}
          />
          <button type="submit" disabled={!ask.trim() || isThinking} aria-label="Send message">
            <Send size={15} />
          </button>
        </form>

        <div className="agent-disclaimer">
          <CircleHelp size={13} />
          <span>AI explanations use {groupName}&apos;s numbers. Nothing changes without your say-so.</span>
        </div>
      </aside>
    </>
  );
}
