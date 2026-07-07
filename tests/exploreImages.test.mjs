import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const source = await readFile(new URL("../app/explore/page.tsx", import.meta.url), "utf8");

test("explore community cards render photo assets", () => {
  const expectedAssets = [
    "/landing/golden-hour.jpg",
    "/landing/blinding-lights.jpg",
    "/landing/happiness.jpg",
    "/landing/kill-bill.jpg",
  ];

  for (const asset of expectedAssets) {
    assert.match(source, new RegExp(asset.replaceAll("/", "\\/")));
  }

  assert.match(source, /<Image\s+[^>]*src=\{c\.image\}/s);
  assert.match(source, /fill/);
  assert.match(source, /sizes="\(min-width: 768px\) 33vw, 50vw"/);
  assert.match(source, /alt=\{`\$\{c\.song\} by \$\{c\.artist\}`\}/);
});
