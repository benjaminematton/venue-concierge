"use client";

import { cn } from "@/lib/cn";
import type { ToolCallSummary } from "@/types/chat";

interface ToolCallPillProps {
  toolCall: ToolCallSummary;
}

// Editorial sidenote, not a chat pill. A small caps tracked-out label —
// "called: check_availability" — followed by the args in mono. Status
// shifts a marginal swatch on the left edge: running pulses faint,
// ok is set in ink, error in vermillion.
export function ToolCallPill({ toolCall }: ToolCallPillProps) {
  const { name, status, argsSummary } = toolCall;
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-2 border-l py-0.5 pl-2.5 text-[10px] uppercase tracking-[0.18em]",
        status === "error" && "border-error text-error",
        status === "ok" && "border-ink text-ink-soft",
        status === "running" && "animate-pulse border-rule-strong text-ink-soft",
      )}
    >
      <span>called</span>
      <span className="font-mono normal-case tracking-normal text-ink">
        {name}
      </span>
      {argsSummary && (
        <span
          className="max-w-[16rem] truncate font-mono normal-case tracking-normal text-ink-faint"
          title={argsSummary}
        >
          ({argsSummary})
        </span>
      )}
      <span aria-hidden className="font-mono">
        {status === "ok" ? "·" : status === "error" ? "✕" : "…"}
      </span>
    </span>
  );
}
