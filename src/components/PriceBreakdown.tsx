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
  month: "short",
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

// Receipt-style breakdown. The single oxblood accent sits on "Due at
// booking" — every other figure is ink. No decorative labels.
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
    <div className="border-t border-rule-strong pt-5 text-ink">
      <header className="mb-4">
        <h3 className="font-display text-[16px] font-medium leading-tight tracking-tight text-ink">
          {packageLabel}
        </h3>
        <div className="mt-1 font-sans text-[12px] text-ink-soft">
          <span>{venueName}</span>
          <span aria-hidden className="mx-1.5 text-ink-faint">
            ·
          </span>
          <span className="font-mono tabular-nums">{formatLocalDate(date)}</span>
          <span aria-hidden className="mx-1.5 text-ink-faint">
            ·
          </span>
          <span className="font-mono tabular-nums">
            {guests} {guests === 1 ? "guest" : "guests"}
          </span>
        </div>
      </header>

      <dl className="space-y-1.5 text-[13px]">
        <Row
          label={isFbMinimum ? "Food & beverage minimum" : "Package fee"}
          value={usd(breakdown.subtotal)}
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

      {/* The one number set in accent. */}
      <div className="flex items-baseline justify-between">
        <dt className="font-sans text-[14px] font-medium text-ink">
          Due at booking
        </dt>
        <dd className="font-mono text-[17px] font-medium tabular-nums text-accent">
          {usd(breakdown.dueAtBooking)}
        </dd>
      </div>
      {isFbMinimum && (
        <p className="mt-1.5 max-w-prose font-sans text-[12px] leading-snug text-ink-soft">
          Reservation deposit of {usd(breakdown.deposit)} is credited to your
          tab at the venue.
        </p>
      )}

      {reconcileFees.length > 0 && (
        <>
          <Divider />
          <div className="mb-2 font-sans text-[12px] font-medium text-ink-soft">
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
        <dt className="font-sans text-[14px] font-medium text-ink">
          Estimated event total
        </dt>
        <dd className="font-mono text-[17px] font-medium tabular-nums text-ink">
          {usd(breakdown.estimatedEventTotal)}
        </dd>
      </div>

      <p className="mt-4 font-sans text-[12px] leading-snug text-ink-faint">
        Estimate based on current selection. Final total may shift with actual
        spend and guest count.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  faint = false,
}: {
  label: string;
  value: string;
  faint?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={faint ? "font-sans text-ink-soft" : "font-sans text-ink"}>
        {label}
      </dt>
      <dd
        className={`font-mono tabular-nums ${
          faint ? "text-ink-soft" : "text-ink"
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
