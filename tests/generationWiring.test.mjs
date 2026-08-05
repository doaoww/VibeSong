import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("OnboardingFlow persists generation from AgeStep", async () => {
  const source = await readFile(new URL("../components/OnboardingFlow.tsx", import.meta.url), "utf8");

  assert.match(source, /const \[generation, setGeneration\] = useState<Generation>\("unclear"\)/);
  assert.match(source, /body:\s*JSON\.stringify\(\{[\s\S]*?generation,\s*\n/);
});

test("/api/recommend reads taste.generation into the recommend request as userGeneration", async () => {
  const source = await readFile(new URL("../app/api/recommend/route.ts", import.meta.url), "utf8");

  assert.match(source, /const baseRecommendReq = \{[\s\S]*?userGeneration: taste\.generation,\s*\n/);
});

test("lib/recommend.ts wires userGeneration and song_generation into computeGenerationPenalty", async () => {
  const source = await readFile(new URL("../lib/recommend.ts", import.meta.url), "utf8");

  assert.match(
    source,
    /const generationPenalty = computeGenerationPenalty\(req\.userGeneration, song\.song_generation \?\? "unclear"\)/
  );
  assert.match(source, /raw \+ languagePenalty \+ freshnessPenalty \+ mainstreamPenalty \+ needsReviewPenalty \+ softAntiTagPenalty \+ povPenalty \+ generationPenalty/);
});
