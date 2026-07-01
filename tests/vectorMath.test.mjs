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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const cjsModule = { exports: {} };
  // `require` here is bound relative to tests/, but the transpiled source's
  // relative imports (e.g. "./emotionalVector") are relative to the module's
  // own directory (lib/) — resolve those explicitly instead of delegating
  // to the plain `require`, which would look in the wrong directory.
  const stubRequire = (mod) => {
    if (mod.includes("emotionalVector")) return loadTsModule("lib/emotionalVector.ts");
    return require(mod);
  };
  const context = vm.createContext({ exports: cjsModule.exports, module: cjsModule, require: stubRequire, console, process, URLSearchParams, Array });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}

const vm2 = loadTsModule("lib/vectorMath.ts");

test("VECTOR_KEYS has 10 entries in correct order", () => {
  // vm2.VECTOR_KEYS is an array from the vm context's own realm — wrap with
  // Array.from() before comparing, same convention used in matching.test.mjs,
  // so assert.deepEqual doesn't fail on cross-realm array identity.
  assert.deepEqual(Array.from(vm2.VECTOR_KEYS), [
    "dreamy", "nostalgia", "energy", "cinematic", "darkness",
    "confidence", "intimacy", "danceability", "electronic", "acoustic",
  ]);
});

test("vectorToArray returns 10-element array in VECTOR_KEYS order", () => {
  const v = { dreamy: 0.1, nostalgia: 0.2, energy: 0.3, cinematic: 0.4, darkness: 0.5, confidence: 0.6, intimacy: 0.7, danceability: 0.8, electronic: 0.9, acoustic: 1.0 };
  assert.deepEqual(Array.from(vm2.vectorToArray(v)), [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]);
});

test("arrayToVector converts 10-element array back to object", () => {
  const a = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const v = vm2.arrayToVector(a);
  assert.equal(v.dreamy, 0.1);
  assert.equal(v.energy, 0.3);
  assert.equal(v.acoustic, 1.0);
});

test("applyVibeCap clamps within photo_dim ±0.35 / -0.25", () => {
  // boost within range
  assert.equal(vm2.applyVibeCap(0.5, 0.2), 0.7);
  // boost exceeds +0.35 ceiling
  assert.equal(vm2.applyVibeCap(0.5, 0.8), 0.85);
  // negative boost within -0.25
  assert.equal(vm2.applyVibeCap(0.5, -0.2), 0.3);
  // negative boost exceeds -0.25 floor
  assert.equal(vm2.applyVibeCap(0.5, -0.5), 0.25);
});

test("blendQueryVector weights photo 0.55 + taste 0.45 when no vibe", () => {
  const photo = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const taste = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  const result = vm2.blendQueryVector(photo, taste, null, {});
  assert.ok(Math.abs(result[0] - 0.55) < 0.001);
  assert.ok(Math.abs(result[1] - 0.45) < 0.001);
});

test("blendQueryVector weights photo 0.40 + taste 0.25 + vibe 0.35 when vibe provided", () => {
  const photo = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const taste = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  const vibe  = [0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
  const result = vm2.blendQueryVector(photo, taste, vibe, {});
  assert.ok(Math.abs(result[0] - 0.40) < 0.001);
  assert.ok(Math.abs(result[1] - 0.25) < 0.001);
  assert.ok(Math.abs(result[2] - 0.35) < 0.001);
});

test("cosine returns 1 for identical vectors", () => {
  const v = [0.3, 0.5, 0.7, 0.2, 0.1, 0.4, 0.6, 0.8, 0.9, 0.1];
  assert.ok(Math.abs(vm2.cosine(v, v) - 1) < 0.0001);
});

test("cosine returns 0 for orthogonal vectors", () => {
  const a = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const b = [0, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  assert.ok(Math.abs(vm2.cosine(a, b)) < 0.0001);
});

test("cosine returns 0 for zero vector", () => {
  const zero = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const v    = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  assert.equal(vm2.cosine(zero, v), 0);
});
