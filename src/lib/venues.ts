import publicVenuesData from "../../data/venues.public.json";
import { parsePublicVenues } from "./pricing/venueSchema";
import type { PublicVenueListing, VenueSummary } from "./pricing/types";

// Static catalog, client-safe. Voice prose lives in data/venues.voice.json
// and is only imported by ./venues.server — so the client bundle never
// references the few-shot examples used to build the system prompt.
// Validated once at module load via Zod; a malformed seed fails boot
// rather than the first user message.
const VENUES_ARRAY: readonly PublicVenueListing[] = Object.freeze(
  parsePublicVenues(publicVenuesData),
);

export const VENUES = VENUES_ARRAY;

export function getVenue(id: string): PublicVenueListing | undefined {
  return VENUES.find((v) => v.id === id);
}

export function listVenueSummaries(): VenueSummary[] {
  return VENUES.map((v) => ({
    id: v.id,
    name: v.name,
    tagline: v.tagline,
    neighborhood: v.neighborhood,
  }));
}
