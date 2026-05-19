"use client";

import { useMemo, useState } from "react";
import { QuotePanel } from "@/components/QuotePanel";
import { computeBreakdown } from "@/lib/pricing/venuePricing";
import { VENUES, listVenueSummaries } from "@/lib/venues";

const VENUE_SUMMARIES = listVenueSummaries();

// Hardcoded selection used to prove the QuotePanel renders against real
// venue data. The chat will drive these once the agent is wired — at that
// point these become state and need to enter the useMemo deps below.
const DATE = "2026-06-15";
const TIME = "19:00";
const GUESTS = 25;

export default function Home() {
  const [venueId, setVenueId] = useState(VENUES[0].id);
  const venue = VENUES.find((v) => v.id === venueId)!;
  const pkg = venue.packages[0];

  const breakdown = useMemo(
    () =>
      pkg
        ? computeBreakdown(venue, pkg, {
            date: DATE,
            time: TIME,
            guests: GUESTS,
            packageId: pkg.id,
            spaceId: pkg.appliesToSpaceIds[0] ?? null,
          })
        : null,
    [venue, pkg],
  );

  return (
    <div className="flex flex-1 flex-col font-sans">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="size-7 rounded-lg bg-zinc-900 dark:bg-zinc-50" />
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Concierge
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                AI quoting assistant
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[1fr_24rem]">
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Chat will live here. Right now this page is mounted with a hardcoded
          selection so the quote breakdown can be styled and verified against
          real venue data before the agent is wired up.
        </div>
        <aside>
          <QuotePanel
            venue={venue}
            venues={VENUE_SUMMARIES}
            breakdown={breakdown}
            selectedPackageId={pkg?.id ?? null}
            date={DATE}
            guests={GUESTS}
            onSwitchVenue={setVenueId}
          />
        </aside>
      </main>
    </div>
  );
}
