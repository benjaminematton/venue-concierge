"use client";

import { ToolCallPill } from "./ToolCallPill";
import { cn } from "@/lib/cn";
import type { ChatMessage } from "@/types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
  // Display name shown above the assistant's bubble. The venue is the
  // identity speaking, not a generic "assistant", so the parent threads
  // the active venue's name through here.
  venueName: string;
}

export function MessageBubble({ message, venueName }: MessageBubbleProps) {
  const isVenue = message.role === "assistant";
  const toolCalls = message.toolCalls ?? [];

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        isVenue ? "items-start" : "items-end",
      )}
    >
      {isVenue && (
        <div className="px-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {venueName}
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isVenue
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900",
        )}
      >
        {message.text || (
          <span className="text-zinc-400 dark:text-zinc-500">…</span>
        )}
      </div>
      {toolCalls.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {toolCalls.map((tc) => (
            <ToolCallPill key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  );
}
