import type { PriceBreakdown } from "@/lib/pricing/venuePricing";

// Conversation messages as the client tracks them. The API route translates
// these into the Anthropic Messages format on each request.
export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  toolCalls?: ToolCallSummary[];
}

// What the client sees about each tool invocation. The full tool_use input
// stays server-side; the client only needs enough to render a pill.
export interface ToolCallSummary {
  id: string;
  name: string;
  status: "running" | "ok" | "error";
  argsSummary: string;
}

// Streamed SSE event shape. The server emits one of these per chunk; the
// client appends/updates accordingly.
export type ChatStreamEvent =
  | { kind: "text_delta"; messageId: string; delta: string }
  | { kind: "message_start"; messageId: string }
  | { kind: "message_end"; messageId: string }
  | { kind: "tool_use_start"; messageId: string; toolCall: ToolCallSummary }
  | {
      kind: "tool_use_end";
      messageId: string;
      toolCallId: string;
      status: "ok" | "error";
    }
  | { kind: "quote_update"; breakdown: PriceBreakdown; packageId: string; venueId: string }
  | { kind: "error"; message: string };
