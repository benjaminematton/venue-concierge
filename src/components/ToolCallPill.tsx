"use client";

import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ToolCallSummary } from "@/types/chat";

interface ToolCallPillProps {
  toolCall: ToolCallSummary;
}

// Inline pill that shows up beneath an assistant message while the agent is
// running a tool. `running` keeps a spinner; `ok` / `error` lock the final
// state. Reads as `→ tool_name(arg summary) ✓`.
//
// No aria-live here — ChatPanel owns a single SR announcer for the turn.
// Per-pill live regions produced an avalanche of redundant announcements.
export function ToolCallPill({ toolCall }: ToolCallPillProps) {
  const { name, status, argsSummary } = toolCall;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        status === "error" &&
          "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
        status === "ok" &&
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
        status === "running" &&
          "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
      )}
    >
      <span aria-hidden className="text-zinc-400 dark:text-zinc-500">
        →
      </span>
      <span className="font-mono">{name}</span>
      {argsSummary && (
        <span
          className="inline-block max-w-[14rem] truncate align-middle font-mono text-zinc-500 dark:text-zinc-400"
          title={argsSummary}
        >
          ({argsSummary})
        </span>
      )}
      {status === "running" && (
        <Loader2 aria-hidden className="size-3 animate-spin text-zinc-500" />
      )}
      {status === "ok" && <Check aria-hidden className="size-3" />}
      {status === "error" && <X aria-hidden className="size-3" />}
    </span>
  );
}
