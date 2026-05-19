import { describe, expect, it } from "vitest";
import {
  computeBreakdown,
  hourFromTime,
  reconcileSpaceId,
  resolveFeeLines,
  resolvePricing,
  weekdayInTz,
} from "./venuePricing";
import type {
  CalculatorState,
  FeeLineItem,
  PackageOption,
  PricingOverride,
  VenueListing,
} from "./types";

// Calendar reference for the DOW assertions below (America/New_York, no DST games):
//   2026-07-15 = Wednesday (DOW 3)
//   2026-07-17 = Friday    (DOW 5)
//   2026-07-18 = Saturday  (DOW 6)
//   2026-07-19 = Sunday    (DOW 0)
const TZ = "America/New_York";

function flatFeePkg(over: Partial<PackageOption> = {}): PackageOption {
  return {
    id: "pkg-flat",
    label: "Buyout",
    blurb: "",
    appliesToSpaceIds: ["space-a"],
    maxGuests: 80,
    durationMinutes: 240,
    privacyMode: "Private",
    pricing: {
      kind: "FlatFee",
      pricePerGroup: 2000,
      depositAmount: 500,
    },
    ...over,
  };
}

function fbMinPkg(overrides?: PricingOverride[]): PackageOption {
  return {
    id: "pkg-fb",
    label: "Private dining",
    blurb: "",
    appliesToSpaceIds: ["space-a"],
    maxGuests: 40,
    durationMinutes: 180,
    privacyMode: "SemiPrivate",
    pricing: {
      kind: "FbMinimum",
      minimumSpend: 3000,
      reservationAmount: 500,
      depositAppliesToTab: true,
      overrides,
    },
  };
}

function venue(feeLines: FeeLineItem[] = []): VenueListing {
  return {
    id: "v1",
    slug: "v1",
    name: "Test Venue",
    tagline: "",
    descriptor: "",
    overview: "",
    neighborhood: "",
    addressLine1: "",
    city: "",
    timezone: TZ,
    weeklyHours: [],
    photos: [],
    spaces: [
      { id: "space-a", name: "Main", maxCapacity: 80, facilities: [] },
      { id: "space-b", name: "Patio", maxCapacity: 30, facilities: [] },
    ],
    packages: [],
    effectiveHouseRules: [],
    cancellationPolicy: { tiers: [] },
    feesConfig: { lines: feeLines },
    voice: { tone: "", examples: [] },
  };
}

