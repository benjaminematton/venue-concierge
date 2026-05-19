import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  ToolResultBlockParam,
  TextBlockParam,
} from "@anthropic-ai/sdk/resources/messages";
import type { VenueListing, PublicVenueListing } from "@/lib/pricing/types";
import type {
  ChatStreamEvent,
  ChatStopReason,
  QuoteBreakdownDto,
} from "@/types/chat";
import { buildSystemPrompt } from "./system-prompt";
import { isToolName, runTool, summarizeArgs, TOOL_DEFS } from "./tools";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;
const MAX_ITERATIONS = 6;

interface RunArgs {
  venue: VenueListing;
  messages: MessageParam[];
  // 0.2 in production; the eval runner passes 0 for determinism.
  temperature?: number;
  client?: Anthropic;
}

// The tool loop. Yields ChatStreamEvent values; the HTTP route serialises
// each to SSE. Errors that escape the loop propagate to the caller — the
// route wraps the iteration in try/catch and emits a terminal `error`
// event before closing the connection.
export async function* runAgent(args: RunArgs): AsyncGenerator<ChatStreamEvent> {
  const { venue, temperature = 0.2 } = args;
  const client = args.client ?? new Anthropic();

  // Conversation history mutates each iteration: we append the model's
  // assistant turn, then a user turn containing tool_result blocks.
  const conversation: MessageParam[] = [...args.messages];
  const system: TextBlockParam[] = buildSystemPrompt(venue);
  const publicVenue: PublicVenueListing = stripVoice(venue);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const messageId = randomId();
    yield { kind: "message_start", messageId };

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature,
      system,
      tools: TOOL_DEFS,
      messages: conversation,
    });

    // Forward text deltas as they arrive. Tool-use blocks are surfaced
    // after the message completes, so the pill carries fully-assembled
    // args instead of streaming-in fragments.
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield { kind: "text_delta", messageId, delta: event.delta.text };
      }
    }

    const final = await stream.finalMessage();
    const stopReason = (final.stop_reason ?? "end_turn") as ChatStopReason;

    // Surface tool calls + results, in order. Each pill goes "running" the
    // moment we know its args and "ok"/"error" once we have a result.
    const toolResultBlocks: ToolResultBlockParam[] = [];
    for (const block of final.content) {
      if (block.type !== "tool_use") continue;
      const argsSummary = isToolName(block.name)
        ? summarizeArgs(block.name, block.input)
        : "";
      yield {
        kind: "tool_use_start",
        messageId,
        toolCall: {
          id: block.id,
          name: block.name,
          status: "running",
          argsSummary,
        },
      };

      if (!isToolName(block.name)) {
        // Defensive: the model named a tool we didn't register. Treat as a
        // hard error rather than feeding garbage back.
        yield {
          kind: "tool_use_end",
          messageId,
          toolCallId: block.id,
          status: "error",
          errorMessage: `Unknown tool: ${block.name}`,
        };
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Tool "${block.name}" is not available.`,
          is_error: true,
        });
        continue;
      }

      const result = runTool(block.name, publicVenue, block.input);
      yield {
        kind: "tool_use_end",
        messageId,
        toolCallId: block.id,
        status: result.ok ? "ok" : "error",
        errorMessage: result.ok ? undefined : result.error.message,
      };

      if (result.ok && block.name === "compute_quote") {
        const data = result.data as QuoteBreakdownDto & {
          packageId: string;
          spaceId: string | null;
        };
        yield {
          kind: "quote_update",
          toolCallId: block.id,
          venueId: venue.id,
          packageId: data.packageId,
          breakdown: {
            subtotal: data.subtotal,
            deposit: data.deposit,
            depositSemantics: data.depositSemantics,
            feeLines: data.feeLines,
            dueAtBooking: data.dueAtBooking,
            estimatedEventTotal: data.estimatedEventTotal,
          },
        };
      }

      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
        is_error: !result.ok,
      });
    }

    yield { kind: "message_end", messageId, stopReason };

    if (stopReason !== "tool_use") return;

    // Loop: append the assistant turn and the synthetic user turn carrying
    // tool_results, then run another iteration.
    conversation.push({ role: "assistant", content: final.content });
    conversation.push({ role: "user", content: toolResultBlocks });
  }

  // Ran out of iterations. The agent kept calling tools without converging
  // on an answer; surface a controlled error rather than a silent halt.
  yield {
    kind: "error",
    message: `Agent did not converge after ${MAX_ITERATIONS} tool iterations.`,
  };
}

function stripVoice(v: VenueListing): PublicVenueListing {
  const { voice: _voice, ...rest } = v;
  void _voice;
  return rest;
}

function randomId(): string {
  // crypto.randomUUID is available in Node 19+ and in the Edge runtime.
  return crypto.randomUUID();
}
