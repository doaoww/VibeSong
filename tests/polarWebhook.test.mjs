import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

let mockEvent = null;
let productConfig = null;
const calls = [];

class MockWebhookVerificationError extends Error {}

function loadRoute(path) {
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  const cjsModule = { exports: {} };
  const stubRequire = (id) => {
    if (id === "next/server") {
      return {
        NextResponse: {
          json: (body, init = {}) => ({ body, status: init.status ?? 200 }),
        },
      };
    }
    if (id === "@polar-sh/sdk/webhooks") {
      return {
        validateEvent: () => mockEvent,
        WebhookVerificationError: MockWebhookVerificationError,
      };
    }
    if (id.includes("lib/polar")) {
      return {
        getProductConfig: () => productConfig,
      };
    }
    if (id.includes("lib/db/profiles")) {
      return {
        addCredits: async (userId, amount) => calls.push({ fn: "addCredits", userId, amount }),
        setCredits: async (userId, amount) => calls.push({ fn: "setCredits", userId, amount }),
      };
    }
    return require(id);
  };

  const context = vm.createContext({
    exports: cjsModule.exports,
    module: cjsModule,
    require: stubRequire,
    console,
    process,
    Object,
  });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}

const route = loadRoute("app/api/webhooks/polar/route.ts");

function req() {
  return {
    text: async () => "{}",
    headers: new Map(),
  };
}

test("Polar order.paid webhook adds one-time purchase credits", async () => {
  calls.length = 0;
  productConfig = { credits: 50, isSubscription: false };
  mockEvent = {
    type: "order.paid",
    data: {
      paid: true,
      productId: "polar-popular",
      metadata: { userId: "user-123" },
    },
  };

  const res = await route.POST(req());

  assert.equal(res.status, 200);
  assert.deepEqual(calls, [{ fn: "addCredits", userId: "user-123", amount: 50 }]);
});

test("Polar order.paid webhook refills subscription credits", async () => {
  calls.length = 0;
  productConfig = { credits: 500, isSubscription: true };
  mockEvent = {
    type: "order.paid",
    data: {
      paid: true,
      productId: "polar-pro",
      metadata: { userId: "user-123" },
    },
  };

  await route.POST(req());

  assert.deepEqual(calls, [{ fn: "setCredits", userId: "user-123", amount: 500 }]);
});

test("Polar order.created pending webhook does not add credits", async () => {
  calls.length = 0;
  productConfig = { credits: 10, isSubscription: false };
  mockEvent = {
    type: "order.created",
    data: {
      paid: false,
      productId: "polar-starter",
      metadata: { userId: "user-123" },
    },
  };

  await route.POST(req());

  assert.deepEqual(calls, []);
});
