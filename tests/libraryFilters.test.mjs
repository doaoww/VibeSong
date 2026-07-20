import assert from "node:assert/strict";
import { test } from "node:test";
import { filterSongs } from "../lib/libraryFilters.ts";

function track(overrides = {}) {
  return {
    title: "T",
    artist: "A",
    reason: "",
    matchScore: 90,
    thumbnail: "",
    ...overrides,
  };
}

test("filterSongs 'All' returns every song unchanged", () => {
  const songs = [track({ title: "a" }), track({ title: "b" })];
  assert.deepEqual(filterSongs(songs, "All"), songs);
});

test("filterSongs 'This Week' keeps only songs saved in the last 7 days", () => {
  const now = Date.now();
  const recent = track({ title: "recent", savedAt: now - 1000 });
  const old = track({ title: "old", savedAt: now - 8 * 24 * 60 * 60 * 1000 });
  const noDate = track({ title: "no-date" });
  assert.deepEqual(filterSongs([recent, old, noDate], "This Week"), [recent]);
});

test("filterSongs 'Moody'/'Hype' currently pass every song through unchanged", () => {
  const songs = [track({ title: "a" }), track({ title: "b" })];
  assert.deepEqual(filterSongs(songs, "Moody"), songs);
  assert.deepEqual(filterSongs(songs, "Hype"), songs);
});
