import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("matches page filters saved songs to only those with a source photo", async () => {
  const source = await readFile(new URL("../app/matches/page.tsx", import.meta.url), "utf8");
  assert.match(source, /savedSongs\.filter\(\(s\) => Boolean\(s\.sourceImage\)\)/);
  assert.match(source, /t\.matches\.heading/);
  assert.match(source, /ShareSheet/);
});

test("profile 'view all' under My Matches links to /matches, not /library", async () => {
  const source = await readFile(new URL("../app/profile/page.tsx", import.meta.url), "utf8");
  assert.match(source, /myMatchesHeading[\s\S]{0,400}href="\/matches"/);
});
