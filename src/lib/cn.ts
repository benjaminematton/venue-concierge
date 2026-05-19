// Minimal class-name joiner. Falsy values are dropped so callers can pass
// `condition && "class"` inline without producing "false" tokens.
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
