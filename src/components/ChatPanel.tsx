"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CornerDownLeft, Square } from "lucide-react";
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
// Single source for composer button labels — feeds both aria-label and
// title so copy can't drift between the two.
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
        <div className="flex-1">
          <label
            htmlFor="composer"
            className="block font-sans text-[10px] uppercase tracking-[0.28em] text-ink-faint"
          >
            Reply
          </label>
          <textarea
            id="composer"
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={`Write to ${venueName}…`}
            disabled={disabled}
            className="mt-1.5 w-full resize-none bg-transparent font-serif text-[15px] leading-[1.55] text-ink placeholder:italic placeholder:text-ink-faint focus:outline-none disabled:opacity-50"
          />
        </div>
        {isStreaming && onStop ? (
          <button
            type="button"
            onClick={onStop}
            aria-label={STOP_LABEL}
            title={STOP_LABEL}
            className="group flex shrink-0 items-baseline gap-2 self-end pb-2 font-sans text-[10px] uppercase tracking-[0.28em] text-error transition hover:text-ink"
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
            className="group flex shrink-0 items-baseline gap-2 self-end pb-2 font-sans text-[10px] uppercase tracking-[0.28em] text-ink-soft transition hover:text-accent disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-ink-soft"
          >
            <span>Send</span>
            <CornerDownLeft className="size-3.5" aria-hidden />
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
      <div className="rise rise-1 font-sans text-[10px] uppercase tracking-[0.28em] text-ink-faint">
        Opening note
      </div>
      <p className="rise rise-2 mt-3 max-w-[38ch] font-display text-3xl italic leading-[1.15] text-ink">
        Tell {venueName} about your event.
      </p>
      <p className="rise rise-3 mt-3 max-w-[44ch] font-serif text-[15px] italic leading-relaxed text-ink-soft">
        A date, a head count, the kind of evening you&apos;re thinking. The
        right side composes the bill as we talk.
      </p>
      {suggestedPrompts.length > 0 && (
        <ul className="mt-8 max-w-[42rem] divide-y divide-rule border-y border-rule">
          {suggestedPrompts.map((p, i) => (
            <li key={p} className={`rise rise-${Math.min(i + 4, 5)}`}>
              <button
                type="button"
                onClick={() => onPick(p)}
                disabled={disabled}
                className="group flex w-full items-baseline gap-3 py-3 text-left transition disabled:opacity-50"
              >
                <span
                  aria-hidden
                  className="font-mono text-[11px] text-ink-faint transition group-hover:text-accent"
                >
                  ▸
                </span>
                <span className="font-serif text-[15px] italic leading-snug text-ink-soft transition group-hover:text-ink">
                  {p}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
