import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import {
  computeBreakdown,
  weekdayInTz,
  type PriceBreakdown,
} from "@/lib/pricing/venuePricing";
import type { PublicVenueListing, DayShort } from "@/lib/pricing/types";
import type { QuoteBreakdownDto } from "@/types/chat";
import { err, ok, type ToolResult } from "./errors";

// ─── Tool schemas (Anthropic input_schema shape) ────────────────────────────

const CHECK_AVAILABILITY_INPUT = z.object({
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  guests: z.number().int().positive(),
});

const COMPUTE_QUOTE_INPUT = z.object({
  packageId: z.string().min(1),
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  guests: z.number().int().positive(),
  spaceId: z.string().min(1).optional(),
});

export type CheckAvailabilityInput = z.infer<typeof CHECK_AVAILABILITY_INPUT>;
export type ComputeQuoteInput = z.infer<typeof COMPUTE_QUOTE_INPUT>;

export const TOOL_DEFS: Tool[] = [
  {
    name: "check_availability",
    description:
      "Check whether the venue can host an event on the given date and time " +
      "for the given guest count. Returns availability and, when unavailable, " +
      "up to three alternate dates the venue is open. Use this before quoting " +
      "any specific date.",
    input_schema: {
      type: "object",
      properties: {
        dateISO: {
          type: "string",
          description:
            "Date in YYYY-MM-DD format, interpreted in the venue's local time zone.",
        },
        time: {
          type: "string",
          description:
            "Start time in HH:MM 24-hour format. Optional, but providing it lets the venue confirm hours.",
        },
        guests: {
          type: "integer",
          description: "Expected guest count.",
        },
      },
      required: ["dateISO", "guests"],
    },
  },
  {
    name: "compute_quote",
    description:
      "Compute a binding price quote for a specific package, date, time, and " +
      "guest count. Returns subtotal, deposit, fee lines, due-at-booking " +
      "amount, and estimated event total. Call check_availability first when " +
      "the customer names a date. Never invent prices — always call this.",
    input_schema: {
      type: "object",
      properties: {
        packageId: {
          type: "string",
          description:
            "The id of the package to quote. Must match one of the venue's package ids.",
        },
        dateISO: { type: "string", description: "YYYY-MM-DD." },
        time: { type: "string", description: "HH:MM 24-hour." },
        guests: {
          type: "integer",
          description: "Guest count. Must not exceed the package's maxGuests.",
        },
        spaceId: {
          type: "string",
          description:
            "Optional. The space to book within the package. Auto-resolved when the package allows only one space.",
        },
      },
      required: ["packageId", "dateISO", "time", "guests"],
    },
  },
];

// ─── Static "calendar" for the demo ─────────────────────────────────────────
// Deliberately simple and explainable: weekends in August are booked, the
// first Friday of each month is booked. A real venue would back this with a
// calendar service; the static rule is enough to show the alternate-date
// recovery path while staying defensible under "what does this actually do?".

const DAY_SHORTS: DayShort[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isStaticallyBlocked(dateISO: string, tz: string): boolean {
  const dow = weekdayInTz(dateISO, tz);
  if (dow === undefined) return false;
  const [, monthStr, dayStr] = dateISO.split("-");
  const month = Number(monthStr);
  const day = Number(dayStr);
  // Weekends in August
  if (month === 8 && (dow === 0 || dow === 6)) return true;
  // First Friday of every month (the 1st..7th, whichever is a Friday)
  if (dow === 5 && day <= 7) return true;
  return false;
}

function isVenueOpen(venue: PublicVenueListing, dateISO: string): boolean {
  const dow = weekdayInTz(dateISO, venue.timezone);
  if (dow === undefined) return false;
  const dayShort = DAY_SHORTS[dow];
  return venue.weeklyHours.some((h) => h.day === dayShort);
}

// Walk forward from a base date, skipping unavailable days, returning up to
// `count` alternates. Deterministic — no clock reads in the loop — so demo
// behavior is reproducible.
function suggestAlternates(
  venue: PublicVenueListing,
  startDateISO: string,
  count = 3,
  maxScan = 30,
): string[] {
  const out: string[] = [];
  const [y, m, d] = startDateISO.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  for (let i = 1; i <= maxScan && out.length < count; i++) {
    const next = new Date(base.getTime() + i * 86_400_000);
    const iso = next.toISOString().slice(0, 10);
    if (!isVenueOpen(venue, iso)) continue;
    if (isStaticallyBlocked(iso, venue.timezone)) continue;
    out.push(iso);
  }
  return out;
}

// ─── Tool: check_availability ───────────────────────────────────────────────

export interface CheckAvailabilityResult {
  available: boolean;
  reason?: string;
  alternateDates?: string[];
}

export function runCheckAvailability(
  venue: PublicVenueListing,
  rawInput: unknown,
): ToolResult<CheckAvailabilityResult> {
  const parsed = CHECK_AVAILABILITY_INPUT.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      "INVALID_INPUT",
      `Invalid input to check_availability: ${parsed.error.message}`,
      "Re-call check_availability with dateISO in YYYY-MM-DD format and a positive integer guest count.",
    );
  }
  const { dateISO, guests } = parsed.data;

  if (!isVenueOpen(venue, dateISO)) {
    const dow = weekdayInTz(dateISO, venue.timezone);
    const dayLabel = dow === undefined ? "that day" : DAY_SHORTS[dow];
    return ok({
      available: false,
      reason: `${venue.name} is closed on ${dayLabel}.`,
      alternateDates: suggestAlternates(venue, dateISO),
    });
  }

  if (isStaticallyBlocked(dateISO, venue.timezone)) {
    return ok({
      available: false,
      reason: `${dateISO} is already booked.`,
      alternateDates: suggestAlternates(venue, dateISO),
    });
  }

  const maxCap = Math.max(...venue.spaces.map((s) => s.maxCapacity));
  if (guests > maxCap) {
    return ok({
      available: false,
      reason: `${guests} guests exceeds the venue's largest space (${maxCap}).`,
    });
  }

  return ok({ available: true });
}

