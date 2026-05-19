"use client";

import { ChevronDown } from "lucide-react";
import type { VenueSummary } from "@/lib/pricing/types";

interface VenueSwitcherProps {
  venues: VenueSummary[];
  selectedId: string;
  onChange: (id: string) => void;
}

// The chevron + thin underline give the affordance; the native select
// sits transparent on top so the OS picker handles the open. No
// "SPEAKING WITH" label — the venue name as the largest type in the
// right column is enough context.
export function VenueSwitcher({
  venues,
  selectedId,
  onChange,
}: VenueSwitcherProps) {
  const selected = venues.find((v) => v.id === selectedId);
  return (
    <div>
      <div className="relative flex items-center gap-2 border-b border-rule pb-2">
        <span className="font-display text-[22px] font-medium leading-[1.1] tracking-tight text-ink">
          {selected?.name ?? "Select venue"}
        </span>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-ink-faint"
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
        <p className="mt-2 font-sans text-[13px] text-ink-soft">
          {selected.tagline}
        </p>
      )}
    </div>
  );
}
