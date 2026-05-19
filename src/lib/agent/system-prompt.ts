import type { TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import type { VenueListing } from "@/lib/pricing/types";

// Build the system prompt for a venue concierge. Returns an array of text
// blocks so the (voice + catalog) prefix can be marked cacheable; cache
// hits compound across turns within one conversation.
//
// Layout (top to bottom):
//   1. Identity   — who the agent is, speaks as
//   2. Behavior   — rules of engagement (gather info, never invent prices, etc.)
//   3. Voice      — few-shot exchanges in the venue's tone
//   4. Catalog    — packages, spaces, fees, hours, cancellation, as JSON
//
// cache_control is placed on the last block so the entire prefix becomes
// the cached prefix on subsequent turns.

export function buildSystemPrompt(venue: VenueListing): TextBlockParam[] {
  return [
    { type: "text", text: identityBlock(venue) },
    { type: "text", text: BEHAVIOR_BLOCK },
    { type: "text", text: voiceBlock(venue) },
    {
      type: "text",
      text: catalogBlock(venue),
      cache_control: { type: "ephemeral" },
    },
  ];
}

function identityBlock(venue: VenueListing): string {
  return `You are the AI assistant for ${venue.name} — a ${venue.descriptor.toLowerCase()} in ${venue.neighborhood}, ${venue.city}. You answer customer inquiries on the venue's behalf. Speak as "we" (the venue), never as a third party or as a neutral concierge. You represent this one venue and only this one venue.`;
}

const BEHAVIOR_BLOCK = `Behavior:
- Gather missing fields one or two questions at a time. Date, time, guest count, event type, package preference. Do not interrogate.
- Never invent pricing. Always call compute_quote to produce a number.
- When availability matters for a specific date, call check_availability first.
- On a tool error, follow the error's suggested_action rather than repeating the failing call.
- If the customer asks about something the venue doesn't offer or isn't covered in the catalog, say so honestly. Don't make up amenities, hours, or policies.
- Keep messages short. Two or three sentences is usually enough.`;

function voiceBlock(venue: VenueListing): string {
  // Label the venue side of each exchange as "We:" to reinforce the
  // first-person rule from the identity block — printing the venue name
  // here would invite the model to mimic third-person framing.
  const examples = venue.voice.examples
    .map(
      (ex, i) => `Example ${i + 1}:\nCustomer: ${ex.customer}\nWe: ${ex.venue}`,
    )
    .join("\n\n");
  return `Voice (${venue.voice.tone}):\nMatch the cadence and vocabulary of the examples below. Same length range. Same level of formality. Same use of contractions.\n\n${examples}`;
}

function catalogBlock(venue: VenueListing): string {
  // Hand-shape the JSON so the prompt stays scannable — the model reads this
  // every turn; a 200-line dump bloats tokens for no benefit.
  const packages = venue.packages.map((p) => ({
    id: p.id,
    label: p.label,
    blurb: p.blurb,
    appliesToSpaceIds: p.appliesToSpaceIds,
    maxGuests: p.maxGuests,
    durationMinutes: p.durationMinutes,
    privacyMode: p.privacyMode,
    pricing: p.pricing,
  }));
  const spaces = venue.spaces.map((s) => ({
    id: s.id,
    name: s.name,
    maxCapacity: s.maxCapacity,
    minGuests: s.minGuests,
    facilities: s.facilities,
    musicPolicy: s.musicPolicy,
  }));
  const catalog = {
    timezone: venue.timezone,
    weeklyHours: venue.weeklyHours,
    spaces,
    packages,
    feesConfig: venue.feesConfig,
    cancellationPolicy: venue.cancellationPolicy,
    houseRules: venue.effectiveHouseRules,
  };
  return `Catalog (do not invent fields outside this object):\n${JSON.stringify(catalog, null, 2)}`;
}