// ─── Tool: compute_quote ────────────────────────────────────────────────────

export interface ComputeQuoteResult {
  breakdown: QuoteBreakdownDto;
  // The validated input that produced this breakdown. Threaded through so
  // downstream consumers don't have to re-narrow `block.input` at the
  // boundary; the zod parse here is the single source of truth.
  input: ComputeQuoteInput;
  packageId: string;
  spaceId: string;
}

export function runComputeQuote(
  venue: PublicVenueListing,
  rawInput: unknown,
): ToolResult<ComputeQuoteResult> {
  const parsed = COMPUTE_QUOTE_INPUT.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      "INVALID_INPUT",
      `Invalid input to compute_quote: ${parsed.error.message}`,
      "Re-call compute_quote with packageId, dateISO (YYYY-MM-DD), time (HH:MM), and a positive integer guests.",
    );
  }
  const { packageId, dateISO, time, guests, spaceId } = parsed.data;

  const pkg = venue.packages.find((p) => p.id === packageId);
  if (!pkg) {
    const known = venue.packages.map((p) => `${p.id} (${p.label})`).join(", ");
    return err(
      "UNKNOWN_PACKAGE",
      `Package "${packageId}" is not offered at ${venue.name}.`,
      `Choose one of: ${known}. Confirm with the customer if needed before retrying.`,
    );
  }

  if (guests > pkg.maxGuests) {
    return err(
      "GUESTS_EXCEED_CAPACITY",
      `${guests} guests exceeds the ${pkg.label} maximum of ${pkg.maxGuests}.`,
      `Tell the customer this package caps at ${pkg.maxGuests} guests. Suggest a larger package if one exists, otherwise propose splitting the event.`,
    );
  }

  let resolvedSpaceId: string;
  if (spaceId) {
    if (!pkg.appliesToSpaceIds.includes(spaceId)) {
      const allowed = pkg.appliesToSpaceIds
        .map((id) => venue.spaces.find((s) => s.id === id)?.name ?? id)
        .join(", ");
      return err(
        "UNKNOWN_SPACE",
        `Space "${spaceId}" is not bookable with the ${pkg.label} package.`,
        `Use one of: ${allowed}.`,
      );
    }
    resolvedSpaceId = spaceId;
  } else if (pkg.appliesToSpaceIds.length === 1) {
    resolvedSpaceId = pkg.appliesToSpaceIds[0];
  } else {
    const allowedNames = pkg.appliesToSpaceIds
      .map((id) => venue.spaces.find((s) => s.id === id)?.name ?? id)
      .join(", ");
    return err(
      "AMBIGUOUS_SPACE",
      `The ${pkg.label} package can be hosted in multiple spaces; the customer must pick one.`,
      `Ask the customer which they prefer: ${allowedNames}. Don't guess — confirm before re-calling compute_quote with a spaceId.`,
    );
  }

  const breakdown: PriceBreakdown = computeBreakdown(venue, pkg, {
    date: dateISO,
    time,
    guests,
    packageId: pkg.id,
    spaceId: resolvedSpaceId,
  });

  return ok({
    breakdown,
    input: parsed.data,
    packageId: pkg.id,
    spaceId: resolvedSpaceId,
  });
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────

export type ToolName = "check_availability" | "compute_quote";

export function isToolName(s: string): s is ToolName {
  return s === "check_availability" || s === "compute_quote";
}

export function runTool(
  name: ToolName,
  venue: PublicVenueListing,
  rawInput: unknown,
): ToolResult<unknown> {
  switch (name) {
    case "check_availability":
      return runCheckAvailability(venue, rawInput);
    case "compute_quote":
      return runComputeQuote(venue, rawInput);
  }
}

// Re-export for callers building the tool-call summaries shown in the UI.
export function summarizeArgs(name: ToolName, rawInput: unknown): string {
  if (typeof rawInput !== "object" || rawInput === null) return "";
  const input = rawInput as Record<string, unknown>;
  if (name === "check_availability") {
    const date = typeof input.dateISO === "string" ? input.dateISO : "?";
    const guests = typeof input.guests === "number" ? `${input.guests}` : "?";
    return `${date}, ${guests} guests`;
  }
  if (name === "compute_quote") {
    const pkg = typeof input.packageId === "string" ? input.packageId : "?";
    const guests = typeof input.guests === "number" ? `× ${input.guests}` : "";
    return `${pkg} ${guests}`.trim();
  }
  return "";
}

