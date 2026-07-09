import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const baseRequire = createRequire(import.meta.url);
const ts = baseRequire("typescript");

class StubDuplicateSongError extends Error {}

const stubState = {
  fetchImpl: (..._args) => {
    throw new Error("fetch not stubbed for this test");
  },
  autoTagSong: async (title, artist) => ({ title, artist }),
  findSongByTitleArtist: async () => null,
  insertSong: async (data) => ({ id: `id-${data.title}` }),
};

function stubRequire(id) {
  if (id.includes("autoTag")) {
    return { autoTagSong: (...args) => stubState.autoTagSong(...args) };
  }
  if (id.includes("db/songs")) {
    return {
      findSongByTitleArtist: (...args) => stubState.findSongByTitleArtist(...args),
      insertSong: (...args) => stubState.insertSong(...args),
      DuplicateSongError: StubDuplicateSongError,
    };
  }
  return baseRequire(id);
}

function loadTsModule(path) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const cjsModule = { exports: {} };
  const context = vm.createContext({
    exports: cjsModule.exports,
    module: cjsModule,
    require: stubRequire,
    console,
    process,
    setTimeout,
    fetch: (...args) => stubState.fetchImpl(...args),
  });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}

const plain = (value) => JSON.parse(JSON.stringify(value));

const curator = loadTsModule("lib/curator.ts");

function jsonResponse(data, ok = true, status = 200) {
  return { ok, status, async json() { return data; } };
}

test("TRENDING_COUNTRIES matches the language spread used by existing seed scripts", () => {
  assert.deepEqual(plain(curator.TRENDING_COUNTRIES), ["us", "ru", "fr", "es", "gb"]);
});

test("MAX_NEW_SONGS_PER_RUN caps daily GPT spend", () => {
  assert.equal(curator.MAX_NEW_SONGS_PER_RUN, 15);
});

test("fetchTrendingTracks maps Apple feed results into {title, artist} pairs", async () => {
  stubState.fetchImpl = async (url) => {
    assert.ok(url.includes("/us/music/most-played/"));
    return jsonResponse({
      feed: {
        results: [
          { name: "Janice STFU", artistName: "Drake" },
          { name: "Choosin' Texas", artistName: "Ella Langley" },
        ],
      },
    });
  };

  const candidates = await curator.fetchTrendingTracks("us");
  assert.deepEqual(plain(candidates), [
    { title: "Janice STFU", artist: "Drake" },
    { title: "Choosin' Texas", artist: "Ella Langley" },
  ]);
});

test("fetchTrendingTracks caps results at 25 even if the feed returns more", async () => {
  const results = Array.from({ length: 50 }, (_, i) => ({ name: `Song ${i}`, artistName: `Artist ${i}` }));
  stubState.fetchImpl = async () => jsonResponse({ feed: { results } });

  const candidates = await curator.fetchTrendingTracks("us");
  assert.equal(candidates.length, 25);
});

test("fetchTrendingTracks throws a descriptive error on a non-ok response", async () => {
  stubState.fetchImpl = async () => jsonResponse({}, false, 503);
  await assert.rejects(() => curator.fetchTrendingTracks("us"), /fetchTrendingTracks failed for us: 503/);
});

function candidateResult(title, artist) {
  return { name: title, artistName: artist };
}

test("curateCatalog stops inserting once MAX_NEW_SONGS_PER_RUN is reached", async () => {
  const many = Array.from({ length: 20 }, (_, i) => candidateResult(`Song ${i}`, `Artist ${i}`));
  stubState.fetchImpl = async (url) => {
    if (url.includes("/us/")) return jsonResponse({ feed: { results: many } });
    return jsonResponse({ feed: { results: [] } });
  };
  stubState.findSongByTitleArtist = async () => null;
  let taggedCount = 0;
  stubState.autoTagSong = async (title, artist) => {
    taggedCount += 1;
    return { title, artist };
  };
  stubState.insertSong = async (data) => ({ id: `id-${data.title}` });

  const result = await curator.curateCatalog({ minIntervalMs: 0 });
  assert.equal(result.inserted.length, curator.MAX_NEW_SONGS_PER_RUN);
  assert.equal(taggedCount, curator.MAX_NEW_SONGS_PER_RUN);
});

