"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { QuotePanel } from "@/components/QuotePanel";
import { useChatStream } from "@/lib/useChatStream";
import { suggestedPromptsFor } from "@/lib/suggestedPrompts";
import { VENUES, listVenueSummaries } from "@/lib/venues";

const VENUE_SUMMARIES = listVenueSummaries();

export default function Home() {
  const [venueId, setVenueId] = useState(VENUES[0].id);
  const venue = VENUES.find((v) => v.id === venueId) ?? VENUES[0];
  const { messages, quote, isStreaming, error, send, clearError, stop } =
    useChatStream(venueId);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-rule">
        <div className="mx-auto flex w-full max-w-6xl items-baseline justify-between px-8 py-5">
          <span className="font-display text-[20px] font-medium leading-none tracking-tight text-ink">
            Concierge
          </span>
          <a
            href="https://github.com/benjaminematton/venue-concierge"
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-[12px] text-ink-soft transition hover:text-accent"
          >
            View source ↗
          </a>
        </div>
      </header>

      {error && (
        <div className="border-b border-error/30 bg-error-soft px-8 py-2.5 text-[13px]">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-3 text-error">
            <span aria-hidden className="font-mono text-[11px]">
              ✕
            </span>
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={clearError}
              aria-label="Dismiss error"
              className="font-sans text-[12px] text-error transition hover:text-ink"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-12 px-8 py-12 md:grid-cols-[1fr_22rem]">
        <ChatPanel
          messages={messages}
          venueName={venue.name}
          onSubmit={send}
          onStop={stop}
          isStreaming={isStreaming}
          suggestedPrompts={suggestedPromptsFor(venue.id)}
        />
        <aside>
          <QuotePanel
            venue={venue}
            venues={VENUE_SUMMARIES}
            breakdown={quote?.breakdown ?? null}
            selectedPackageId={quote?.packageId ?? null}
            date={quote?.dateISO ?? null}
            guests={quote?.guests ?? null}
            onSwitchVenue={setVenueId}
          />
        </aside>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex w-full max-w-6xl items-baseline justify-between px-8 py-4 font-sans text-[12px] text-ink-faint">
          <span>
            Extracted from{" "}
            <span className="text-ink-soft">VaBene</span>, an event-planning
            marketplace.
          </span>
          <span className="font-mono text-[11px]">venue-concierge.vercel.app</span>
        </div>
      </footer>
    </div>
  );
}
