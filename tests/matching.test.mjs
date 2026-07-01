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

const matching = loadTsModule("lib/matching.ts");

test("normalizeTaste upgrades old taste objects with balanced defaults", () => {
  const taste = matching.normalizeTaste({
    genres: ["Hip-Hop / R&B"],
    favoriteArtists: ["Frank Ocean"],
    defaultMood: "Chill & Melancholic",
    setupComplete: true,
  });

  assert.deepEqual(Array.from(taste.genres), ["Hip-Hop / R&B"]);
  assert.deepEqual(Array.from(taste.favoriteArtists), ["Frank Ocean"]);
  assert.equal(taste.discoveryStyle, "balanced");
  assert.deepEqual(Array.from(taste.dislikes), []);
  assert.equal(taste.languagePreference, "No preference");
  assert.equal(taste.energyPreference, "depends");
});

test("normalizeCandidateScores calculates balanced final scores and orders candidates", () => {
  const [first, second] = matching.normalizeCandidateScores(
    [
      {
        title: "Obvious Hit",
        artist: "Famous Artist",
        reason: "fits",
        photoFitScore: 96,
        tasteFitScore: 92,
        discoveryFitScore: 50,
        obviousnessPenalty: 18,
      },
      {
        title: "Hidden Gem",
        artist: "Famous Artist",
        reason: "fits better",
        photoFitScore: 91,
        tasteFitScore: 90,
        discoveryFitScore: 88,
        obviousnessPenalty: 2,
      },
    ],
    "hidden-gems"
  );

  assert.equal(first.title, "Hidden Gem");
  assert.equal(second.title, "Obvious Hit");
  assert.ok(first.finalScore > second.finalScore);
  assert.equal(first.matchScore, Math.round(first.finalScore));
});

test("applyAvoidPenalties bumps an avoided artist's obviousnessPenalty", () => {
  const [track] = matching.applyAvoidPenalties(
    [
      {
        title: "Song",
        artist: "Skipped Artist",
        reason: "fits",
        obviousnessPenalty: 2,
      },
    ],
    { avoidArtists: ["Skipped Artist"], avoidGenres: [], dislikes: [] }
  );

  assert.equal(track.obviousnessPenalty, 35);
});

test("applyAvoidPenalties bumps a track whose genre overlaps an avoided genre", () => {
  const [track] = matching.applyAvoidPenalties(
    [
      {
        title: "Song",
        artist: "Some Artist",
        reason: "fits",
        genres: ["EDM", "house"],
      },
    ],
    { avoidArtists: [], avoidGenres: ["edm"], dislikes: [] }
  );

  assert.equal(track.obviousnessPenalty, 28);
});

test("applyAvoidPenalties bumps a track matching a quiz dislike phrase", () => {
  const [track] = matching.applyAvoidPenalties(
    [
      {
        title: "Song",
        artist: "Some Artist",
        reason: "fits",
        genres: ["aggressive trap"],
      },
    ],
    { avoidArtists: [], avoidGenres: [], dislikes: ["Aggressive trap"] }
  );

  assert.equal(track.obviousnessPenalty, 28);
});

test("applyAvoidPenalties leaves unrelated tracks untouched", () => {
  const [track] = matching.applyAvoidPenalties(
    [
      {
        title: "Song",
        artist: "Liked Artist",
        reason: "fits",
        genres: ["dream pop"],
        obviousnessPenalty: 3,
      },
    ],
    { avoidArtists: ["Skipped Artist"], avoidGenres: ["edm"], dislikes: ["Aggressive trap"] }
  );

  assert.equal(track.obviousnessPenalty, 3);
});

test("applyLanguagePenalty is a no-op for 'No preference' and 'Global mix'", () => {
  const tracks = [{ title: "Song", artist: "Artist", reason: "fits", language: "Korean" }];

  assert.deepEqual(
    matching.applyLanguagePenalty(tracks, "No preference"),
    tracks
  );
  assert.deepEqual(
    matching.applyLanguagePenalty(tracks, "Global mix"),
    tracks
  );
});

test("applyLanguagePenalty penalizes a track whose language doesn't match the preference", () => {
  const [track] = matching.applyLanguagePenalty(
    [{ title: "Song", artist: "Artist", reason: "fits", language: "English" }],
    "Korean"
  );

  assert.equal(track.obviousnessPenalty, 22);
});

test("applyLanguagePenalty leaves a matching language untouched", () => {
  const [track] = matching.applyLanguagePenalty(
    [{ title: "Song", artist: "Artist", reason: "fits", language: "Korean", obviousnessPenalty: 3 }],
    "Korean / K-Pop"
  );

  assert.equal(track.obviousnessPenalty, 3);
});

test("applyLanguagePenalty never penalizes instrumental tracks", () => {
  const [track] = matching.applyLanguagePenalty(
    [{ title: "Song", artist: "Artist", reason: "fits", language: "Instrumental", obviousnessPenalty: 1 }],
    "Russian"
  );

  assert.equal(track.obviousnessPenalty, 1);
});

test("scoreResolvedTrack rewards iTunes preview quality without changing identity", () => {
  const scored = matching.scoreResolvedTrack(
    {
      title: "Rushes",
      artist: "Frank Ocean",
      reason: "slow emotional build",
      matchScore: 86,
      finalScore: 86,
      photoFitScore: 90,
      tasteFitScore: 88,
      discoveryFitScore: 80,
      obviousnessPenalty: 1,
      previewUrl: "https://audio.example/preview.m4a",
      previewProvider: "itunes",
      thumbnail: "https://image.example/art.jpg",
    },
    "balanced"
  );

  assert.equal(scored.title, "Rushes");
  assert.equal(scored.previewProvider, "itunes");
  assert.ok(scored.finalScore > 86);
});
