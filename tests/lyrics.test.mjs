import assert from "node:assert/strict";
import { test } from "node:test";

const { NullLyricsProvider } = await import("../lib/lyrics.ts");

test("NullLyricsProvider.fetchLyrics always resolves to null", async () => {
  const provider = new NullLyricsProvider();
  const result = await provider.fetchLyrics("Any Song", "Any Artist");
  assert.equal(result, null);
});
