// Venue-listing types, lifted from VaBene's marketplace frontend
// (Frontend/src/types/venueListing.ts). The shape mirrors the backend
// VenueListingDto: monetary amounts are USD whole dollars (the production
// domain stores Money { amountCents } and the mapper converts before
// serializing).
//
// One field added for this project: `voice` on VenueListing, which carries
// few-shot examples threaded into the agent's system prompt so each venue's
// concierge sounds different.

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sun..Sat (matches JS Date.getDay())

// Short weekday labels used in VenueListing.weeklyHours. Kept as a literal
// union (not a free string) so a typo in seed JSON fails to typecheck rather
// than silently falling through weekdayInTz's lookup table.
export type DayShort = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

export interface TimeWindow {
  // 24-hour clock; matches the picked date's local hour in venue.timezone.
  // Inclusive start, exclusive end. Wraps midnight if startHour > endHour.
  startHour: number;
  endHour: number;
}

export interface PricingOverride {
  dayOfWeek: DayOfWeek;
  timeWindow?: TimeWindow;
  minimumSpend: number;
  reservationAmount: number;
}

export type PricingModel =
  | {
      kind: "FlatFee";
      pricePerGroup: number;
      pricePerGuest?: number; // optional, restaurant prix-fixe
      depositAmount: number;
    }
  | {
      kind: "FbMinimum";
      minimumSpend: number;
      reservationAmount: number;
      depositAppliesToTab: true;
      overrides?: PricingOverride[];
    };

export interface PackageOption {
  id: string;
  label: string;
  blurb: string;
  appliesToSpaceIds: string[];
  maxGuests: number;
  durationMinutes: number;
  pricing: PricingModel;
  privacyMode: "Private" | "SemiPrivate" | "Open";
  ageEnforcement?: { minAge: number; enforcedFromHourLocal?: number };
}

export interface Space {
  id: string;
  name: string;
  maxCapacity: number;
  minGuests?: number;
  facilities: string[];
  musicPolicy?: string;
  accessibility?: string[];
}

export interface FeeLineItem {
  label: string;
  rate: number; // 0.22 means 22%; ignored when basis === "FixedAmount"
  basis: "Subtotal" | "FixedAmount";
  fixedAmount?: number;
  appliesAt: "Booking" | "Reconciliation";
}

export interface CancellationTier {
  hoursBeforeEvent: number;
  refundFraction: number; // 0..1
}

export interface PhotoTile {
  src: string;
  alt: string;
  aspect: "tall" | "wide" | "square";
}

// Few-shot voice examples threaded into the agent's system prompt.
// Each pair shows a customer message and how *this* venue responds.
// Few-shot is the most reliable way to get noticeable voice differentiation
// across venues in a short demo.
export interface VoiceExample {
  customer: string;
  venue: string;
}

export interface VenueVoice {
  tone: string; // one-line descriptor, also visible to the model
  examples: VoiceExample[]; // 2-3 hand-written exchanges
}

// Client-safe projection of a venue. Same shape minus `voice`, which is
// server-only prompt material. Use this type anywhere a client component
// or non-prompt code touches a venue.
export type PublicVenueListing = Omit<VenueListing, "voice">;

export interface VenueListing {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  descriptor: string;
  overview: string;
  neighborhood: string;
  addressLine1: string;
  city: string;
  timezone: string; // IANA
  weeklyHours: { day: DayShort; open: string; close: string }[];
  photos: PhotoTile[];
  spaces: Space[];
  packages: PackageOption[];
  parking?: {
    freeOnPremises: boolean;
    freeStreet: boolean;
    paidOffPremises: boolean;
  };
  accessibility?: {
    accessibleParkingSpot: boolean;
    liftToAllFloors: boolean;
    cargoLift: boolean;
  };
  effectiveHouseRules: string[];
  cancellationPolicy: { tiers: CancellationTier[] };
  feesConfig: { lines: FeeLineItem[] };
  voice: VenueVoice;
  reviews?: { author: string; date: string; quote: string; rating: number }[];
}

// Client-safe projection of a venue: no voice prose, no pricing internals.
// Use this in components that render the venue catalog so the prompt-only
// fields aren't pulled into the client bundle.
export interface VenueSummary {
  id: string;
  name: string;
  tagline: string;
  neighborhood: string;
}

export interface CalculatorState {
  date: string;
  time: string; // HH:MM 24h
  guests: number;
  packageId: string | null;
  spaceId: string | null;
}
