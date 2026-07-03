import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const stubState = { embedding: [0.1, 0.2, 0.3], lastArgs: null };

function loadTsModule(path) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const cjsModule = { exports: {} };
  const stubRequire = (id) => {
    if (id.includes("openai")) {
      return {
        __esModule: true,
        default: {
          embeddings: {
            create: async (args) => {
              stubState.lastArgs = args;
              return { data: [{ embedding: stubState.embedding }] };
            },
          },
        },
      };
    }
    return require(id);
  };
  const context = vm.createContext({ exports: cjsModule.exports, module: cjsModule, require: stubRequire, console, process });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}

const embeddings = loadTsModule("lib/embeddings.ts");

test("embedText calls openai.embeddings.create with text-embedding-3-small and returns the embedding array", async () => {
  stubState.embedding = [0.5, 0.25, -0.1];
  const result = await embeddings.embedText("a quiet morning selfie");
  assert.deepEqual(result, [0.5, 0.25, -0.1]);
  assert.equal(stubState.lastArgs.model, "text-embedding-3-small");
  assert.equal(stubState.lastArgs.input, "a quiet morning selfie");
});
