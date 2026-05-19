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
  // ISO date (YYYY-MM-DD) in the venue's local calendar.
  date: string;
  guests: number;
}

function feeLabel(line: ResolvedFeeLine): string {
  if (line.basis === "FixedAmount") return line.label;
  if (line.rate === 0) return line.label;
  return `${line.label} (${formatRatePct(line.rate)})`;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

// Parse YYYY-MM-DD as a local calendar date — `new Date("2026-06-15")` is
// UTC midnight, which would shift a day in negative-offset zones.
function formatLocalDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return DATE_FORMAT.format(new Date(y, m - 1, d));
}

function feeKey(line: ResolvedFeeLine, i: number): string {
  return `${line.appliesAt}-${i}-${line.label}`;
}

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
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Estimated quote
          </div>
          <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {packageLabel}
          </h2>
        </div>
        <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
          <div className="font-medium text-zinc-700 dark:text-zinc-300">
            {venueName}
          </div>
          <div className="mt-0.5 tabular-nums">
            {formatLocalDate(date)} · {guests} {guests === 1 ? "guest" : "guests"}
          </div>
        </div>
      </header>

      <dl className="mt-5 space-y-2 text-sm">
        <div className="flex items-baseline justify-between">
          <dt className="text-zinc-700 dark:text-zinc-300">
            {isFbMinimum ? "Food & beverage minimum" : "Package fee"}
          </dt>
          <dd className="font-mono tabular-nums text-zinc-900 dark:text-zinc-50">
            {usd(breakdown.subtotal)}
          </dd>
        </div>

        {bookingFees.map((line, i) => (
          <div key={feeKey(line, i)} className="flex items-baseline justify-between">
            <dt className="text-zinc-600 dark:text-zinc-400">{feeLabel(line)}</dt>
            <dd className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
              {usd(line.amount)}
            </dd>
          </div>
        ))}

        <div className="my-3 h-px bg-zinc-200 dark:bg-zinc-800" />

        <div className="flex items-baseline justify-between">
          <dt className="font-semibold text-zinc-900 dark:text-zinc-50">
            Due at booking
          </dt>
          <dd className="font-mono text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {usd(breakdown.dueAtBooking)}
          </dd>
        </div>
        {isFbMinimum && (
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Reservation deposit of {usd(breakdown.deposit)} is credited to your tab
            at the venue.
          </p>
        )}

        {reconcileFees.length > 0 && (
          <>
            <div className="my-3 h-px bg-zinc-200 dark:bg-zinc-800" />
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              At the event
            </div>
            {reconcileFees.map((line, i) => (
              <div
                key={feeKey(line, i)}
                className="flex items-baseline justify-between"
              >
                <dt className="text-zinc-600 dark:text-zinc-400">
                  {feeLabel(line)}
                </dt>
                <dd className="font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                  {usd(line.amount)}
                </dd>
              </div>
            ))}
          </>
        )}

        <div className="my-3 h-px bg-zinc-200 dark:bg-zinc-800" />

        <div className="flex items-baseline justify-between">
          <dt className="font-semibold text-zinc-900 dark:text-zinc-50">
            Estimated event total
          </dt>
          <dd className="font-mono text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {usd(breakdown.estimatedEventTotal)}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
        Estimate based on current selection. Final total may shift with actual
        spend and guest count.
      </p>
    </div>
  );
}
