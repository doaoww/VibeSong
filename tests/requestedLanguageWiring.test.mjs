import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("the client forwards vibeIntent from the analyze call to the recommend call", async () => {
  const source = await readFile(new URL("../app/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /vibeIntent:\s*vibeIntentText\.trim\(\),[\s\S]*?vibeBoosts:\s*\{\},/);
});

test("/api/recommend extracts a requested language from vibeIntent and prioritizes it over stored taste.languages", async () => {
  const source = await readFile(new URL("../app/api/recommend/route.ts", import.meta.url), "utf8");

  assert.match(source, /const requestedLanguage = extractRequestedLanguage\(body\.vibeIntent\)/);
  assert.match(source, /const languages = requestedLanguage \? \[requestedLanguage\] : taste\.languages/);
  assert.match(source, /const languageOpenness = requestedLanguage \? "strict" : taste\.languageOpenness/);
  // Both the dedicated language-vector pool and the request handed to
  // buildRecommendations must use the override, not the raw taste value —
  // otherwise the override would compute but never actually reach retrieval.
  assert.match(source, /searchCatalogByLanguage\(languages, queryVector, 25\)/);
  assert.match(source, /const baseRecommendReq = \{[\s\S]*?\n\s*languages,\n\s*languageOpenness,\n/);
});
