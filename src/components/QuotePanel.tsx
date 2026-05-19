"use client";

import { Calculator } from "lucide-react";
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
    <div className="flex h-full flex-col gap-4">
      <VenueSwitcher
        venues={venues}
        selectedId={venue.id}
        onChange={onSwitchVenue}
      />

      {ready ? (
        <PriceBreakdown
          // Key so the entry animation re-fires when the agent re-quotes
          // against new inputs (the same component instance otherwise
          // updates in place and the animation only runs on mount).
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
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
        <Calculator className="size-5" aria-hidden />
        <div className="text-sm font-medium">
          Quote will appear here as we talk
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
        Tell {venueName} about your event in the chat. Once we have the date,
        guest count, and a package, the breakdown shows up here.
      </p>
    </div>
  );
}
