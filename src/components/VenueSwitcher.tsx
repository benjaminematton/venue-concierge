"use client";

import { ChevronDown } from "lucide-react";
import type { VenueSummary } from "@/lib/pricing/types";

interface VenueSwitcherProps {
  venues: VenueSummary[];
  selectedId: string;
  onChange: (id: string) => void;
}

// Editorial selector: no chunky dropdown chrome. A tracked-out "SPEAKING
// WITH" label sits above a large italic display-serif venue name; the
// native <select> overlays everything and is fully transparent. Click
// the name and the OS picker opens.
export function VenueSwitcher({
  venues,
  selectedId,
  onChange,
}: VenueSwitcherProps) {
  const selected = venues.find((v) => v.id === selectedId);
  return (
    <div className="relative">
      <div className="font-sans text-[10px] uppercase tracking-[0.28em] text-ink-faint">
        Speaking with
      </div>
      <div className="relative mt-2 flex items-end gap-2 border-b border-rule pb-2">
        <span className="font-display text-[26px] font-medium italic leading-[1.05] tracking-tight text-ink">
          {selected?.name ?? "Select venue"}
        </span>
        <ChevronDown
          aria-hidden
          className="mb-1 size-4 shrink-0 text-ink-faint transition group-focus-within:text-accent"
        />
        <select
          value={selectedId}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Switch venue"
          className="absolute inset-0 cursor-pointer appearance-none bg-transparent text-transparent opacity-0 focus:outline-none"
        >
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} — {v.neighborhood}
            </option>
          ))}
        </select>
      </div>
      {selected && (
        <p className="mt-2 font-sans text-xs italic text-ink-soft">
          {selected.tagline}
        </p>
      )}
    </div>
  );
}