describe("resolvePricing", () => {
  it("FlatFee group only: subtotal is the group price, deposit is held at booking", () => {
    const r = resolvePricing(flatFeePkg(), "2026-07-15", 30, TZ);
    expect(r.subtotal).toBe(2000);
    expect(r.deposit).toBe(500);
    expect(r.depositSemantics).toBe("HeldAtBooking");
  });

  it("FlatFee group + per-guest: subtotal adds per-guest to group price", () => {
    const pkg = flatFeePkg({
      pricing: {
        kind: "FlatFee",
        pricePerGroup: 1000,
        pricePerGuest: 75,
        depositAmount: 200,
      },
    });
    const r = resolvePricing(pkg, "2026-07-15", 20, TZ);
    expect(r.subtotal).toBe(1000 + 75 * 20);
  });

  it("FbMinimum no overrides: subtotal is the base minimum, deposit applies to tab", () => {
    const r = resolvePricing(fbMinPkg(), "2026-07-15", 25, TZ);
    expect(r.subtotal).toBe(3000);
    expect(r.deposit).toBe(500);
    expect(r.depositSemantics).toBe("AppliedToTab");
  });

  it("FbMinimum DOW-only override matches the right day", () => {
    const sat: PricingOverride = {
      dayOfWeek: 6,
      minimumSpend: 5000,
      reservationAmount: 1000,
    };
    const r = resolvePricing(fbMinPkg([sat]), "2026-07-18", 30, TZ);
    expect(r.subtotal).toBe(5000);
    expect(r.deposit).toBe(1000);
    expect(r.matchedOverride).toBeDefined();
  });

  it("FbMinimum DOW-only override falls back when the day differs", () => {
    const sat: PricingOverride = {
      dayOfWeek: 6,
      minimumSpend: 5000,
      reservationAmount: 1000,
    };
    const r = resolvePricing(fbMinPkg([sat]), "2026-07-15", 30, TZ);
    expect(r.subtotal).toBe(3000);
    expect(r.matchedOverride).toBeUndefined();
  });

  describe("FbMinimum DOW + time-window override", () => {
    const friEvening: PricingOverride = {
      dayOfWeek: 5,
      timeWindow: { startHour: 17, endHour: 22 },
      minimumSpend: 4000,
      reservationAmount: 750,
    };

    it("matches when the hour falls inside the window", () => {
      const r = resolvePricing(fbMinPkg([friEvening]), "2026-07-17", 25, TZ, 19);
      expect(r.subtotal).toBe(4000);
    });

    it("falls back when the hour is outside the window", () => {
      const r = resolvePricing(fbMinPkg([friEvening]), "2026-07-17", 25, TZ, 14);
      expect(r.subtotal).toBe(3000);
    });

    it("is inclusive of the start hour and exclusive of the end hour", () => {
      const start = resolvePricing(fbMinPkg([friEvening]), "2026-07-17", 25, TZ, 17);
      const end = resolvePricing(fbMinPkg([friEvening]), "2026-07-17", 25, TZ, 22);
      expect(start.subtotal).toBe(4000); // start hour matches
      expect(end.subtotal).toBe(3000); // end hour is exclusive
    });
  });

  it("FbMinimum override with a midnight-wrapping time window", () => {
    // 22:00..02:00 — a late-night override that wraps past midnight
    const lateNight: PricingOverride = {
      dayOfWeek: 5,
      timeWindow: { startHour: 22, endHour: 2 },
      minimumSpend: 6000,
      reservationAmount: 1500,
    };
    const inAt23 = resolvePricing(fbMinPkg([lateNight]), "2026-07-17", 25, TZ, 23);
    const inAt1 = resolvePricing(fbMinPkg([lateNight]), "2026-07-17", 25, TZ, 1);
    const outAt10 = resolvePricing(fbMinPkg([lateNight]), "2026-07-17", 25, TZ, 10);
    expect(inAt23.subtotal).toBe(6000);
    expect(inAt1.subtotal).toBe(6000);
    expect(outAt10.subtotal).toBe(3000);
  });
});

describe("resolveFeeLines", () => {
  it("Subtotal basis multiplies subtotal by rate", () => {
    const lines: FeeLineItem[] = [
      { label: "Service", rate: 0.22, basis: "Subtotal", appliesAt: "Reconciliation" },
    ];
    const out = resolveFeeLines({ lines }, 1000);
    expect(out[0].amount).toBe(220);
  });

  it("FixedAmount basis ignores rate and returns the fixed value", () => {
    const lines: FeeLineItem[] = [
      {
        label: "Cleaning",
        rate: 0.99,
        basis: "FixedAmount",
        fixedAmount: 150,
        appliesAt: "Booking",
      },
    ];
    const out = resolveFeeLines({ lines }, 5000);
    expect(out[0].amount).toBe(150);
  });

  it("Mixed lines resolve independently", () => {
    const lines: FeeLineItem[] = [
      { label: "Service", rate: 0.22, basis: "Subtotal", appliesAt: "Reconciliation" },
      {
        label: "Booking",
        rate: 0,
        basis: "FixedAmount",
        fixedAmount: 50,
        appliesAt: "Booking",
      },
    ];
    const out = resolveFeeLines({ lines }, 1000);
    expect(out[0].amount).toBe(220);
    expect(out[1].amount).toBe(50);
  });
});

