import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

let createdCheckoutRequest = null;
let mockUser = { id: "user-123" };
let mockCheckout = null;
const calls = [];

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

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
    if (id.includes("lib/supabase/server")) {
      return {
        getSupabaseUser: async () => mockUser,
      };
    }
    if (id.includes("lib/polarFulfillment")) {
      return {
        fulfillPolarOrder: async (order, source) => {
          calls.push({ fn: "fulfillPolarOrder", order, source });
          return { status: "fulfilled", credits: 50 };
        },
      };
    }
    if (id.includes("lib/polar")) {
      return {
        PACKAGE_TO_PRODUCT: { starter: "polar-starter", popular: "polar-popular" },
        polar: {
          checkouts: {
            create: async (request) => {
              createdCheckoutRequest = request;
              return { url: "https://checkout.example/session" };
            },
            get: async () => mockCheckout,
          },
        },
      };
    }
    return require(id);
  };

  const context = vm.createContext({
    exports: cjsModule.exports,
    module: cjsModule,
    require: stubRequire,
    console,
    process: {
      ...process,
      env: {
        ...process.env,
        NEXT_PUBLIC_URL: "https://vibesong.example",
      },
    },
    Object,
  });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}

function req(body) {
  return {
    json: async () => body,
  };
}

test("Polar checkout success URL includes checkout_id for verified redirect fulfillment", async () => {
  createdCheckoutRequest = null;
  mockUser = { id: "user-123" };
  const route = loadRoute("app/api/checkout/polar/route.ts");

  const res = await route.POST(req({ packageId: "popular" }));

  assert.equal(res.status, 200);
  assert.equal(
    createdCheckoutRequest.successUrl,
    "https://vibesong.example/app?payment=success&checkout_id={CHECKOUT_ID}"
  );
  assert.equal(createdCheckoutRequest.externalCustomerId, "user-123");
  assert.deepEqual(plain(createdCheckoutRequest.metadata), {
    userId: "user-123",
    packageId: "popular",
  });
});

test("Polar checkout confirm fulfills a succeeded checkout for the signed-in user", async () => {
  calls.length = 0;
  mockUser = { id: "user-123" };
  mockCheckout = {
    id: "checkout-123",
    status: "succeeded",
    productId: "polar-popular",
    externalCustomerId: "user-123",
    metadata: { userId: "user-123" },
  };
  const route = loadRoute("app/api/checkout/polar/confirm/route.ts");

  const res = await route.POST(req({ checkoutId: "checkout-123" }));

  assert.equal(res.status, 200);
  assert.deepEqual(plain(calls), [
    {
      fn: "fulfillPolarOrder",
      source: "checkout.confirm",
      order: {
        id: "checkout-123",
        paid: true,
        status: "paid",
        productId: "polar-popular",
        checkoutId: "checkout-123",
        metadata: { userId: "user-123" },
        customer: { externalId: "user-123" },
      },
    },
  ]);
  assert.deepEqual(plain(res.body), { received: true, status: "fulfilled", credits: 50 });
});
