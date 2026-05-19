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

// Correspondence treatment: no bubble fills. Speaker label in regular
// Fraunces at a small size, set off by color. Customer messages
// right-align so the rhythm reads as a back-and-forth.
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
      <div className="font-sans text-[12px] font-medium text-ink-soft">
        {speaker}
      </div>
      {(message.text || showPlaceholder) && (
        <div className="max-w-[36rem] font-serif text-[15px] leading-[1.55] text-ink">
          {message.text || (
            <span className="text-ink-faint">
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
            "flex flex-wrap gap-x-3 gap-y-1",
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