test("curateCatalog skips existing songs without calling autoTagSong", async () => {
  stubState.fetchImpl = async (url) => {
    if (url.includes("/us/")) {
      return jsonResponse({ feed: { results: [candidateResult("Existing Song", "Existing Artist")] } });
    }
    return jsonResponse({ feed: { results: [] } });
  };
  stubState.findSongByTitleArtist = async (title, artist) => {
    if (title === "Existing Song" && artist === "Existing Artist") {
      return { id: "already-there", title, artist };
    }
    return null;
  };
  let taggedCount = 0;
  stubState.autoTagSong = async (title, artist) => {
    taggedCount += 1;
    return { title, artist };
  };

  const result = await curator.curateCatalog({ minIntervalMs: 0 });
  assert.equal(result.skipped, 1);
  assert.equal(result.inserted.length, 0);
  assert.equal(taggedCount, 0, "autoTagSong should never be called for a candidate already in the catalog");
});

test("curateCatalog records a failed candidate and continues with the rest", async () => {
  stubState.fetchImpl = async (url) => {
    if (url.includes("/us/")) {
      return jsonResponse({
        feed: { results: [candidateResult("Broken Song", "Broken Artist"), candidateResult("Fine Song", "Fine Artist")] },
      });
    }
    return jsonResponse({ feed: { results: [] } });
  };
  stubState.findSongByTitleArtist = async () => null;
  stubState.autoTagSong = async (title, artist) => {
    if (title === "Broken Song") throw new Error("iTunes lookup failed");
    return { title, artist };
  };
  stubState.insertSong = async (data) => ({ id: `id-${data.title}` });

  const result = await curator.curateCatalog({ minIntervalMs: 0 });
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].title, "Broken Song");
  assert.match(result.failed[0].error, /iTunes lookup failed/);
  assert.equal(result.inserted.length, 1);
  assert.equal(result.inserted[0].title, "Fine Song");
});

test("curateCatalog counts a DuplicateSongError from insertSong as skipped, not failed", async () => {
  stubState.fetchImpl = async (url) => {
    if (url.includes("/us/")) {
      return jsonResponse({ feed: { results: [candidateResult("Chart Display Name (feat. Someone)", "Some Artist")] } });
    }
    return jsonResponse({ feed: { results: [] } });
  };
  stubState.findSongByTitleArtist = async () => null; // raw chart string doesn't match the already-stored canonical string
  let taggedCount = 0;
  stubState.autoTagSong = async () => {
    taggedCount += 1;
    return { title: "Canonical Song Name", artist: "Some Artist" }; // autoTagSong rewrote it to the canonical form
  };
  stubState.insertSong = async () => {
    throw new StubDuplicateSongError('"Canonical Song Name" by "Some Artist" is already in the catalog');
  };

  const result = await curator.curateCatalog({ minIntervalMs: 0 });
  assert.equal(result.skipped, 1, "a duplicate-key error from insertSong should count as skipped");
  assert.equal(result.failed.length, 0, "a duplicate should not be reported as a failure");
  assert.equal(taggedCount, 1, "autoTagSong still runs before the duplicate is discovered — this documents the known cost, not something this fix addresses");
});

test("curateCatalog skips a needs_review candidate without inserting it", async () => {
  stubState.fetchImpl = async (url) => {
    if (url.includes("/us/")) {
      return jsonResponse({ feed: { results: [candidateResult("Obscure Song", "Unknown Artist")] } });
    }
    return jsonResponse({ feed: { results: [] } });
  };
  stubState.findSongByTitleArtist = async () => null;
  let taggedCount = 0;
  stubState.autoTagSong = async (title, artist) => {
    taggedCount += 1;
    return { title, artist, needs_review: true, final_confidence: 0.25 };
  };
  let insertCalled = false;
  stubState.insertSong = async (data) => {
    insertCalled = true;
    return { id: `id-${data.title}` };
  };

  const result = await curator.curateCatalog({ minIntervalMs: 0 });
  assert.equal(result.skipped, 1, "a needs_review candidate should count as skipped");
  assert.equal(result.inserted.length, 0, "a needs_review candidate must not be inserted");
  assert.equal(result.failed.length, 0, "a needs_review candidate is not an error");
  assert.equal(taggedCount, 1, "autoTagSong still runs — the gate applies after tagging, not before");
  assert.equal(insertCalled, false, "insertSong must never be called for a needs_review candidate");
});

