"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUpRight, Square } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { canSubmit, keyIntent, turnStatus } from "./ChatPanel.logic";
import type { ChatMessage } from "@/types/chat";

interface ChatPanelProps {
  messages: ChatMessage[];
  venueName: string;
  onSubmit: (text: string) => void;
  // Optional: aborts the active stream. When provided and isStreaming is
  // true, the send button becomes a stop button.
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  suggestedPrompts?: string[];
}

const TEXTAREA_MAX_PX = 128;
const STICK_THRESHOLD_PX = 64;
const STOP_LABEL = "Stop generating";
const SEND_LABEL = "Send message";

export function ChatPanel({
  messages,
  venueName,
  onSubmit,
  onStop,
  isStreaming = false,
  disabled = false,
  suggestedPrompts = [],
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottomRef = useRef(true);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, TEXTAREA_MAX_PX)}px`;
  }, [input]);

  function handleListScroll() {
    const el = listRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distFromBottom < STICK_THRESHOLD_PX;
  }

  function submit() {
    const trimmed = input.trim();
    if (!trimmed || disabled || isStreaming) return;
    stickToBottomRef.current = true;
    onSubmit(trimmed);
    setInput("");
  }

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submit();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (keyIntent(e.key, e.shiftKey) === "submit") {
      e.preventDefault();
      submit();
    }
  }

  const canSend = canSubmit(input, isStreaming, disabled);
  const status = turnStatus(
    isStreaming,
    messages[messages.length - 1]?.role,
    venueName,
  );

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div
        ref={listRef}
        onScroll={handleListScroll}
        className="flex-1 space-y-7 overflow-y-auto pr-2"
      >
        {messages.length === 0 ? (
          <EmptyState
            venueName={venueName}
            suggestedPrompts={suggestedPrompts}
            disabled={isStreaming || disabled}
            onPick={(p) => {
              stickToBottomRef.current = true;
              onSubmit(p);
            }}
          />
        ) : (
          messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              message={m}
              venueName={venueName}
              isStreamingTurn={isStreaming && i === messages.length - 1}
            />
          ))
        )}
      </div>

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {status}
      </div>

      <form
        onSubmit={handleFormSubmit}
        className="mt-8 flex items-end gap-4 border-t border-rule pt-4"
      >
        <textarea
          id="composer"
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={`Write to ${venueName}…`}
          disabled={disabled}
          aria-label={`Message ${venueName}`}
          className="focus-quiet flex-1 resize-none bg-transparent font-serif text-[15px] leading-[1.55] text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-50"
        />
        {isStreaming && onStop ? (
          <button
            type="button"
            onClick={onStop}
            aria-label={STOP_LABEL}
            title={STOP_LABEL}
            className="group flex shrink-0 items-center gap-1.5 self-end pb-1 font-sans text-[13px] text-error transition hover:text-ink"
          >
            <span>Stop</span>
            <Square
              className="size-2.5 fill-current transition group-hover:scale-110"
              aria-hidden
            />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label={SEND_LABEL}
            title={SEND_LABEL}
            className="group flex shrink-0 items-center gap-1.5 self-end pb-1 font-sans text-[13px] font-medium text-ink-soft transition hover:text-accent disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-ink-soft"
          >
            <span>Send</span>
            <ArrowUpRight className="size-3.5" aria-hidden />
          </button>
        )}
      </form>
    </section>
  );
}

function EmptyState({
  venueName,
  suggestedPrompts,
  disabled,
  onPick,
}: {
  venueName: string;
  suggestedPrompts: string[];
  disabled: boolean;
  onPick: (p: string) => void;
}) {
  return (
    <div className="flex h-full flex-col justify-center">
      <h2 className="rise rise-1 max-w-[36ch] font-display text-[28px] font-medium leading-[1.2] tracking-tight text-ink">
        Tell {venueName} about your event.
      </h2>
      <p className="rise rise-2 mt-3 max-w-[44ch] font-serif text-[15px] leading-relaxed text-ink-soft">
        A date, a head count, the kind of evening you&apos;re thinking. The
        right side composes the bill as we talk.
      </p>
      {suggestedPrompts.length > 0 && (
        <ul className="mt-8 max-w-[42rem] space-y-1">
          {suggestedPrompts.map((p, i) => (
            <li key={p} className={`rise rise-${Math.min(i + 3, 5)}`}>
              <button
                type="button"
                onClick={() => onPick(p)}
                disabled={disabled}
                className="group flex w-full items-baseline gap-2 rounded-md py-2 text-left transition hover:bg-paper-deep disabled:opacity-50"
              >
                <span className="font-serif text-[15px] leading-snug text-ink-soft transition group-hover:text-ink">
                  {p}
                </span>
                <span
                  aria-hidden
                  className="ml-auto pr-1 font-sans text-[12px] text-ink-faint opacity-0 transition group-hover:text-accent group-hover:opacity-100"
                >
                  Send →
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
