"use client";

import { cn } from "@/lib/cn";
import type { ToolCallSummary } from "@/types/chat";

interface ToolCallPillProps {
  toolCall: ToolCallSummary;
}

// Inline mono annotation: → tool_name(args) status-glyph.
// Status drives color only: running pulses faint, ok stays ink-soft,
// error switches to the accent (which doubles for error in this palette).
export function ToolCallPill({ toolCall }: ToolCallPillProps) {
  const { name, status, argsSummary } = toolCall;
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 font-mono text-[11px] tabular-nums",
        status === "error" && "text-error",
        status === "ok" && "text-ink-soft",
        status === "running" && "animate-pulse text-ink-faint",
      )}
    >
      <span aria-hidden className="text-ink-faint">
        →
      </span>
      <span className="text-ink">{name}</span>
      {argsSummary && (
        <span
          className="max-w-[18rem] truncate text-ink-faint"
          title={argsSummary}
        >
          ({argsSummary})
        </span>
      )}
      <span aria-hidden>
        {status === "ok" ? "✓" : status === "error" ? "✕" : "…"}
      </span>
    </span>
  );
}
