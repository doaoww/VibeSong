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

const youtube = loadTsModule("lib/youtube.ts");

test("shouldSkip flags an instrumental-version result for a track that isn't itself instrumental", () => {
  // Reproduces the other half of the "Cologne (instrumental version)" bug:
  // the YouTube fallback path (used when no iTunes preview is found) has no
  // "instrumental" entry in SKIP_TERMS, so an instrumental cover video can
  // win the slot meant for the real vocal track.
  assert.equal(youtube.shouldSkip("Cologne - Instrumental Version", "Cologne"), true);
});

test("shouldSkip does not flag a genuinely instrumental track against itself", () => {
  assert.equal(youtube.shouldSkip("Interlude (Instrumental)", "Interlude (Instrumental)"), false);
});
