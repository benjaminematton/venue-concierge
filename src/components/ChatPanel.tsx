"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { canSubmit, keyIntent, turnStatus } from "./ChatPanel.logic";
import type { ChatMessage } from "@/types/chat";

interface ChatPanelProps {
  messages: ChatMessage[];
  venueName: string;
  onSubmit: (text: string) => void;
  isStreaming?: boolean;
  disabled?: boolean;
}

// Pixel cap matches `max-h-32` (8rem). Kept in sync with the textarea class
// below; the JS clamp is what actually limits height during auto-grow.
const TEXTAREA_MAX_PX = 128;
// Distance (px) from the bottom within which we consider the list "pinned".
const STICK_THRESHOLD_PX = 64;

export function ChatPanel({
  messages,
  venueName,
  onSubmit,
  isStreaming = false,
  disabled = false,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Only auto-scroll while the user is near the bottom. If they scroll up to
  // re-read mid-stream, we leave them where they are.
  const stickToBottomRef = useRef(true);

  // useLayoutEffect so the jump happens before paint — avoids a flash where
  // the new content renders above the fold and then snaps down.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Auto-grow the composer up to TEXTAREA_MAX_PX. Reset-to-auto first so
  // shrinking after a delete works; clamp manually instead of relying on CSS
  // max-height, because we want scrollHeight to reflect the natural size.
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
    // Re-stick on send: the user just took an action, they want to see the reply.
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
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div
        ref={listRef}
        onScroll={handleListScroll}
        className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
      >
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-sm text-zinc-500 dark:text-zinc-400">
            Say hi to {venueName}. Tell them what kind of event you&apos;re
            planning.
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} message={m} venueName={venueName} />
          ))
        )}
      </div>

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {status}
      </div>

      <form
        onSubmit={handleFormSubmit}
        className="flex items-end gap-2 border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={`Message ${venueName}…`}
          disabled={disabled}
          className="min-h-[2.5rem] flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-800"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-zinc-900 text-zinc-50 transition disabled:opacity-30 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <ArrowUp className="size-4" aria-hidden />
        </button>
      </form>
    </section>
  );
}
