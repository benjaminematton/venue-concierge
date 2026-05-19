import venuesData from "../../data/venues.json";
import type { VenueListing } from "./pricing/types";

// Static catalog. 3 hand-curated venues with contrasting pricing models and
// distinct voices. Imported once at server start; safe to treat as readonly.
export const VENUES = venuesData as unknown as VenueListing[];

export function getVenue(id: string): VenueListing | undefined {
  return VENUES.find((v) => v.id === id);
}

export interface VenueSummary {
  id: string;
  name: string;
  tagline: string;
  neighborhood: string;
}

export function listVenueSummaries(): VenueSummary[] {
  return VENUES.map((v) => ({
    id: v.id,
    name: v.name,
    tagline: v.tagline,
    neighborhood: v.neighborhood,
  }));
}
