#!/usr/bin/env -S npx tsx
// Eval runner. Walks the cases in cases.ts, executes each against the
// server-side agent loop (temperature 0 for determinism), and prints pass /
// fail per case. Transcripts are saved to evals/transcripts/ on failure so
// you can read what the agent actually said when an assertion missed.
//
// Run with `npm run eval`. Needs ANTHROPIC_API_KEY in env — the loader
// below picks up .env.local if it exists.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runAgent } from "../src/lib/agent/stream";
import { getVenueWithVoice } from "../src/lib/venues.server";
import type { ChatStreamEvent } from "../src/types/chat";
import {
  CASES,
  type EvalCase,
  type EvalTranscript,
  type ToolCallRecord,
} from "./cases";

// Pull .env.local into process.env. The Anthropic client is only
// constructed inside runAgent (called from main below), so loading the
// file at module init is in time. Existing env values win — explicit
// `ANTHROPIC_API_KEY=… npm run eval` is not overridden by the file.
function loadEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf-8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]]) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[m[1]] = value;
  }
}
loadEnvLocal();

const TRANSCRIPT_DIR = join(process.cwd(), "evals", "transcripts");

async function runCase(c: EvalCase): Promise<EvalTranscript> {
  const venue = getVenueWithVoice(c.venueId);
  if (!venue) throw new Error(`Unknown venueId: ${c.venueId}`);

  const events: ChatStreamEvent[] = [];
  const toolCalls: ToolCallRecord[] = [];
  const turnTexts: Map<string, string> = new Map();
  const turnOrder: string[] = [];
  let streamError: string | undefined;

  for await (const ev of runAgent({
    venue,
    messages: c.messages,
    temperature: 0,
  })) {
    events.push(ev);
    switch (ev.kind) {
      case "message_start":
        turnTexts.set(ev.messageId, "");
        turnOrder.push(ev.messageId);
        break;
      case "text_delta": {
        const prev = turnTexts.get(ev.messageId) ?? "";
        turnTexts.set(ev.messageId, prev + ev.delta);
        break;
      }
      case "tool_use_start":
        toolCalls.push({
          id: ev.toolCall.id,
          name: ev.toolCall.name,
          input: ev.input,
          status: "running",
        });
        break;
      case "tool_use_end": {
        const rec = toolCalls.find((c) => c.id === ev.toolCallId);
        if (rec) rec.status = ev.status;
        break;
      }
      case "error":
        streamError = ev.message;
        break;
    }
  }

  const assistantMessages = turnOrder
    .map((id) => turnTexts.get(id) ?? "")
    .filter((s) => s.length > 0);
  const assistantText = assistantMessages.join("\n\n");

  return { events, toolCalls, assistantMessages, assistantText, streamError };
}

function saveTranscript(c: EvalCase, t: EvalTranscript, suffix: string) {
  mkdirSync(TRANSCRIPT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = join(TRANSCRIPT_DIR, `${c.name}-${suffix}-${stamp}.json`);
  writeFileSync(
    file,
    JSON.stringify(
      {
        case: c.name,
        description: c.description,
        venueId: c.venueId,
        input: c.messages,
        toolCalls: t.toolCalls,
        assistantMessages: t.assistantMessages,
        streamError: t.streamError,
        rawEvents: t.events,
      },
      null,
      2,
    ),
  );
  return file;
}

// ─── ANSI helpers (no extra deps) ───────────────────────────────────────────

const GREEN = (s: string) => `\x1b[32m${s}\x1b[0m`;
const RED = (s: string) => `\x1b[31m${s}\x1b[0m`;
const DIM = (s: string) => `\x1b[2m${s}\x1b[0m`;
const BOLD = (s: string) => `\x1b[1m${s}\x1b[0m`;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      RED("error:") +
        " ANTHROPIC_API_KEY is not set.\nAdd it to .env.local (loaded automatically) or export it before running.",
    );
    process.exit(2);
  }

  const args = process.argv.slice(2);
  const onlyArg = args.find((a) => a.startsWith("--case="))?.slice("--case=".length);
  const saveAll = args.includes("--save-all");
  const cases = onlyArg ? CASES.filter((c) => c.name === onlyArg) : CASES;
  if (cases.length === 0) {
    console.error(RED(`no case matched ${onlyArg}`));
    process.exit(2);
  }

  let passed = 0;
  let failed = 0;

  for (const c of cases) {
    process.stdout.write(BOLD(c.name) + " ");
    let transcript: EvalTranscript;
    try {
      transcript = await runCase(c);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(RED("ERROR") + " " + DIM(msg));
      failed++;
      continue;
    }

    if (transcript.streamError) {
      const f = saveTranscript(c, transcript, "stream-error");
      console.log(
        RED("STREAM ERROR") + " " + DIM(transcript.streamError),
      );
      console.log(DIM(`  transcript: ${f}`));
      failed++;
      continue;
    }

    const result = c.assert(transcript);
    if (result.pass) {
      console.log(GREEN("PASS"));
      passed++;
      if (saveAll) {
        const f = saveTranscript(c, transcript, "pass");
        console.log(DIM(`  transcript: ${f}`));
      }
    } else {
      const f = saveTranscript(c, transcript, "fail");
      console.log(RED("FAIL"));
      for (const reason of result.failures) {
        console.log(DIM(`  - ${reason}`));
      }
      console.log(DIM(`  transcript: ${f}`));
      failed++;
    }
  }

  console.log("");
  console.log(
    BOLD(`${passed}/${passed + failed} passed`) +
      (failed > 0 ? RED(`  (${failed} failed)`) : ""),
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(RED("unhandled error:"), e);
  process.exit(2);
});
