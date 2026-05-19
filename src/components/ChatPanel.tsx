"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage } from "@/types/chat";

interface ChatPanelProps {
  messages: ChatMessage[];
  venueName: string;
  onSubmit: (text: string) => void;
  isStreaming?: boolean;
  disabled?: boolean;
}

export function ChatPanel({
  messages,
  venueName,
  onSubmit,
  isStreaming = false,
  disabled = false,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Pin the scroll to the bottom as new messages or tokens arrive. Using
  // scrollTo with smooth behavior preserves the user's scroll if they've
  // explicitly scrolled up — but for this demo the list is short and we
  // always want the latest visible.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || disabled || isStreaming) return;
    onSubmit(trimmed);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  const canSend = input.trim().length > 0 && !disabled && !isStreaming;

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div
        ref={listRef}
        className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
        aria-live="polite"
        aria-busy={isStreaming}
      >
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-sm text-zinc-500 dark:text-zinc-400">
            Say hi to {venueName}. Tell them what kind of event you're planning.
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} message={m} venueName={venueName} />
          ))
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={`Message ${venueName}…`}
          disabled={disabled}
          className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-800"
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
