export type Restraint = "understated" | "balanced" | "expressive";

export interface MusicSupervisorBrief {
  narrative: string;
  emotionalSubtext: string;
  restraint: Restraint;
  context: string;
  direction: string;
  avoid: string;
}

const RESTRAINT_VALUES: Set<string> = new Set(["understated", "balanced", "expressive"]);
const MAX_FIELD_LENGTH = 300;

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_FIELD_LENGTH);
}

function parseRestraint(value: unknown): Restraint {
  return typeof value === "string" && RESTRAINT_VALUES.has(value) ? (value as Restraint) : "balanced";
}

/**
 * Validates GPT's structured music-supervisor brief — used identically on
 * the photo side (app/api/analyze/route.ts) and the song side
 * (lib/autoTag.ts) so both sides produce the same shape before embedding.
 */
export function parseMusicSupervisorBrief(raw: unknown): MusicSupervisorBrief {
  if (!raw || typeof raw !== "object") {
    return { narrative: "", emotionalSubtext: "", restraint: "balanced", context: "", direction: "", avoid: "" };
  }
  const obj = raw as Record<string, unknown>;
  return {
    narrative: cleanText(obj.narrative),
    emotionalSubtext: cleanText(obj.emotionalSubtext),
    restraint: parseRestraint(obj.restraint),
    context: cleanText(obj.context),
    direction: cleanText(obj.direction),
    avoid: cleanText(obj.avoid),
  };
}

/**
 * Deterministic template turning a brief into the text that gets embedded.
 * `avoid` is deliberately excluded — text embeddings handle negation
 * unreliably, so folding "avoid: X" into this text risks attracting X
 * instead of repelling it (see the v3 spec's Risk Review §2).
 */
export function buildBriefText(brief: MusicSupervisorBrief): string {
  return `${brief.narrative} ${brief.emotionalSubtext} Restraint: ${brief.restraint}. ${brief.context} ${brief.direction}`.trim();
}
