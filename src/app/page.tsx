"use client";

import { useMemo, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { QuotePanel } from "@/components/QuotePanel";
import { computeBreakdown } from "@/lib/pricing/venuePricing";
import { VENUES, listVenueSummaries } from "@/lib/venues";
import type { ChatMessage } from "@/types/chat";

const VENUE_SUMMARIES = listVenueSummaries();

// Hardcoded selection used to prove the QuotePanel renders against real
// venue data. The chat will drive these once the agent is wired — at that
// point these become state and need to enter the useMemo deps below.
const DATE = "2026-06-15";
const TIME = "19:00";
const GUESTS = 25;

// Seeded transcript that exercises every visual: customer message, assistant
// reply with two tool-call pills, follow-up assistant text. Replaces itself
// with live agent output once /api/chat lands.
const SEEDED_MESSAGES: ChatMessage[] = [
  {
    id: "seed-1",
    role: "user",
    text: "Hi! Looking to host a 25-person rehearsal dinner on June 15 at 7pm. Any chance the back room is open?",
  },
  {
    id: "seed-2",
    role: "assistant",
    text: "Hey! Great timing — Monday June 15 at 7pm is open for the back room. Quick estimate based on a weekday F&B minimum, with the booking fee:",
    toolCalls: [
      {
        id: "tc-1",
        name: "check_availability",
        status: "ok",
        argsSummary: "2026-06-15, 19:00",
      },
      {
        id: "tc-2",
        name: "compute_quote",
        status: "ok",
        argsSummary: "quail-buyout × 25",
      },
    ],
  },
  {
    id: "seed-3",
    role: "assistant",
    text: "The $300 reservation deposit credits back to your tab at the venue, so you're really just out the $35 booking fee plus service. Want me to hold the date?",
  },
];

export default function Home() {
  const [venueId, setVenueId] = useState(VENUES[0].id);
  const [messages, setMessages] = useState<ChatMessage[]>(SEEDED_MESSAGES);

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

  function handleSwitchVenue(nextId: string) {
    setVenueId(nextId);
    setMessages([]);
  }

  function handleSubmit(text: string) {
    // Until the agent route is wired, every submission just lands as a user
    // message so the composer + scroll behavior can be sanity-checked.
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text },
    ]);
  }

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
        <ChatPanel
          messages={messages}
          venueName={venue.name}
          onSubmit={handleSubmit}
        />
        <aside>
          <QuotePanel
            venue={venue}
            venues={VENUE_SUMMARIES}
            breakdown={breakdown}
            selectedPackageId={pkg?.id ?? null}
            date={DATE}
            guests={GUESTS}
            onSwitchVenue={handleSwitchVenue}
          />
        </aside>
      </main>
    </div>
  );
}
