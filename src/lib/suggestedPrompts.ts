// Empty-state prompt chips, keyed by venueId. Three per venue, hand-curated
// to (a) read like a real customer's first message, not a placeholder, and
// (b) exercise different agent paths — a complete request, a vague question,
// an availability poke. Lives next to the data rather than the component so
// the chip copy can sit next to venue context if it grows.

const PROMPTS: Record<string, string[]> = {
  "the-quail": [
    "Hi! 25 people on Monday June 15, 2026 at 7pm — what's the back room look like?",
    "How does your F&B minimum work on a Friday?",
    "Do you handle dietary restrictions for a group?",
  ],
  "upper-floor": [
    "Looking to host a 60-person cocktail party on Friday October 16, 2026 at 7pm.",
    "Can we bring our own DJ?",
    "What's included in the buyout?",
  ],
  "maison-vert": [
    "Anniversary dinner for 14 in the cellar — any Saturday in September?",
    "What's the tasting menu?",
    "Can we tour the salon?",
  ],
};

export function suggestedPromptsFor(venueId: string): string[] {
  return PROMPTS[venueId] ?? [];
}
