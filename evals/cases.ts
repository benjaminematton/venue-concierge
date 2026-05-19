// Agent evals. Six cases stress the loop on observable behavior — never on
// conversational phrasing. Assertions are structural: which tools were
// called, in what order, with what arguments. Voices vary across runs;
// tool plans should not.
//
// Run with `npm run eval` after setting ANTHROPIC_API_KEY in .env.local.

import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import type { ChatStreamEvent } from "../src/types/chat";

export interface ToolCallRecord {
  id: string;
  name: string;
  input: unknown;
  status: "ok" | "error" | "running";
}

export interface EvalTranscript {
  events: ChatStreamEvent[];
  toolCalls: ToolCallRecord[];
  // Concatenated text across all assistant turns (in arrival order).
  assistantText: string;
  // One entry per assistant turn; useful when a case asserts on turn count.
  assistantMessages: string[];
  // True when the loop emitted a terminal `error` event.
  streamError?: string;
}

export interface AssertionResult {
  pass: boolean;
  failures: string[];
}

export interface EvalCase {
  name: string;
  description: string;
  venueId: string;
  messages: MessageParam[];
  assert: (t: EvalTranscript) => AssertionResult;
}

// ─── Assertion helpers ──────────────────────────────────────────────────────

function check(failures: string[]): AssertionResult {
  return { pass: failures.length === 0, failures };
}

function countCalls(t: EvalTranscript, name: string): ToolCallRecord[] {
  return t.toolCalls.filter((c) => c.name === name);
}

function getInput<T = Record<string, unknown>>(c: ToolCallRecord): T {
  return (c.input ?? {}) as T;
}

// ─── Cases ──────────────────────────────────────────────────────────────────

