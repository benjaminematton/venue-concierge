import { describe, expect, it } from "vitest";
import {
  runCheckAvailability,
  runComputeQuote,
  summarizeArgs,
} from "./tools";
import type { PublicVenueListing } from "@/lib/pricing/types";

// Test fixtures kept independent from data/venues.public.json — the static
// rule (weekends in August, first Friday of every month) is exercised
// against the same TZ + calendar as production, but the venue shape stays
// local so a future seed edit doesn't trip the rule's assertions.
const TZ = "America/New_York";

function venueWith(overrides: Partial<PublicVenueListing> = {}): PublicVenueListing {
  return {
    id: "v-test",
    slug: "v-test",
    name: "Test Venue",
    tagline: "",
    descriptor: "",
    overview: "",
    neighborhood: "",
    addressLine1: "",
    city: "",
    timezone: TZ,
    weeklyHours: [
      { day: "Tue", open: "17:00", close: "23:00" },
      { day: "Wed", open: "17:00", close: "23:00" },
      { day: "Thu", open: "17:00", close: "23:00" },
      { day: "Fri", open: "17:00", close: "23:00" },
      { day: "Sat", open: "17:00", close: "23:00" },
    ],
    photos: [],
    spaces: [
      { id: "main", name: "Main Room", maxCapacity: 40, facilities: [] },
    ],
    packages: [
      {
        id: "pkg-main",
        label: "Main Buyout",
        blurb: "",
        appliesToSpaceIds: ["main"],
        maxGuests: 40,
        durationMinutes: 180,
        privacyMode: "Private",
        pricing: {
          kind: "FlatFee",
          pricePerGroup: 2000,
          depositAmount: 500,
        },
      },
    ],
    effectiveHouseRules: [],
    cancellationPolicy: { tiers: [] },
    feesConfig: { lines: [] },
    ...overrides,
  };
}

// Calendar reference:
//   2026-08-15 = Saturday (in August → statically blocked)
//   2026-08-18 = Tuesday (in August, weekday → open)
//   2026-09-04 = Friday  (first Friday of September → statically blocked)
//   2026-09-11 = Friday  (second Friday → open)
//   2026-07-22 = Wednesday (no special rules → open)

