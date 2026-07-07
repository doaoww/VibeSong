import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadProfilesModule({ existingProfile, updates }) {
  const source = readFileSync("lib/db/profiles.ts", "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  const supabase = {
    from(table) {
      assert.equal(table, "profiles");
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async maybeSingle() {
          return { data: existingProfile, error: null };
        },
        update(payload) {
          updates.push(payload);
          return {
            async eq() {
              return { error: null };
            },
          };
        },
      };
    },
  };

  const cjsModule = { exports: {} };
  const stubRequire = (id) => {
    if (id === "../supabase" || id.includes("lib/supabase")) {
      return { supabase };
    }
    return require(id);
  };

  const context = vm.createContext({
    exports: cjsModule.exports,
    module: cjsModule,
    require: stubRequire,
  });
  vm.runInContext(output, context, { filename: "lib/db/profiles.ts" });
  return cjsModule.exports;
}

test("markMigrated never lowers paid server credits with stale local credits", async () => {
  const updates = [];
  const { markMigrated } = loadProfilesModule({
    existingProfile: {
      user_id: "user-123",
      credits: 43,
      migrated_local_data: false,
    },
    updates,
  });

  await markMigrated("user-123", 3);

  assert.deepEqual(plain(updates), [{ migrated_local_data: true, credits: 43 }]);
});

test("markMigrated can raise server credits when local anonymous credits are higher", async () => {
  const updates = [];
  const { markMigrated } = loadProfilesModule({
    existingProfile: {
      user_id: "user-123",
      credits: 2,
      migrated_local_data: false,
    },
    updates,
  });

  await markMigrated("user-123", 3);

  assert.deepEqual(plain(updates), [{ migrated_local_data: true, credits: 3 }]);
});
