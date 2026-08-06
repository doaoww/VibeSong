import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadTsModule(path) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  const cjsModule = { exports: {} };
  const context = vm.createContext({
    exports: cjsModule.exports,
    module: cjsModule,
    require,
    console,
    process,
    URLSearchParams,
  });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}

const itunes = loadTsModule("lib/itunes.ts");

test("selectBestItunesResult prefers title and artist overlap with a preview URL", () => {
  const result = itunes.selectBestItunesResult("Frank Ocean", "Rushes", [
    {
      trackName: "Rushes To",
      artistName: "Frank Ocean",
      previewUrl: "https://audio.example/wrong.m4a",
      artworkUrl100: "https://image.example/wrong.jpg",
      trackViewUrl: "https://music.example/wrong",
    },
    {
      trackName: "Rushes",
      artistName: "Frank Ocean",
      previewUrl: "https://audio.example/right.m4a",
      artworkUrl100: "https://image.example/right.jpg",
      trackViewUrl: "https://music.example/right",
    },
    {
      trackName: "Rushes",
      artistName: "Someone Else",
      previewUrl: "https://audio.example/other.m4a",
      artworkUrl100: "https://image.example/other.jpg",
      trackViewUrl: "https://music.example/other",
    },
  ]);

  assert.equal(result?.trackName, "Rushes");
  assert.equal(result?.artistName, "Frank Ocean");
  assert.equal(result?.previewUrl, "https://audio.example/right.m4a");
});

test("selectBestItunesResult rejects a same-title result whose artist doesn't match at all (karaoke/instrumental-library cover)", () => {
  // Reproduces the "Cologne (Instrumental Version) [Originally Performed by
  // Beabadoobee]" bug: a backing-track-library result whose title contains
  // every word of the real title scores titleScore=1.0 (full overlap) even
  // though its artist has nothing to do with the real one. That alone was
  // enough to clear the >=2 acceptance threshold (1.0*5 = 5) with zero
  // artist match, so it won the "best result" slot whenever the real
  // official track wasn't in the top 5 iTunes search results.
  const result = itunes.selectBestItunesResult("beabadoobee", "Cologne", [
    {
      trackName: "Cologne (Instrumental Version) [Originally Performed by Beabadoobee]",
      artistName: "Vibe Tracks Karaoke",
      previewUrl: "https://audio.example/wrong.m4a",
      artworkUrl100: "https://image.example/wrong.jpg",
      trackViewUrl: "https://music.example/wrong",
    },
  ]);

  assert.equal(result, null);
});

test("selectBestItunesResult still finds the real track among wrong-artist covers", () => {
  const result = itunes.selectBestItunesResult("beabadoobee", "Cologne", [
    {
      trackName: "Cologne (Instrumental Version) [Originally Performed by Beabadoobee]",
      artistName: "Vibe Tracks Karaoke",
      previewUrl: "https://audio.example/wrong.m4a",
      artworkUrl100: "https://image.example/wrong.jpg",
      trackViewUrl: "https://music.example/wrong",
    },
    {
      trackName: "Cologne",
      artistName: "beabadoobee",
      previewUrl: "https://audio.example/right.m4a",
      artworkUrl100: "https://image.example/right.jpg",
      trackViewUrl: "https://music.example/right",
    },
  ]);

  assert.equal(result?.previewUrl, "https://audio.example/right.m4a");
});

test("selectBestItunesResult ignores results without previews", () => {
  const result = itunes.selectBestItunesResult("SZA", "Good Days", [
    {
      trackName: "Good Days",
      artistName: "SZA",
      artworkUrl100: "https://image.example/art.jpg",
      trackViewUrl: "https://music.example/track",
    },
  ]);

  assert.equal(result, null);
});
