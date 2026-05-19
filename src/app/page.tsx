"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ChatPanel } from "@/components/ChatPanel";
import { QuotePanel } from "@/components/QuotePanel";
import { useChatStream } from "@/lib/useChatStream";
import { VENUES, listVenueSummaries } from "@/lib/venues";

const VENUE_SUMMARIES = listVenueSummaries();

export default function Home() {
  const [venueId, setVenueId] = useState(VENUES[0].id);
  const venue = VENUES.find((v) => v.id === venueId) ?? VENUES[0];
  const { messages, quote, isStreaming, error, send } = useChatStream(venueId);

  // Only surface the quote when it belongs to the active venue. The hook
  // resets on venue change but this guard keeps a race from showing the
  // wrong venue's numbers mid-switch.
  const activeQuote = quote && quote.venueId === venueId ? quote : null;

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

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        </div>
      )}

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[1fr_24rem]">
        <ChatPanel
          messages={messages}
          venueName={venue.name}
          onSubmit={send}
          isStreaming={isStreaming}
        />
        <aside>
          <QuotePanel
            venue={venue}
            venues={VENUE_SUMMARIES}
            breakdown={activeQuote?.breakdown ?? null}
            selectedPackageId={activeQuote?.packageId ?? null}
            date={activeQuote?.dateISO ?? null}
            guests={activeQuote?.guests ?? null}
            onSwitchVenue={setVenueId}
          />
        </aside>
      </main>
    </div>
  );
}
