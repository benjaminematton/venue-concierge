import { z } from "zod";
import type { PublicVenueListing, VenueVoice } from "./types";

// Runtime schemas for the seed JSON. Kept narrow on purpose — we only
// validate the shape the math and the agent rely on. Strict object mode
// catches the most common authoring mistake (typo'd field name) without
// blowing up on photos/reviews additions.
//
// The catalog is split across two files at the data boundary so the
// client bundle never references voice prose:
//   data/venues.public.json — PublicVenueListing[] (no voice)
//   data/venues.voice.json  — Record<venueId, VenueVoice>
// Consumers should `parse` once at module load and treat the result as
// readonly. A parse failure here means the seed file is wrong and we
// want to fail boot, not the first user request.

const dayShortSchema = z.enum(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);

// endHour allows 24 as a sentinel for "midnight at the end of the day" on
// non-wrapping windows; startHour stays clock-bound. matchOverride treats
// startHour > endHour as a wrapping window, so a window like 22..02 is
// expressed as { startHour: 22, endHour: 2 } rather than { 22, 26 }.
const timeWindowSchema = z.object({
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(0).max(24),
});

const pricingOverrideSchema = z.object({
  dayOfWeek: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  timeWindow: timeWindowSchema.optional(),
  minimumSpend: z.number().nonnegative(),
  reservationAmount: z.number().nonnegative(),
});

const pricingModelSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("FlatFee"),
    pricePerGroup: z.number().nonnegative(),
    pricePerGuest: z.number().nonnegative().optional(),
    depositAmount: z.number().nonnegative(),
  }),
  z.object({
    kind: z.literal("FbMinimum"),
    minimumSpend: z.number().nonnegative(),
    reservationAmount: z.number().nonnegative(),
    depositAppliesToTab: z.literal(true),
    overrides: z.array(pricingOverrideSchema).optional(),
  }),
]);

const spaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  maxCapacity: z.number().int().positive(),
  minGuests: z.number().int().positive().optional(),
  facilities: z.array(z.string()),
  musicPolicy: z.string().optional(),
  accessibility: z.array(z.string()).optional(),
});

const packageSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  blurb: z.string(),
  appliesToSpaceIds: z.array(z.string().min(1)).min(1),
  maxGuests: z.number().int().positive(),
  durationMinutes: z.number().int().positive(),
  pricing: pricingModelSchema,
  privacyMode: z.enum(["Private", "SemiPrivate", "Open"]),
  ageEnforcement: z
    .object({
      minAge: z.number().int().nonnegative(),
      enforcedFromHourLocal: z.number().int().min(0).max(23).optional(),
    })
    .optional(),
});

const feeLineSchema = z.object({
  label: z.string().min(1),
  rate: z.number().nonnegative(),
  basis: z.enum(["Subtotal", "FixedAmount"]),
  fixedAmount: z.number().nonnegative().optional(),
  appliesAt: z.enum(["Booking", "Reconciliation"]),
});

const cancellationTierSchema = z.object({
  hoursBeforeEvent: z.number().nonnegative(),
  refundFraction: z.number().min(0).max(1),
});

const photoSchema = z.object({
  src: z.string().min(1),
  alt: z.string(),
  aspect: z.enum(["tall", "wide", "square"]),
});

const voiceSchema = z.object({
  tone: z.string().min(1),
  examples: z
    .array(z.object({ customer: z.string().min(1), venue: z.string().min(1) }))
    .min(1),
});

const publicVenueSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  tagline: z.string(),
  descriptor: z.string(),
  overview: z.string(),
  neighborhood: z.string(),
  addressLine1: z.string(),
  city: z.string(),
  timezone: z.string().min(1),
  weeklyHours: z.array(
    z.object({ day: dayShortSchema, open: z.string(), close: z.string() }),
  ),
  photos: z.array(photoSchema),
  spaces: z.array(spaceSchema).min(1),
  packages: z.array(packageSchema).min(1),
  parking: z
    .object({
      freeOnPremises: z.boolean(),
      freeStreet: z.boolean(),
      paidOffPremises: z.boolean(),
    })
    .optional(),
  accessibility: z
    .object({
      accessibleParkingSpot: z.boolean(),
      liftToAllFloors: z.boolean(),
      cargoLift: z.boolean(),
    })
    .optional(),
  effectiveHouseRules: z.array(z.string()),
  cancellationPolicy: z.object({ tiers: z.array(cancellationTierSchema) }),
  feesConfig: z.object({ lines: z.array(feeLineSchema) }),
  reviews: z
    .array(
      z.object({
        author: z.string(),
        date: z.string(),
        quote: z.string(),
        rating: z.number().min(0).max(5),
      }),
    )
    .optional(),
});

export const PUBLIC_VENUES_SCHEMA = z.array(publicVenueSchema);
export const VOICE_MAP_SCHEMA = z.record(z.string().min(1), voiceSchema);

// Belt-and-suspenders cross-field check: every package must reference a
// space that exists on its venue, and the inferred shape must satisfy the
// hand-written PublicVenueListing interface.
export function parsePublicVenues(input: unknown): PublicVenueListing[] {
  const venues = PUBLIC_VENUES_SCHEMA.parse(input);
  for (const v of venues) {
    const spaceIds = new Set(v.spaces.map((s) => s.id));
    for (const pkg of v.packages) {
      for (const sid of pkg.appliesToSpaceIds) {
        if (!spaceIds.has(sid)) {
          throw new Error(
            `Venue "${v.id}" package "${pkg.id}" references unknown space "${sid}"`,
          );
        }
      }
    }
  }
  return venues satisfies PublicVenueListing[];
}

export function parseVoiceMap(input: unknown): Record<string, VenueVoice> {
  return VOICE_MAP_SCHEMA.parse(input);
}
