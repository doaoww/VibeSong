const MAX_VIBE_INTENT_LENGTH = 120;

/**
 * Server-side safety net for the free-text "what vibe do you want" input —
 * the client already enforces a 120-char maxLength, this re-validates so a
 * malformed or hand-crafted request body can't inject an unbounded string
 * into the GPT-4o Vision prompt.
 */
export function sanitizeVibeIntent(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, MAX_VIBE_INTENT_LENGTH);
}
