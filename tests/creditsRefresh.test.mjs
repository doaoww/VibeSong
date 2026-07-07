import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const useCreditsSource = await readFile(
  new URL("../lib/useCredits.ts", import.meta.url),
  "utf8"
);
const pricingModalSource = await readFile(
  new URL("../components/PricingModal.tsx", import.meta.url),
  "utf8"
);
const appPageSource = await readFile(
  new URL("../app/app/page.tsx", import.meta.url),
  "utf8"
);
const creditsRouteSource = await readFile(
  new URL("../app/api/credits/route.ts", import.meta.url),
  "utf8"
);

test("credits API responses and client refresh bypass stale cache", () => {
  assert.match(useCreditsSource, /fetch\("\/api\/credits",\s*\{\s*cache:\s*"no-store"/s);
  assert.match(creditsRouteSource, /Cache-Control/);
  assert.match(creditsRouteSource, /no-store/);
});

test("pricing modal refreshes the server credit balance whenever it opens", () => {
  assert.match(pricingModalSource, /onRefreshCredits/);
  assert.match(pricingModalSource, /useEffect\(\(\)\s*=>\s*\{[\s\S]*if \(!isOpen\) return;[\s\S]*void onRefreshCredits\(\);/);
  assert.match(appPageSource, /onRefreshCredits=\{refresh\}/);
});
