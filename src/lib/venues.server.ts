import "server-only";
import voiceData from "../../data/venues.voice.json";
import { VENUES } from "./venues";
import { parseVoiceMap } from "./pricing/venueSchema";
import type { VenueListing, VenueVoice } from "./pricing/types";

// Server-only access to the full venue listing, including `voice` prose
// used to build the agent's system prompt. Import from API route handlers
// and prompt builders — never from a "use client" file. `server-only`
// fails the build if a client module ever pulls this in.

const VOICES: Record<string, VenueVoice> = parseVoiceMap(voiceData);

// Belt-and-suspenders: every public venue must have a voice entry, and
// vice versa. Catches a maintainer adding a venue to one file and forgetting
// the other. Runs once at module load on the server.
for (const v of VENUES) {
  if (!VOICES[v.id]) {
    throw new Error(`Missing voice entry for venue "${v.id}"`);
  }
}
for (const id of Object.keys(VOICES)) {
  if (!VENUES.some((v) => v.id === id)) {
    throw new Error(`Orphan voice entry for unknown venue "${id}"`);
  }
}

export function getVenueWithVoice(id: string): VenueListing | undefined {
  const venue = VENUES.find((v) => v.id === id);
  if (!venue) return undefined;
  return { ...venue, voice: VOICES[id] };
}

export function getVenueVoice(id: string): VenueVoice | undefined {
  return VOICES[id];
}
