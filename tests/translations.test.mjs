import assert from "node:assert/strict";
import { test } from "node:test";

const { deepMerge, translations } = await import("../lib/translations/index.ts");

test("deepMerge overlays nested keys without dropping siblings", () => {
  const base = { a: { x: 1, y: 2 }, b: 3 };
  const override = { a: { y: 20 } };
  assert.deepEqual(deepMerge(base, override), { a: { x: 1, y: 20 }, b: 3 });
});

test("deepMerge ignores undefined override values", () => {
  const base = { a: 1, b: 2 };
  const override = { a: undefined };
  assert.deepEqual(deepMerge(base, override), { a: 1, b: 2 });
});

test("deepMerge replaces functions wholesale instead of descending into them", () => {
  const base = { greet: (n) => `hi ${n}` };
  const override = { greet: (n) => `hey ${n}` };
  const merged = deepMerge(base, override);
  assert.equal(merged.greet(1), "hey 1");
});

test("en and ru dictionaries expose identical top-level namespaces", () => {
  assert.deepEqual(Object.keys(translations.en).sort(), Object.keys(translations.ru).sort());
});

test("en and ru common namespace has identical keys", () => {
  assert.deepEqual(
    Object.keys(translations.en.common).sort(),
    Object.keys(translations.ru.common).sort()
  );
});
