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

function transpile(path) {
  return ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
}

function loadProfilesModule({ authUser }) {
  const calls = [];
  const postgrestError = {
    code: "PGRST002",
    message: "Could not query the database for the schema cache. Retrying.",
  };

  const supabase = {
    auth: {
      admin: {
        async getUserById(userId) {
          calls.push({ fn: "getUserById", userId });
          return { data: { user: authUser }, error: null };
        },
        async updateUserById(userId, payload) {
          calls.push({ fn: "updateUserById", userId, payload });
          authUser = {
            ...authUser,
            app_metadata: payload.app_metadata,
          };
          return { data: { user: authUser }, error: null };
        },
      },
    },
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
          return { data: null, error: postgrestError };
        },
        update() {
          return {
            eq() {
              return this;
            },
            select() {
              return this;
            },
            async single() {
              return { data: null, error: postgrestError };
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
    console,
  });
  vm.runInContext(transpile("lib/db/profiles.ts"), context, {
    filename: "lib/db/profiles.ts",
  });
  return { module: cjsModule.exports, calls };
}

function loadPolarFulfillmentsModule({ authUser }) {
  const calls = [];
  const postgrestError = {
    code: "PGRST002",
    message: "Could not query the database for the schema cache. Retrying.",
  };

  const supabase = {
    auth: {
      admin: {
        async getUserById(userId) {
          calls.push({ fn: "getUserById", userId });
          return { data: { user: authUser }, error: null };
        },
        async updateUserById(userId, payload) {
          calls.push({ fn: "updateUserById", userId, payload });
          authUser = {
            ...authUser,
            app_metadata: payload.app_metadata,
          };
          return { data: { user: authUser }, error: null };
        },
      },
    },
    from(table) {
      assert.equal(table, "polar_fulfillments");
      return {
        async insert() {
          return { error: postgrestError };
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
    console,
  });
  vm.runInContext(transpile("lib/db/polarFulfillments.ts"), context, {
    filename: "lib/db/polarFulfillments.ts",
  });
  return { module: cjsModule.exports, calls };
}

test("getOrCreateProfile reads auth metadata credits when profiles PostgREST is unavailable", async () => {
  const { module } = loadProfilesModule({
    authUser: {
      id: "user-123",
      app_metadata: {
        provider: "email",
        vibesong_credits: 43,
        vibesong_migrated_local_data: true,
      },
    },
  });

  const profile = await module.getOrCreateProfile("user-123");

  assert.deepEqual(plain(profile), {
    userId: "user-123",
    credits: 43,
    migratedLocalData: true,
  });
});

test("addCredits writes auth metadata when profiles PostgREST is unavailable", async () => {
  const { module, calls } = loadProfilesModule({
    authUser: {
      id: "user-123",
      app_metadata: {
        provider: "email",
        vibesong_credits: 43,
      },
    },
  });

  const credits = await module.addCredits("user-123", 10);

  assert.equal(credits, 53);
  assert.deepEqual(plain(calls.at(-1)), {
    fn: "updateUserById",
    userId: "user-123",
    payload: {
      app_metadata: {
        provider: "email",
        vibesong_credits: 53,
      },
    },
  });
});

test("deductCredit writes auth metadata when profiles PostgREST is unavailable", async () => {
  const { module } = loadProfilesModule({
    authUser: {
      id: "user-123",
      app_metadata: {
        vibesong_credits: 1,
      },
    },
  });

  const result = await module.deductCredit("user-123");

  assert.deepEqual(plain(result), { ok: true, credits: 0 });
});

test("claimPolarFulfillment uses auth metadata keys when ledger PostgREST is unavailable", async () => {
  const { module, calls } = loadPolarFulfillmentsModule({
    authUser: {
      id: "user-123",
      app_metadata: {
        provider: "email",
        vibesong_polar_fulfillment_keys: ["checkout:old"],
      },
    },
  });

  const claimed = await module.claimPolarFulfillment({
    key: "checkout:new",
    orderId: "order-123",
    checkoutId: "new",
    userId: "user-123",
    productId: "product-123",
    credits: 10,
    isSubscription: false,
    source: "order.paid",
    eventType: "order.paid",
  });

  assert.equal(claimed, true);
  assert.deepEqual(plain(calls.at(-1)), {
    fn: "updateUserById",
    userId: "user-123",
    payload: {
      app_metadata: {
        provider: "email",
        vibesong_polar_fulfillment_keys: ["checkout:old", "checkout:new"],
      },
    },
  });
});

test("claimPolarFulfillment detects duplicate auth metadata keys", async () => {
  const { module } = loadPolarFulfillmentsModule({
    authUser: {
      id: "user-123",
      app_metadata: {
        vibesong_polar_fulfillment_keys: ["checkout:duplicate"],
      },
    },
  });

  const claimed = await module.claimPolarFulfillment({
    key: "checkout:duplicate",
    orderId: "order-123",
    checkoutId: "duplicate",
    userId: "user-123",
    productId: "product-123",
    credits: 10,
    isSubscription: false,
    source: "order.paid",
    eventType: "order.paid",
  });

  assert.equal(claimed, false);
});
