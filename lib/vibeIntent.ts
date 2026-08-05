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

// Mirrors components/onboarding/LanguageStep.tsx's LANGUAGES — the closed
// list of language values the catalog's `language` column and taste.languages
// actually filter on. Keys are canonical catalog language names; values are
// lowercase English + Russian aliases a user might type in the free-text vibe
// box ("french vibe", "французский вайб", "give me some k-pop").
const REQUESTED_LANGUAGE_ALIASES: Record<string, string[]> = {
  Russian: ["russian", "russia", "русск", "россия"],
  English: ["english", "англ"],
  Korean: ["korean", "korea", "k-pop", "kpop", "корейск"],
  Spanish: ["spanish", "spain", "latin", "испанск", "латино"],
  Arabic: ["arabic", "arab", "арабск"],
  French: ["french", "france", "français", "francais", "франц"],
  Turkish: ["turkish", "turkey", "турецк"],
  Uzbek: ["uzbek", "uzbekistan", "узбекск"],
  Hindi: ["hindi", "bollywood", "хинди"],
  Japanese: ["japanese", "japan", "j-pop", "jpop", "японск"],
  Kazakh: ["kazakh", "kazakhstan", "казахск"],
};

/**
 * Deterministic keyword match against the catalog's closed language list —
 * deliberately NOT a GPT call. An explicit "give me a French vibe" request
 * needs to reliably become a hard language filter; folding that into the
 * already-large vision-analysis JSON schema and hoping GPT notices it inside
 * a loose "weight this heavily" prose block is the exact pipeline gap that
 * caused this class of bug (the request never reaches the language filter,
 * which only ever reads from the user's stored onboarding preference). A
 * plain, testable string match closes that gap without depending on
 * unverified model behavior.
 */
export function extractRequestedLanguage(raw: unknown): string | null {
  const cleaned = sanitizeVibeIntent(raw).toLowerCase();
  if (!cleaned) return null;
  for (const [language, aliases] of Object.entries(REQUESTED_LANGUAGE_ALIASES)) {
    if (aliases.some((alias) => cleaned.includes(alias))) return language;
  }
  return null;
}
