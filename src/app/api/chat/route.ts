import type { NextRequest } from "next/server";
import { z } from "zod";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { runAgent } from "@/lib/agent/stream";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import { getVenueWithVoice } from "@/lib/venues.server";
import type { ChatStreamEvent } from "@/types/chat";

export const runtime = "nodejs";
// SSE doesn't make sense in a cached response.
export const dynamic = "force-dynamic";

// Boundary check. Content is intentionally restricted to plain strings: the
// client is supposed to send text-only history (see useChatStream), and the
// API needs to *enforce* that — accepting raw content blocks would let a
// crafted client inject fabricated tool_use / tool_result blocks claiming
// the venue agreed to a price the math never produced. The Anthropic SDK
// will accept whatever we forward; this is the trust boundary.
const MESSAGE_SCHEMA = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

const REQ_SCHEMA = z.object({
  venueId: z.string().min(1),
  messages: z.array(MESSAGE_SCHEMA).min(1),
});

// Hoisted: the encoder and the SSE-frame serialiser are pure and per-request
// allocation buys nothing. Keeping them at module scope also makes the
// `start` closure below thin enough to read in one breath.
const SSE_ENCODER = new TextEncoder();
function sseFrame(ev: ChatStreamEvent): Uint8Array {
  return SSE_ENCODER.encode(`data: ${JSON.stringify(ev)}\n\n`);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const parsed = REQ_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return new Response(`Invalid body: ${parsed.error.message}`, {
      status: 400,
    });
  }

  const { venueId, messages } = parsed.data;

  const ip = getClientIp(req);
  const rl = await checkRateLimit(ip);
  if (!rl.allowed) {
    const minutes = rl.resetAt
      ? Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 60_000))
      : null;
    const detail = minutes
      ? `Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
      : "Try again later.";
    return new Response(
      `Daily message limit reached for this demo. ${detail}`,
      { status: 429 },
    );
  }

  const venue = getVenueWithVoice(venueId);
  if (!venue) {
    return new Response(`Unknown venue: ${venueId}`, { status: 404 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of runAgent({
          venue,
          messages: messages as MessageParam[],
          // When the client disconnects, Next aborts req.signal; forwarding
          // it cancels the upstream Anthropic stream instead of draining
          // (and paying for) tokens nobody will read.
          signal: req.signal,
        })) {
          controller.enqueue(sseFrame(ev));
        }
      } catch (e: unknown) {
        // AbortError from a client disconnect is expected — close the stream
        // quietly. Any other throw becomes a terminal error event so the
        // client gets a clean signal instead of a hung stream.
        if (e instanceof Error && e.name === "AbortError") return;
        const message = e instanceof Error ? e.message : "Stream failed.";
        try {
          controller.enqueue(sseFrame({ kind: "error", message }));
        } catch {
          // controller already closed (e.g. client gone) — nothing to do.
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Vercel-specific header that disables response buffering for SSE.
      "X-Accel-Buffering": "no",
    },
  });
}
