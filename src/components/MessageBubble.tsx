"use client";

import { ToolCallPill } from "./ToolCallPill";
import { cn } from "@/lib/cn";
import type { ChatMessage } from "@/types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
  venueName: string;
  // True only for the active streaming assistant turn. Gates the
  // ellipsis placeholder so older empty bubbles don't read as loading.
  isStreamingTurn?: boolean;
}

// Correspondence treatment: no bubble fills. Each message reads like a
// line of dialogue in a play — italic display-serif speaker label,
// then the text in serif body. Customer turns are right-aligned so the
// rhythm reads as a back-and-forth without losing legibility.
export function MessageBubble({
  message,
  venueName,
  isStreamingTurn = false,
}: MessageBubbleProps) {
  const isVenue = message.role === "assistant";
  const toolCalls = message.toolCalls ?? [];
  const speaker = isVenue ? venueName : "You";
  const showPlaceholder = isVenue && !message.text && isStreamingTurn;

  return (
    <article
      className={cn(
        "flex flex-col gap-1.5",
        isVenue ? "items-start text-left" : "items-end text-right",
      )}
    >
      <div
        className={cn(
          "font-display text-[11px] uppercase tracking-[0.24em] text-ink-faint",
        )}
      >
        <span className="italic">{speaker}</span>
      </div>
      {(message.text || showPlaceholder) && (
        <div className="max-w-[36rem] font-serif text-[15px] leading-[1.55] text-ink">
          {message.text || (
            <span className="font-sans text-ink-faint">
              <span className="inline-block animate-pulse">·</span>
              <span
                className="inline-block animate-pulse"
                style={{ animationDelay: "120ms" }}
              >
                ·
              </span>
              <span
                className="inline-block animate-pulse"
                style={{ animationDelay: "240ms" }}
              >
                ·
              </span>
            </span>
          )}
        </div>
      )}
      {toolCalls.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap gap-1.5",
            isVenue ? "justify-start" : "justify-end",
          )}
        >
          {toolCalls.map((tc) => (
            <ToolCallPill key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}
    </article>
  );
}