test("curateCatalog continues with remaining countries if one country's feed fetch fails", async () => {
  stubState.fetchImpl = async (url) => {
    if (url.includes("/us/")) throw new Error("network error");
    if (url.includes("/ru/")) {
      return jsonResponse({ feed: { results: [candidateResult("Russian Hit", "Russian Artist")] } });
    }
    return jsonResponse({ feed: { results: [] } });
  };
  stubState.findSongByTitleArtist = async () => null;
  stubState.autoTagSong = async (title, artist) => ({ title, artist });
  stubState.insertSong = async (data) => ({ id: `id-${data.title}` });

  const result = await curator.curateCatalog({ minIntervalMs: 0 });
  assert.equal(result.inserted.length, 1);
  assert.equal(result.inserted[0].title, "Russian Hit");
});

test("curateCatalog throttles calls that reach autoTagSong to at least minIntervalMs apart", async () => {
  // Helper to create a real delay in the stub (simulates slow autoTagSong)
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // SCENARIO 1: Slow autoTagSong (60ms) with minIntervalMs 50 → proves no flat delay stacked on top
  {
    stubState.fetchImpl = async (url) => {
      if (url.includes("/us/")) {
        return jsonResponse({ feed: { results: [candidateResult("Song One", "Artist One"), candidateResult("Song Two", "Artist Two")] } });
      }
      return jsonResponse({ feed: { results: [] } });
    };
    stubState.findSongByTitleArtist = async () => null;
    const callTimestamps = [];
    // Make the stub itself take 60ms (longer than the 50ms throttle floor).
    // With correct floor logic: elapsed (60ms) >= minIntervalMs (50ms), so wait = 0, gap ≈ 60ms.
    // With flat delay bug: gap would be 60ms (stub) + 50ms (flat sleep) ≈ 110ms minimum.
    // This test discriminates between the two by asserting gap < 100ms.
    stubState.autoTagSong = async (title, artist) => {
      await sleep(60);
      callTimestamps.push(Date.now());
      return { title, artist };
    };
    stubState.insertSong = async (data) => ({ id: `id-${data.title}` });

    await curator.curateCatalog({ minIntervalMs: 50 });
    assert.equal(callTimestamps.length, 2);
    const gap = callTimestamps[1] - callTimestamps[0];
    assert.ok(gap < 100, `gap of ${gap}ms should be ~60ms (correct elapsed-aware floor), not ~110ms (flat delay bug)`);
  }

  // SCENARIO 2: Fast autoTagSong (~0ms) with minIntervalMs 50 → proves throttle wait actually happens
  {
    stubState.fetchImpl = async (url) => {
      if (url.includes("/us/")) {
        return jsonResponse({ feed: { results: [candidateResult("Fast Song One", "Artist One"), candidateResult("Fast Song Two", "Artist Two")] } });
      }
      return jsonResponse({ feed: { results: [] } });
    };
    stubState.findSongByTitleArtist = async () => null;
    const callTimestamps = [];
    // Make the stub near-instant (no artificial delay).
    // With correct throttle: elapsed ≈ 0-5ms, so wait ≈ 45-50ms, gap ≈ 45-55ms.
    // If throttle wait is removed: elapsed ≈ 0-5ms, gap ≈ 0-5ms.
    // This test catches "throttle was deleted" by asserting gap >= 45ms.
    stubState.autoTagSong = async (title, artist) => {
      callTimestamps.push(Date.now());
      return { title, artist };
    };
    stubState.insertSong = async (data) => ({ id: `id-${data.title}` });

    await curator.curateCatalog({ minIntervalMs: 50 });
    assert.equal(callTimestamps.length, 2);
    const gap = callTimestamps[1] - callTimestamps[0];
    assert.ok(gap >= 45, `gap of ${gap}ms should be ~50ms (throttle active), not ~0-5ms (throttle deleted or broken)`);
  }
});
