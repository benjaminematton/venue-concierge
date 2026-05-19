"use client";

import { ChevronDown } from "lucide-react";
import type { VenueSummary } from "@/lib/pricing/types";

interface VenueSwitcherProps {
  venues: VenueSummary[];
  selectedId: string;
  onChange: (id: string) => void;
}

export function VenueSwitcher({
  venues,
  selectedId,
  onChange,
}: VenueSwitcherProps) {
  const selected = venues.find((v) => v.id === selectedId);
  return (
    <div>
      <label className="group relative block">
        <span className="sr-only">Switch venue</span>
        <select
          value={selectedId}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-zinc-200 bg-white py-2.5 pl-4 pr-10 text-left text-sm font-medium text-zinc-900 shadow-sm transition focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-600 dark:focus:ring-zinc-800"
        >
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} · {v.neighborhood}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500 transition group-focus-within:text-zinc-900 dark:text-zinc-400 dark:group-focus-within:text-zinc-100"
        />
      </label>
      {selected && (
        <p className="mt-1.5 px-1 text-xs text-zinc-500 dark:text-zinc-400">
          {selected.tagline}
        </p>
      )}
    </div>
  );
}
