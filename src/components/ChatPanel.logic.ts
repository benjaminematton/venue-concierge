// Pure policy for the composer + status announcer. Lives outside the React
// component so the rules can be exercised in plain node tests, without a DOM.
// The component is a thin binding from keyboard / form events to these.

import type { ChatRole } from "@/types/chat";

export function canSubmit(
  input: string,
  isStreaming: boolean,
  disabled: boolean,
): boolean {
  return input.trim().length > 0 && !isStreaming && !disabled;
}

export type KeyIntent = "submit" | "newline" | "passthrough";

export function keyIntent(key: string, shiftKey: boolean): KeyIntent {
  if (key !== "Enter") return "passthrough";
  return shiftKey ? "newline" : "submit";
}

// One announcement per turn, not per token. The list itself is intentionally
// NOT a live region; that would flood screen readers as deltas stream in.
export function turnStatus(
  isStreaming: boolean,
  lastRole: ChatRole | undefined,
  venueName: string,
): string {
  if (isStreaming) return `${venueName} is replying…`;
  if (lastRole === "assistant") return `${venueName} replied.`;
  return "";
}
