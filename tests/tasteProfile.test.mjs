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

const tasteProfile = loadTsModule("lib/tasteProfile.ts");

function row(artist, genres = []) {
  return { artist, genres, title: "x", createdAt: "2026-01-01" };
}

test("buildAggregateTasteProfile ranks saved genres and artists by frequency", () => {
  const saved = [
    row("Frank Ocean", ["dream pop"]),
    row("Frank Ocean", ["dream pop"]),
    row("SZA", ["neo soul"]),
  ];
  const profile = tasteProfile.buildAggregateTasteProfile(saved, []);

  assert.deepEqual(Array.from(profile.learnedArtists).slice(0, 1), ["Frank Ocean"]);
  assert.ok(Array.from(profile.learnedGenres).includes("dream pop"));
  assert.deepEqual(Array.from(profile.avoidGenres), []);
  assert.deepEqual(Array.from(profile.avoidArtists), []);
});

test("buildAggregateTasteProfile flags a genre as avoid only past the threshold", () => {
  const skippedBelowThreshold = [row("A", ["edm"]), row("B", ["edm"])];
  const belowProfile = tasteProfile.buildAggregateTasteProfile([], skippedBelowThreshold);
  assert.deepEqual(Array.from(belowProfile.avoidGenres), []);

  const skippedAboveThreshold = [
    row("A", ["edm"]),
    row("B", ["edm"]),
    row("C", ["edm"]),
  ];
  const aboveProfile = tasteProfile.buildAggregateTasteProfile([], skippedAboveThreshold);
  assert.deepEqual(Array.from(aboveProfile.avoidGenres), ["edm"]);
});

test("buildAggregateTasteProfile does not avoid a genre that is also frequently saved", () => {
  const saved = [row("A", ["pop"]), row("B", ["pop"])];
  const skipped = [row("C", ["pop"]), row("D", ["pop"]), row("E", ["pop"])];
  const profile = tasteProfile.buildAggregateTasteProfile(saved, skipped);

  assert.deepEqual(Array.from(profile.avoidGenres), []);
});
