import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("/api/analyze includes presentationRead in its response", async () => {
  const source = await readFile(new URL("../app/api/analyze/route.ts", import.meta.url), "utf8");

  assert.match(source, /const presentationRead = coercePovSignal\(result\.presentationRead\)/);
  assert.match(source, /return NextResponse\.json\(\{[\s\S]*?\n\s*presentationRead,\s*\n\s*\}\);/);
});

test("the client forwards presentationRead from analyze to recommend", async () => {
  const source = await readFile(new URL("../app/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /presentationRead:\s*vibeData\.presentationRead,/);
});

test("/api/recommend reads and coerces presentationRead into the recommend request", async () => {
  const source = await readFile(new URL("../app/api/recommend/route.ts", import.meta.url), "utf8");

  assert.match(source, /const presentationRead = coercePovSignal\(body\.presentationRead\)/);
  assert.match(source, /const baseRecommendReq = \{[\s\S]*?\n\s*presentationRead,\s*\n/);
});