describe("runCheckAvailability", () => {
  it("returns available for a normal open weekday", () => {
    const r = runCheckAvailability(venueWith(), {
      dateISO: "2026-07-22",
      guests: 20,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.available).toBe(true);
  });

  it("returns unavailable with alternates for an August weekend", () => {
    const r = runCheckAvailability(venueWith(), {
      dateISO: "2026-08-15",
      guests: 20,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.available).toBe(false);
    expect(r.data.alternateDates?.length).toBeGreaterThan(0);
  });

  it("returns unavailable with alternates on the first Friday of a month", () => {
    const r = runCheckAvailability(venueWith(), {
      dateISO: "2026-09-04",
      guests: 20,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.available).toBe(false);
    expect(r.data.alternateDates?.length).toBeGreaterThan(0);
  });

  it("returns unavailable with alternates when the venue is closed that DOW", () => {
    // The fixture closes Sun + Mon (weeklyHours has Tue..Sat). Pick a Sunday.
    const r = runCheckAvailability(venueWith(), {
      dateISO: "2026-07-19", // Sunday
      guests: 20,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.available).toBe(false);
    expect(r.data.alternateDates?.length).toBeGreaterThan(0);
  });

  it("alternates only contain open AND non-statically-blocked days", () => {
    const r = runCheckAvailability(venueWith(), {
      dateISO: "2026-08-15",
      guests: 20,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const iso of r.data.alternateDates ?? []) {
      const [, m, d] = iso.split("-").map(Number);
      // Not a first-Friday-of-month
      const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
      const isFirstFriday = dow === 5 && d <= 7;
      expect(isFirstFriday).toBe(false);
      // Not an August weekend
      const isAugWeekend = m === 8 && (dow === 0 || dow === 6);
      expect(isAugWeekend).toBe(false);
    }
  });

  it("refuses when the guest count exceeds the venue's max capacity", () => {
    const r = runCheckAvailability(venueWith(), {
      dateISO: "2026-07-22",
      guests: 999,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.available).toBe(false);
  });

  it("returns INVALID_INPUT for a malformed date", () => {
    const r = runCheckAvailability(venueWith(), {
      dateISO: "tomorrow",
      guests: 20,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("INVALID_INPUT");
  });
});

describe("runComputeQuote", () => {
  const baseInput = {
    packageId: "pkg-main",
    dateISO: "2026-07-22",
    time: "19:00",
    guests: 20,
  };

  it("computes a breakdown for a valid request", () => {
    const r = runComputeQuote(venueWith(), baseInput);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.breakdown.subtotal).toBe(2000);
    expect(r.data.packageId).toBe("pkg-main");
    expect(r.data.spaceId).toBe("main"); // auto-resolved (single space)
    expect(r.data.input).toEqual(baseInput);
  });

  it("returns UNKNOWN_PACKAGE for a missing package id", () => {
    const r = runComputeQuote(venueWith(), {
      ...baseInput,
      packageId: "does-not-exist",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("UNKNOWN_PACKAGE");
    expect(r.error.suggested_action).toContain("pkg-main");
  });

  it("returns GUESTS_EXCEED_CAPACITY when guests > package maxGuests", () => {
    const r = runComputeQuote(venueWith(), { ...baseInput, guests: 999 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("GUESTS_EXCEED_CAPACITY");
  });

  it("returns UNKNOWN_SPACE when the caller names a space the package doesn't allow", () => {
    const r = runComputeQuote(venueWith(), {
      ...baseInput,
      spaceId: "not-a-space",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("UNKNOWN_SPACE");
  });

  it("returns AMBIGUOUS_SPACE when the package allows multiple spaces and none specified", () => {
    // Use tagged names ("FixtureSpaceA/B") rather than common words like
    // "Main"/"Patio" — those would collide with substrings of unrelated
    // copy ("Main thing is…"), giving a false-positive `toContain` match.
    // Distinctive names couple the assertion to the fixture, not to UX
    // wording that may drift.
    const multiSpaceVenue = venueWith({
      spaces: [
        { id: "s-a", name: "FixtureSpaceA", maxCapacity: 40, facilities: [] },
        { id: "s-b", name: "FixtureSpaceB", maxCapacity: 30, facilities: [] },
      ],
      packages: [
        {
          id: "pkg-multi",
          label: "Either Room",
          blurb: "",
          appliesToSpaceIds: ["s-a", "s-b"],
          maxGuests: 40,
          durationMinutes: 180,
          privacyMode: "Private",
          pricing: {
            kind: "FlatFee",
            pricePerGroup: 2000,
            depositAmount: 500,
          },
        },
      ],
    });
    const r = runComputeQuote(multiSpaceVenue, {
      ...baseInput,
      packageId: "pkg-multi",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("AMBIGUOUS_SPACE");
    // The action must name BOTH options (using display names, since that's
    // what the customer would recognise) so the agent has something concrete
    // to ask about — not just one.
    expect(r.error.suggested_action).toContain("FixtureSpaceA");
    expect(r.error.suggested_action).toContain("FixtureSpaceB");
  });

  it("accepts a valid spaceId when the package allows multiple", () => {
    const multiSpaceVenue = venueWith({
      spaces: [
        { id: "main", name: "Main", maxCapacity: 40, facilities: [] },
        { id: "patio", name: "Patio", maxCapacity: 30, facilities: [] },
      ],
      packages: [
        {
          id: "pkg-multi",
          label: "Either Room",
          blurb: "",
          appliesToSpaceIds: ["main", "patio"],
          maxGuests: 40,
          durationMinutes: 180,
          privacyMode: "Private",
          pricing: {
            kind: "FlatFee",
            pricePerGroup: 2000,
            depositAmount: 500,
          },
        },
      ],
    });
    const r = runComputeQuote(multiSpaceVenue, {
      ...baseInput,
      packageId: "pkg-multi",
      spaceId: "patio",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.spaceId).toBe("patio");
  });

  it("returns INVALID_INPUT for malformed input", () => {
    const r = runComputeQuote(venueWith(), {
      ...baseInput,
      dateISO: "not-a-date",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("INVALID_INPUT");
  });
});

describe("summarizeArgs", () => {
  it("formats check_availability as 'date, N guests'", () => {
    expect(
      summarizeArgs("check_availability", {
        dateISO: "2026-07-22",
        guests: 25,
      }),
    ).toBe("2026-07-22, 25 guests");
  });

  it("formats compute_quote as 'packageId × N'", () => {
    expect(
      summarizeArgs("compute_quote", {
        packageId: "pkg-main",
        guests: 25,
      }),
    ).toBe("pkg-main × 25");
  });

  it("returns empty string when input is not an object", () => {
    expect(summarizeArgs("check_availability", "garbage")).toBe("");
    expect(summarizeArgs("compute_quote", null)).toBe("");
  });

  it("uses '?' placeholders for missing or wrong-type fields", () => {
    expect(summarizeArgs("check_availability", {})).toBe("?, ? guests");
    // compute_quote: missing packageId becomes "?"; missing guests drops
    // the " × N" suffix entirely.
    expect(summarizeArgs("compute_quote", {})).toBe("?");
    expect(summarizeArgs("compute_quote", { guests: 25 })).toBe("? × 25");
    expect(summarizeArgs("compute_quote", { packageId: "pkg-main" })).toBe(
      "pkg-main",
    );
  });
});
