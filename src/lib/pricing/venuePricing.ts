// Pure pricing math for the venue inquiry calculator. Lifted verbatim from
// VaBene's marketplace frontend (Frontend/src/utils/venuePricing.ts) where
// it was originally extracted so the calculator could mount in multiple
// surfaces without forking the math.
//
// Listing prices are USD whole dollars (see ./types header). Formatting goes
// through Intl.NumberFormat; the symbol and separators follow locale rather
// than baking in `$`.

import type {
  CalculatorState,
  DayOfWeek,
  FeeLineItem,
  PackageOption,
  PricingOverride,
  VenueListing,
} from "./types";

export function usd(n: number, fractionDigits = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const WEEKDAY_MAP: Record<string, DayOfWeek> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// Resolve weekday for a YYYY-MM-DD string in `tz`. Anchors at noon UTC and
// reads back via Intl with timeZone option to avoid the local-vs-UTC pitfall.
export function weekdayInTz(
  dateISO: string,
  tz: string,
): DayOfWeek | undefined {
  if (!dateISO) return undefined;
  const d = new Date(`${dateISO}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(d);
  return WEEKDAY_MAP[wd];
}

export function matchOverride(
  override: PricingOverride,
  dow: DayOfWeek,
  hour: number | undefined,
): boolean {
  if (override.dayOfWeek !== dow) return false;
  if (!override.timeWindow) return true;
  if (hour === undefined) return false;
  const { startHour, endHour } = override.timeWindow;
  if (startHour <= endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

export interface PricingResult {
  subtotal: number;
  deposit: number;
  depositSemantics: "HeldAtBooking" | "AppliedToTab";
  matchedOverride?: PricingOverride;
}

export function resolvePricing(
  pkg: PackageOption,
  dateISO: string,
  guests: number,
  tz: string,
  hour?: number,
): PricingResult {
  const p = pkg.pricing;
  if (p.kind === "FlatFee") {
    const perGuest = p.pricePerGuest
      ? p.pricePerGuest * Math.max(0, guests)
      : 0;
    return {
      subtotal: p.pricePerGroup + perGuest,
      deposit: p.depositAmount,
      depositSemantics: "HeldAtBooking",
    };
  }
  const dow = weekdayInTz(dateISO, tz);
  let matched: PricingOverride | undefined;
  if (dow !== undefined && p.overrides) {
    matched = p.overrides.find((o) => matchOverride(o, dow, hour));
  }
  return {
    subtotal: matched ? matched.minimumSpend : p.minimumSpend,
    deposit: matched ? matched.reservationAmount : p.reservationAmount,
    depositSemantics: "AppliedToTab",
    matchedOverride: matched,
  };
}

export interface ResolvedFeeLine extends FeeLineItem {
  amount: number;
}

export function resolveFeeLines(
  feesConfig: VenueListing["feesConfig"],
  subtotal: number,
): ResolvedFeeLine[] {
  return feesConfig.lines.map((line) => {
    const amount =
      line.basis === "FixedAmount"
        ? (line.fixedAmount ?? 0)
        : subtotal * line.rate;
    return { ...line, amount };
  });
}

export interface PriceBreakdown {
  subtotal: number;
  deposit: number;
  depositSemantics: PricingResult["depositSemantics"];
  feeLines: ResolvedFeeLine[];
  dueAtBooking: number;
  estimatedEventTotal: number;
}

export function computeBreakdown(
  venue: VenueListing,
  pkg: PackageOption,
  state: CalculatorState,
): PriceBreakdown {
  const r = resolvePricing(
    pkg,
    state.date,
    state.guests,
    venue.timezone,
    hourFromTime(state.time),
  );
  const feeLines = resolveFeeLines(venue.feesConfig, r.subtotal);
  const bookingFees = feeLines
    .filter((f) => f.appliesAt === "Booking")
    .reduce((s, f) => s + f.amount, 0);
  const reconcileFees = feeLines
    .filter((f) => f.appliesAt === "Reconciliation")
    .reduce((s, f) => s + f.amount, 0);
  // FbMinimum credits the deposit at the venue, so it isn't double-counted.
  const depositCredit = r.depositSemantics === "AppliedToTab" ? r.deposit : 0;
  return {
    subtotal: r.subtotal,
    deposit: r.deposit,
    depositSemantics: r.depositSemantics,
    feeLines,
    dueAtBooking: r.deposit + bookingFees,
    estimatedEventTotal: r.subtotal + reconcileFees - depositCredit,
  };
}

const RATE_PCT_FORMAT = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 3,
});

export function formatRatePct(rate: number): string {
  return RATE_PCT_FORMAT.format(rate);
}

// Concrete binding base price for the package card. Today's DOW so it's always
// a real number, never "from $X".
export function packageBaseLine(
  pkg: PackageOption,
  venue: VenueListing,
): string {
  const today = new Date().toISOString().slice(0, 10);
  const r = resolvePricing(pkg, today, pkg.maxGuests, venue.timezone);
  if (pkg.pricing.kind === "FlatFee") {
    const hasGroup = pkg.pricing.pricePerGroup > 0;
    const hasGuest = !!pkg.pricing.pricePerGuest;
    if (hasGroup && hasGuest) {
      return `${usd(pkg.pricing.pricePerGroup)} hire + ${usd(
        pkg.pricing.pricePerGuest!,
      )}/guest`;
    }
    if (hasGuest) return `${usd(pkg.pricing.pricePerGuest!)}/guest`;
    return `${usd(pkg.pricing.pricePerGroup)} flat hire`;
  }
  return `${usd(r.subtotal)} F&B minimum`;
}

export function hourFromTime(time: string | undefined): number | undefined {
  if (!time) return undefined;
  const h = parseInt(time.slice(0, 2), 10);
  return Number.isFinite(h) ? h : undefined;
}

// Resolve the new spaceId when the user switches packages. Keeps the previous
// selection when it's still allowed; otherwise auto-picks the only or first
// allowed space. Null when the next package doesn't exist or has no spaces.
export function reconcileSpaceId(
  prevSpaceId: string | null,
  nextPkg: PackageOption | undefined,
): string | null {
  if (!nextPkg) return null;
  const allowed = nextPkg.appliesToSpaceIds;
  if (allowed.length === 0) return null;
  if (allowed.length === 1) return allowed[0];
  if (prevSpaceId && allowed.includes(prevSpaceId)) return prevSpaceId;
  return allowed[0];
}
