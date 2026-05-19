import type { PricingResult, ResolvedFeeLine } from "@/lib/pricing/venuePricing";

// Conversation messages as the client tracks them. The API route translates
// these into the Anthropic Messages format on each request. The role union
// is intentionally narrow: system prompts are server-only, and tool-use /
// tool-result blocks are carried separately on each assistant message rather
// than as their own roles.
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

// Wire shape for the live quote panel. Defined here (not re-exported from
// the pricing module) so the SSE contract is decoupled from the math
// module's internal return type — refactoring computeBreakdown shouldn't
// silently change what we put on the wire. Structurally compatible with
// PriceBreakdown today; the boundary mapping is the explicit checkpoint.
export interface QuoteBreakdownDto {
  subtotal: number;
  deposit: number;
  depositSemantics: PricingResult["depositSemantics"];
  feeLines: ResolvedFeeLine[];
  dueAtBooking: number;
  estimatedEventTotal: number;
}

// Anthropic stream stop reasons we forward to the client. Surfacing this on
// message_end pays back the first time you debug a truncated reply.
export type ChatStopReason =
  | "end_turn"
  | "tool_use"
  | "max_tokens"
  | "stop_sequence";

// Streamed SSE event shape. The server emits one of these per chunk; the
// client appends/updates accordingly.
export type ChatStreamEvent =
  | { kind: "text_delta"; messageId: string; delta: string }
  | { kind: "message_start"; messageId: string }
  | { kind: "message_end"; messageId: string; stopReason: ChatStopReason }
  | { kind: "tool_use_start"; messageId: string; toolCall: ToolCallSummary }
  | {
      kind: "tool_use_end";
      messageId: string;
      toolCallId: string;
      status: "ok" | "error";
      errorMessage?: string;
    }
  | {
      kind: "quote_update";
      toolCallId: string;
      breakdown: QuoteBreakdownDto;
      packageId: string;
      venueId: string;
      // Inputs the agent quoted against, echoed so the panel can show
      // "Jun 15 · 25 guests" without re-parsing the chat history.
      dateISO: string;
      guests: number;
    }
  | { kind: "error"; message: string };
