"use client";

import { PriceBreakdown } from "./PriceBreakdown";
import { VenueSwitcher } from "./VenueSwitcher";
import type { PriceBreakdown as PriceBreakdownData } from "@/lib/pricing/venuePricing";
import type { PublicVenueListing, VenueSummary } from "@/lib/pricing/types";

interface QuotePanelProps {
  venue: PublicVenueListing;
  venues: VenueSummary[];
  breakdown: PriceBreakdownData | null;
  selectedPackageId: string | null;
  date: string | null;
  guests: number | null;
  onSwitchVenue: (id: string) => void;
}

export function QuotePanel({
  venue,
  venues,
  breakdown,
  selectedPackageId,
  date,
  guests,
  onSwitchVenue,
}: QuotePanelProps) {
  const pkg = selectedPackageId
    ? venue.packages.find((p) => p.id === selectedPackageId)
    : null;
  const ready = breakdown && pkg && date && guests !== null;

  return (
    <div className="flex h-full flex-col gap-8">
      <VenueSwitcher
        venues={venues}
        selectedId={venue.id}
        onChange={onSwitchVenue}
      />

      {ready ? (
        <PriceBreakdown
          key={`${pkg.id}-${date}-${guests}`}
          breakdown={breakdown}
          packageLabel={pkg.label}
          venueName={venue.name}
          date={date}
          guests={guests}
        />
      ) : (
        <QuoteSkeleton venueName={venue.name} />
      )}
    </div>
  );
}

function QuoteSkeleton({ venueName }: { venueName: string }) {
  return (
    <div className="border-t border-rule-strong pt-5 text-ink">
      <h3 className="font-display text-[16px] font-medium leading-tight tracking-tight text-ink-soft">
        Awaiting details
      </h3>
      <p className="mt-2 max-w-[28ch] font-sans text-[13px] leading-relaxed text-ink-soft">
        Once {venueName} has a date, head count, and a package, the breakdown
        appears here.
      </p>
      <div className="my-5 h-px bg-rule" aria-hidden />
      <dl className="space-y-1.5 font-sans text-[13px] text-ink-faint">
        <Placeholder label="Subtotal" />
        <Placeholder label="Due at booking" />
        <Placeholder label="Estimated total" />
      </dl>
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt>{label}</dt>
      <dd className="font-mono text-ink-faint">—</dd>
    </div>
  );
}
