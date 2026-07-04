import { en } from "./en.ts";
import { ru as ruOverrides } from "./ru.ts";

export type Locale = "en" | "ru";

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Recursively overlays `override` onto `base`, key by key. `ru.ts` is already
 * type-checked to fully match `en`'s shape at compile time (see ru.ts) — this
 * merge is a runtime safety net in case that guarantee is ever weakened later
 * (e.g. a key built dynamically in a way TS can't fully verify), so a missing
 * Russian key falls back to English at runtime instead of rendering `undefined`.
 */
export function deepMerge<T extends PlainObject>(base: T, override: PlainObject): T {
  const result: PlainObject = { ...base };
  for (const key of Object.keys(override)) {
    const overrideValue = override[key];
    const baseValue = base[key];
    if (isPlainObject(overrideValue) && isPlainObject(baseValue)) {
      result[key] = deepMerge(baseValue, overrideValue);
    } else if (overrideValue !== undefined) {
      result[key] = overrideValue;
    }
  }
  return result as T;
}

export const translations: Record<Locale, typeof en> = {
  en,
  ru: deepMerge(en, ruOverrides),
};