describe("computeBreakdown", () => {
  it("FbMinimum: dueAtBooking = deposit + booking fees; total = subtotal + reconciliation fees − tab credit", () => {
    const v = venue([
      {
        label: "Booking fee",
        rate: 0,
        basis: "FixedAmount",
        fixedAmount: 50,
        appliesAt: "Booking",
      },
      {
        label: "Service",
        rate: 0.2,
        basis: "Subtotal",
        appliesAt: "Reconciliation",
      },
    ]);
    const pkg = fbMinPkg();
    const state: CalculatorState = {
      date: "2026-07-15",
      time: "19:00",
      guests: 20,
      packageId: pkg.id,
      spaceId: "space-a",
    };
    const b = computeBreakdown(v, pkg, state);
    // subtotal 3000, deposit 500 (credited to tab), booking fees 50, recon fees 600
    expect(b.subtotal).toBe(3000);
    expect(b.deposit).toBe(500);
    expect(b.dueAtBooking).toBe(550); // 500 + 50
    expect(b.estimatedEventTotal).toBe(3100); // 3000 + 600 − 500
  });

  it("FlatFee: deposit is held at booking, so no tab credit is subtracted from total", () => {
    const v = venue([
      {
        label: "Service",
        rate: 0.2,
        basis: "Subtotal",
        appliesAt: "Reconciliation",
      },
    ]);
    const pkg = flatFeePkg();
    const state: CalculatorState = {
      date: "2026-07-15",
      time: "19:00",
      guests: 20,
      packageId: pkg.id,
      spaceId: "space-a",
    };
    const b = computeBreakdown(v, pkg, state);
    // subtotal 2000, deposit 500 (held), recon fees 400
    expect(b.subtotal).toBe(2000);
    expect(b.dueAtBooking).toBe(500);
    expect(b.estimatedEventTotal).toBe(2400); // 2000 + 400, no credit
  });
});

describe("weekdayInTz", () => {
  it("returns the expected DOW for a known calendar date", () => {
    expect(weekdayInTz("2026-07-15", TZ)).toBe(3); // Wed
    expect(weekdayInTz("2026-07-19", TZ)).toBe(0); // Sun
  });

  it("returns the right DOW across the US spring-forward DST boundary", () => {
    // DST in the US starts 2026-03-08. The date itself is a Sunday in NY.
    expect(weekdayInTz("2026-03-08", TZ)).toBe(0);
    // The day before is Saturday, the day after is Monday — proves we're not
    // accidentally rolling a day at the boundary.
    expect(weekdayInTz("2026-03-07", TZ)).toBe(6);
    expect(weekdayInTz("2026-03-09", TZ)).toBe(1);
  });

  it("returns undefined for an empty or malformed date", () => {
    expect(weekdayInTz("", TZ)).toBeUndefined();
    expect(weekdayInTz("not-a-date", TZ)).toBeUndefined();
  });
});

describe("hourFromTime", () => {
  it("parses HH:MM and returns the hour", () => {
    expect(hourFromTime("19:00")).toBe(19);
    expect(hourFromTime("07:30")).toBe(7);
  });

  it("returns undefined for empty or invalid input", () => {
    expect(hourFromTime(undefined)).toBeUndefined();
    expect(hourFromTime("")).toBeUndefined();
    expect(hourFromTime("xx:30")).toBeUndefined();
  });
});

describe("reconcileSpaceId", () => {
  it("keeps the prior selection when the next package allows it", () => {
    const next = flatFeePkg({ appliesToSpaceIds: ["space-a", "space-b"] });
    expect(reconcileSpaceId("space-b", next)).toBe("space-b");
  });

  it("auto-picks the sole allowed space when the prior is no longer valid", () => {
    const next = flatFeePkg({ appliesToSpaceIds: ["space-b"] });
    expect(reconcileSpaceId("space-a", next)).toBe("space-b");
  });

  it("falls back to the first allowed space when the prior is not allowed", () => {
    const next = flatFeePkg({ appliesToSpaceIds: ["space-a", "space-b"] });
    expect(reconcileSpaceId("space-z", next)).toBe("space-a");
  });

  it("returns null when the package has no spaces", () => {
    const next = flatFeePkg({ appliesToSpaceIds: [] });
    expect(reconcileSpaceId("space-a", next)).toBeNull();
  });
});
