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

// Boundary check: minimal shape only. The Anthropic SDK validates the full
// MessageParam structure when it serialises, so duplicating that here just
// rots. We confirm we have role + content and stop.
const MESSAGE_SCHEMA = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.union([z.string(), z.array(z.unknown())]),
});

const REQ_SCHEMA = z.object({
  venueId: z.string().min(1),
  messages: z.array(MESSAGE_SCHEMA).min(1),
});

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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(ev: ChatStreamEvent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
      }
      try {
        for await (const ev of runAgent({
          venue,
          messages: messages as MessageParam[],
        })) {
          send(ev);
        }
      } catch (e: unknown) {
        // Any throw inside the loop lands here. Emit a terminal error
        // event so the client gets a clean signal instead of a hung stream.
        const message = e instanceof Error ? e.message : "Stream failed.";
        send({ kind: "error", message });
      } finally {
        controller.close();
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