export const CASES: EvalCase[] = [
  {
    name: "vague-question",
    description:
      "Asks 'how much for a dinner?' with no context — agent must clarify, not invent a quote.",
    venueId: "the-quail",
    messages: [{ role: "user", content: "How much for a dinner?" }],
    assert: (t) => {
      const failures: string[] = [];
      const quoteCalls = countCalls(t, "compute_quote").length;
      const availCalls = countCalls(t, "check_availability").length;
      if (quoteCalls > 0) failures.push(`compute_quote called ${quoteCalls}× before gathering info`);
      if (availCalls > 0) failures.push(`check_availability called ${availCalls}× before gathering info`);
      if (t.assistantMessages.length < 1) failures.push("no assistant message produced");
      return check(failures);
    },
  },

  {
    name: "complete-request",
    description:
      "Customer provides date, time, guests, and names the package. Agent should check availability then quote.",
    venueId: "the-quail",
    messages: [
      {
        role: "user",
        content:
          "Hi! 25 people on Tuesday June 16, 2026 at 7pm, looking to book the Private Back Room.",
      },
    ],
    assert: (t) => {
      const failures: string[] = [];
      const avail = countCalls(t, "check_availability");
      const quotes = countCalls(t, "compute_quote");
      if (avail.length !== 1) failures.push(`expected 1 check_availability, got ${avail.length}`);
      if (quotes.length !== 1) failures.push(`expected 1 compute_quote, got ${quotes.length}`);

      if (avail.length === 1) {
        const a = getInput<{ dateISO?: string; guests?: number }>(avail[0]);
        if (a.dateISO !== "2026-06-16")
          failures.push(`check_availability dateISO=${a.dateISO}, expected 2026-06-16`);
        if (a.guests !== 25)
          failures.push(`check_availability guests=${a.guests}, expected 25`);
      }
      if (quotes.length === 1) {
        const q = getInput<{
          packageId?: string;
          dateISO?: string;
          time?: string;
          guests?: number;
        }>(quotes[0]);
        if (q.packageId !== "quail-buyout")
          failures.push(`compute_quote packageId=${q.packageId}, expected quail-buyout`);
        if (q.dateISO !== "2026-06-16")
          failures.push(`compute_quote dateISO=${q.dateISO}, expected 2026-06-16`);
        if (q.time !== "19:00")
          failures.push(`compute_quote time=${q.time}, expected 19:00`);
        if (q.guests !== 25)
          failures.push(`compute_quote guests=${q.guests}, expected 25`);
      }

      // Final reply should reference a dollar amount (the breakdown is the
      // whole point of this case).
      if (!t.assistantText.includes("$"))
        failures.push("assistant text does not contain a dollar amount");

      // Tool order: check_availability before compute_quote.
      const firstAvail = t.toolCalls.findIndex((c) => c.name === "check_availability");
      const firstQuote = t.toolCalls.findIndex((c) => c.name === "compute_quote");
      if (firstAvail !== -1 && firstQuote !== -1 && firstAvail > firstQuote)
        failures.push("compute_quote called before check_availability");

      return check(failures);
    },
  },

  {
    name: "impossibly-large-party",
    description:
      "Customer asks for 200 guests; venue's largest space holds 40. Agent must refuse, not quote.",
    venueId: "the-quail",
    messages: [
      {
        role: "user",
        content:
          "Hi — can we book 200 people for a private event on June 16, 2026 at 7pm?",
      },
    ],
    assert: (t) => {
      const failures: string[] = [];
      const overlarge = t.toolCalls
        .filter((c) => c.name === "compute_quote")
        .filter((c) => {
          const g = getInput<{ guests?: number }>(c).guests;
          return typeof g === "number" && g > 40;
        });
      if (overlarge.length > 0)
        failures.push(`compute_quote called ${overlarge.length}× with guests > 40 (venue max)`);
      if (t.assistantMessages.length < 1) failures.push("no assistant reply");
      return check(failures);
    },
  },

  {
    name: "missing-date",
    description:
      "Customer names the venue and guest count but no date. Agent must ask for a date, not quote.",
    venueId: "upper-floor",
    messages: [
      {
        role: "user",
        content: "We want to book the rooftop for 40 people.",
      },
    ],
    assert: (t) => {
      const failures: string[] = [];
      if (t.toolCalls.length > 0)
        failures.push(
          `expected no tool calls before a date is known, got ${t.toolCalls.length} (${t.toolCalls.map((c) => c.name).join(", ")})`,
        );
      if (t.assistantMessages.length < 1) failures.push("no assistant reply");
      return check(failures);
    },
  },

  {
    name: "wrong-package-recovery",
    description:
      "Conversation pre-loaded with a prior compute_quote tool_use against a non-existent packageId. " +
      "Agent should follow suggested_action and not retry the bad ID.",
    venueId: "the-quail",
    messages: [
      {
        role: "user",
        content:
          "Looking for a quote on the back room, 25 people, June 16, 2026 at 7pm.",
      },
      {
        role: "assistant",
        content: [
          { type: "text", text: "On it." },
          {
            type: "tool_use",
            id: "toolu_eval_bad_pkg",
            name: "compute_quote",
            input: {
              packageId: "nonexistent_pkg_99",
              dateISO: "2026-06-16",
              time: "19:00",
              guests: 25,
            },
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_eval_bad_pkg",
            content: JSON.stringify({
              code: "UNKNOWN_PACKAGE",
              message:
                'Package "nonexistent_pkg_99" is not offered at The Quail Wine Bar.',
              suggested_action:
                "Choose one of: quail-buyout (Private Back Room). Confirm with the customer if needed before retrying.",
            }),
            is_error: true,
          },
        ],
      },
    ],
    assert: (t) => {
      const failures: string[] = [];
      const retried = t.toolCalls
        .filter((c) => c.name === "compute_quote")
        .filter(
          (c) => getInput<{ packageId?: string }>(c).packageId === "nonexistent_pkg_99",
        );
      if (retried.length > 0)
        failures.push(`compute_quote retried with the bad packageId ${retried.length}×`);

      // Any new compute_quote must reference a real package.
      const validPackageIds = new Set(["quail-buyout"]);
      const badNew = t.toolCalls
        .filter((c) => c.name === "compute_quote")
        .filter((c) => {
          const id = getInput<{ packageId?: string }>(c).packageId;
          return typeof id === "string" && !validPackageIds.has(id);
        });
      if (badNew.length > 0)
        failures.push(
          `compute_quote called with non-catalog packageId(s): ${badNew.map((c) => getInput<{ packageId?: string }>(c).packageId).join(", ")}`,
        );

      return check(failures);
    },
  },

  {
    name: "unavailable-with-alternates",
    description:
      "Customer requests Saturday Aug 15, 2026 — blocked by the static rule. " +
      "Agent must call check_availability, get alternates back, and surface at least one alternate date in the reply.",
    venueId: "the-quail",
    messages: [
      {
        role: "user",
        content:
          "Hi! Looking to book the back room for 30 people on Saturday August 15, 2026 at 7pm.",
      },
    ],
    assert: (t) => {
      const failures: string[] = [];
      const avail = countCalls(t, "check_availability");
      if (avail.length < 1)
        failures.push("expected check_availability to be called");
      else {
        const a = getInput<{ dateISO?: string }>(avail[0]);
        if (a.dateISO !== "2026-08-15")
          failures.push(`check_availability dateISO=${a.dateISO}, expected 2026-08-15`);
      }
      const quotes = countCalls(t, "compute_quote");
      if (quotes.length > 0)
        failures.push(
          `expected no compute_quote on an unavailable date, got ${quotes.length}`,
        );

      // The reply should surface an alternate. The deterministic walker for
      // Aug 15 lands on weekday alternates in late August / early September;
      // assert that *some* date-looking substring appears in the reply.
      const datePattern = /\b\d{4}-\d{2}-\d{2}\b/;
      const longDate =
        /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}/i;
      if (!datePattern.test(t.assistantText) && !longDate.test(t.assistantText))
        failures.push(
          "assistant text contains no recognisable date; expected an alternate to be surfaced",
        );

      return check(failures);
    },
  },
];
