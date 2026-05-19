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
    <div className="border-y border-rule-strong py-6 text-ink">
      <div className="font-sans text-[10px] uppercase tracking-[0.28em] text-ink-faint">
        Estimated quote
      </div>
      <h2 className="mt-1 font-display text-xl italic leading-tight tracking-tight text-ink-soft">
        Pending
      </h2>
      <p className="mt-3 max-w-[24ch] font-sans text-[12px] italic leading-relaxed text-ink-soft">
        Tell {venueName} about your event in the chat. Once we have the date,
        guest count, and a package, the figure assembles here.
      </p>
      <div className="my-5 h-px bg-rule" aria-hidden />
      <dl className="space-y-1.5 font-mono text-[12px] tabular-nums text-ink-faint">
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
      <dt className="font-sans">{label}</dt>
      <dd className="text-ink-faint">—</dd>
    </div>
  );
}
