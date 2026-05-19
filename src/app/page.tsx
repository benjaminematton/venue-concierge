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
        <div className="mx-auto flex w-full max-w-6xl items-baseline justify-between px-8 py-6">
          <div className="flex items-baseline gap-4">
            {/* Wordmark. Display-serif italic with a fine ornament,
                no boxy logo — the type IS the mark. */}
            <span className="font-display text-2xl font-medium italic leading-none tracking-tight text-ink">
              Concierge
            </span>
            <span aria-hidden className="text-rule-strong">
              ·
            </span>
            <span className="font-sans text-[11px] uppercase tracking-[0.22em] text-ink-soft">
              A private dining guide
            </span>
          </div>
          <a
            href="https://github.com/benjaminematton/venue-concierge"
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-[11px] uppercase tracking-[0.22em] text-ink-soft transition hover:text-accent"
          >
            View source
          </a>
        </div>
      </header>

      {error && (
        <div className="border-b border-error/40 bg-error-soft px-8 py-3 text-sm">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-3 text-error">
            <span aria-hidden className="font-mono text-[10px] uppercase">
              ✕
            </span>
            <span className="flex-1 italic">{error}</span>
            <button
              type="button"
              onClick={clearError}
              aria-label="Dismiss error"
              className="font-sans text-[10px] uppercase tracking-[0.22em] text-error transition hover:text-ink"
            >
              dismiss
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-10 px-8 py-10 md:grid-cols-[1fr_20rem]">
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
        <div className="mx-auto flex w-full max-w-6xl items-baseline justify-between px-8 py-5 font-sans text-[11px] uppercase tracking-[0.22em] text-ink-faint">
          <span>Extracted from VaBene · An event-planning marketplace</span>
          <span className="font-mono normal-case tracking-normal text-ink-faint">
            v0.1
          </span>
        </div>
      </footer>
    </div>
  );
}
