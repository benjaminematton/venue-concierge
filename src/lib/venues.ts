import venuesData from "../../data/venues.json";
import { parseVenues } from "./pricing/venueSchema";
import {
  stripVoice,
  type PublicVenueListing,
  type VenueListing,
  type VenueSummary,
} from "./pricing/types";

// Static catalog. 3 hand-curated venues with contrasting pricing models and
// distinct voices. Validated once at module load via Zod — a malformed seed
// fails boot rather than the first user message.
//
// Caveat: this module is currently imported by client components (the
// calculator runs in the browser), so the JSON ships as part of the bundle.
// The public surface here is `PublicVenueListing` (no voice prose) so the
// type system prevents accidental voice usage from the client. The full
// shape with `voice` is exposed only via `./venues.server` for prompt
// builders. If you ever need to actually strip voice from the client
// bundle, move the calculator to a server component and stop importing
// venues.json from client code.
const FULL: readonly VenueListing[] = Object.freeze(parseVenues(venuesData));

export const VENUES: readonly PublicVenueListing[] = FULL.map(stripVoice);

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

// Internal accessor used by ./venues.server to reach voice prose without
// re-parsing the JSON. Not part of the public surface.
export const _voicedVenues: readonly VenueListing[] = FULL;
