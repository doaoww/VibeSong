import { strict as assert } from "node:assert";
import { test } from "node:test";

test("getSimilarTracks returns normalized list", async () => {
  // Mock global fetch
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      similartracks: {
        track: [
          { name: "Song A", artist: { name: "Artist A" } },
          { name: "Song B", artist: { name: "Artist B" } },
        ],
      },
    }),
  });
  process.env.LASTFM_API_KEY = "test_key";

  const { getSimilarTracks } = await import("../lib/lastfm.ts");
  const result = await getSimilarTracks("Test Song", "Test Artist", 5);
  assert.equal(result.length, 2);
  assert.equal(result[0].title, "Song A");
  assert.equal(result[0].artist, "Artist A");
});

test("getSimilarTracks returns empty array on API error", async () => {
  global.fetch = async () => ({ ok: false, json: async () => ({}) });
  process.env.LASTFM_API_KEY = "test_key";

  const { getSimilarTracks } = await import("../lib/lastfm.ts");
  const result = await getSimilarTracks("X", "Y");
  assert.deepEqual(result, []);
});

test("getSimilarTracks returns empty array when API key missing", async () => {
  delete process.env.LASTFM_API_KEY;
  const { getSimilarTracks } = await import("../lib/lastfm.ts");
  const result = await getSimilarTracks("X", "Y");
  assert.deepEqual(result, []);
  process.env.LASTFM_API_KEY = "test_key"; // restore
});
