import { _voicedVenues } from "./venues";
import type { VenueListing, VenueVoice } from "./pricing/types";

// Server-only access to the full venue listing, including `voice` prose
// used to build the agent's system prompt. Import from API route handlers
// and prompt builders — never from a "use client" file.

export function getVenueWithVoice(id: string): VenueListing | undefined {
  return _voicedVenues.find((v) => v.id === id);
}

export function getVenueVoice(id: string): VenueVoice | undefined {
  return getVenueWithVoice(id)?.voice;
}
