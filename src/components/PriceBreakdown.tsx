import {
  formatRatePct,
  usd,
  type PriceBreakdown as PriceBreakdownData,
  type ResolvedFeeLine,
} from "@/lib/pricing/venuePricing";

interface PriceBreakdownProps {
  breakdown: PriceBreakdownData;
  packageLabel: string;
  venueName: string;
  date: string;
  guests: number;
}

function feeLabel(line: ResolvedFeeLine): string {
  if (line.basis === "FixedAmount") return line.label;
  if (line.rate === 0) return line.label;
  return `${line.label} (${formatRatePct(line.rate)})`;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function formatLocalDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return DATE_FORMAT.format(new Date(y, m - 1, d));
}

function feeKey(line: ResolvedFeeLine, i: number): string {
  return `${line.appliesAt}-${i}-${line.label}`;
}

// Receipt slip aesthetic — hairline rules, serif headlines, mono numerals,
// vermillion accent reserved for the number the customer commits to today.
export function PriceBreakdown({
  breakdown,
  packageLabel,
  venueName,
  date,
  guests,
}: PriceBreakdownProps) {
  const bookingFees = breakdown.feeLines.filter((f) => f.appliesAt === "Booking");
  const reconcileFees = breakdown.feeLines.filter(
    (f) => f.appliesAt === "Reconciliation",
  );
  const isFbMinimum = breakdown.depositSemantics === "AppliedToTab";

  return (
    <div className="border-y border-rule-strong py-6 text-ink">
      <header className="mb-5">
        <div className="font-sans text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          Estimated quote
        </div>
        <h2 className="mt-1 font-display text-xl italic leading-tight tracking-tight text-ink">
          {packageLabel}
        </h2>
        <div className="mt-1.5 font-sans text-[11px] uppercase tracking-[0.18em] text-ink-soft">
          <span>{venueName}</span>
          <span aria-hidden className="mx-2 text-ink-faint">
            ·
          </span>
          <span className="font-mono normal-case tracking-normal text-ink-soft">
            {formatLocalDate(date)}
          </span>
          <span aria-hidden className="mx-2 text-ink-faint">
            ·
          </span>
          <span className="font-mono normal-case tracking-normal text-ink-soft">
            {guests} {guests === 1 ? "guest" : "guests"}
          </span>
        </div>
      </header>

      <dl className="space-y-1.5 text-[13px]">
        <Row
          label={isFbMinimum ? "Food & beverage minimum" : "Package fee"}
          value={usd(breakdown.subtotal)}
          strong
        />
        {bookingFees.map((line, i) => (
          <Row
            key={feeKey(line, i)}
            label={feeLabel(line)}
            value={usd(line.amount)}
            faint
          />
        ))}
      </dl>

      <Divider />

      {/* Due-at-booking is the only number set in vermillion. The whole
          design's accent budget lives here — every other figure stays ink. */}
      <div className="flex items-baseline justify-between">
        <dt className="font-display text-[15px] italic text-ink">
          Due at booking
        </dt>
        <dd className="font-mono text-lg font-medium tabular-nums text-accent">
          {usd(breakdown.dueAtBooking)}
        </dd>
      </div>
      {isFbMinimum && (
        <p className="mt-2 max-w-prose font-sans text-[11px] italic leading-snug text-ink-soft">
          Reservation deposit of {usd(breakdown.deposit)} is credited to your
          tab at the venue.
        </p>
      )}

      {reconcileFees.length > 0 && (
        <>
          <Divider />
          <div className="mb-2 font-sans text-[10px] uppercase tracking-[0.28em] text-ink-faint">
            At the event
          </div>
          <dl className="space-y-1.5 text-[13px]">
            {reconcileFees.map((line, i) => (
              <Row
                key={feeKey(line, i)}
                label={feeLabel(line)}
                value={usd(line.amount)}
                faint
              />
            ))}
          </dl>
        </>
      )}

      <Divider />

      <div className="flex items-baseline justify-between">
        <dt className="font-display text-[15px] italic text-ink">
          Estimated event total
        </dt>
        <dd className="font-mono text-lg font-medium tabular-nums text-ink">
          {usd(breakdown.estimatedEventTotal)}
        </dd>
      </div>

      <p className="mt-5 font-sans text-[11px] italic leading-snug text-ink-faint">
        Estimate based on current selection. Final total may shift with actual
        spend and guest count.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
  faint = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  faint?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt
        className={
          faint
            ? "font-sans text-ink-soft"
            : strong
              ? "font-display text-[15px] italic text-ink"
              : "font-sans text-ink"
        }
      >
        {label}
      </dt>
      <dd
        className={`font-mono tabular-nums ${
          faint ? "text-ink-soft" : strong ? "text-base font-medium text-ink" : "text-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Divider() {
  return <div className="my-4 h-px bg-rule" aria-hidden />;
}
