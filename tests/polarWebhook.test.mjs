import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

let productConfig = null;
const calls = [];
const claimedFulfillments = new Set();

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadModule(path) {
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
    if (id === "./polar" || id.endsWith("/polar") || id.includes("lib/polar")) {
      return {
        getProductConfig: () => productConfig,
      };
    }
    if (id === "./db/profiles" || id.includes("lib/db/profiles")) {
      return {
        addCredits: async (userId, amount) => {
          calls.push({ fn: "addCredits", userId, amount });
          return amount;
        },
        setCredits: async (userId, amount) => {
          calls.push({ fn: "setCredits", userId, amount });
          return amount;
        },
      };
    }
    if (id === "./db/polarFulfillments" || id.includes("lib/db/polarFulfillments")) {
      return {
        claimPolarFulfillment: async (fulfillment) => {
          calls.push({ fn: "claimPolarFulfillment", key: fulfillment.key });
          if (claimedFulfillments.has(fulfillment.key)) return false;
          claimedFulfillments.add(fulfillment.key);
          return true;
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
    process,
    Object,
  });
  vm.runInContext(output, context, { filename: path });
  return cjsModule.exports;
}

const { fulfillPolarOrder } = loadModule("lib/polarFulfillment.ts");

test("Polar order.paid fulfillment adds one-time purchase credits", async () => {
  calls.length = 0;
  claimedFulfillments.clear();
  productConfig = { credits: 50, isSubscription: false };

  const result = await fulfillPolarOrder(
    {
      id: "order-123",
      paid: true,
      productId: "polar-popular",
      checkoutId: "checkout-123",
      metadata: { userId: "user-123" },
    },
    "order.paid"
  );

  assert.deepEqual(plain(result), { status: "fulfilled", credits: 50 });
  assert.deepEqual(calls, [
    { fn: "claimPolarFulfillment", key: "checkout:checkout-123" },
    { fn: "addCredits", userId: "user-123", amount: 50 },
  ]);
});

test("Polar order.paid fulfillment refills subscription credits", async () => {
  calls.length = 0;
  claimedFulfillments.clear();
  productConfig = { credits: 500, isSubscription: true };

  const result = await fulfillPolarOrder(
    {
      id: "order-456",
      paid: true,
      productId: "polar-pro",
      metadata: { userId: "user-123" },
    },
    "order.paid"
  );

  assert.deepEqual(plain(result), { status: "fulfilled", credits: 500 });
  assert.deepEqual(calls, [
    { fn: "claimPolarFulfillment", key: "order:order-456" },
    { fn: "setCredits", userId: "user-123", amount: 500 },
  ]);
});

test("Polar pending order.created fulfillment does not add credits", async () => {
  calls.length = 0;
  claimedFulfillments.clear();
  productConfig = { credits: 10, isSubscription: false };

  const result = await fulfillPolarOrder(
    {
      id: "order-pending",
      paid: false,
      productId: "polar-starter",
      metadata: { userId: "user-123" },
    },
    "order.created"
  );

  assert.deepEqual(plain(result), { status: "ignored", reason: "order_not_paid" });
  assert.deepEqual(calls, []);
});

test("Polar order.created fulfillment adds credits when the order is already paid", async () => {
  calls.length = 0;
  claimedFulfillments.clear();
  productConfig = { credits: 10, isSubscription: false };

  const result = await fulfillPolarOrder(
    {
      id: "order-created-paid",
      status: "paid",
      paid: true,
      productId: "polar-starter",
      checkoutId: "checkout-created-paid",
      metadata: { userId: "user-123" },
    },
    "order.created"
  );

  assert.deepEqual(plain(result), { status: "fulfilled", credits: 10 });
  assert.deepEqual(calls, [
    { fn: "claimPolarFulfillment", key: "checkout:checkout-created-paid" },
    { fn: "addCredits", userId: "user-123", amount: 10 },
  ]);
});

test("Polar order.updated fulfillment adds credits when a pending order becomes paid", async () => {
  calls.length = 0;
  claimedFulfillments.clear();
  productConfig = { credits: 50, isSubscription: false };

  const result = await fulfillPolarOrder(
    {
      id: "order-updated-paid",
      status: "paid",
      paid: true,
      productId: "polar-popular",
      checkoutId: "checkout-updated-paid",
      metadata: {},
      customer: { externalId: "user-from-customer" },
    },
    "order.updated"
  );

  assert.deepEqual(plain(result), { status: "fulfilled", credits: 50 });
  assert.deepEqual(calls, [
    { fn: "claimPolarFulfillment", key: "checkout:checkout-updated-paid" },
    { fn: "addCredits", userId: "user-from-customer", amount: 50 },
  ]);
});

test("Polar fulfillment does not double-credit the same checkout", async () => {
  calls.length = 0;
  claimedFulfillments.clear();
  productConfig = { credits: 50, isSubscription: false };
  const order = {
    id: "order-duplicate",
    paid: true,
    productId: "polar-popular",
    checkoutId: "checkout-duplicate",
    metadata: { userId: "user-123" },
  };

  const first = await fulfillPolarOrder(order, "order.paid");
  const second = await fulfillPolarOrder(order, "order.updated");

  assert.deepEqual(plain(first), { status: "fulfilled", credits: 50 });
  assert.deepEqual(plain(second), { status: "duplicate" });
  assert.deepEqual(calls, [
    { fn: "claimPolarFulfillment", key: "checkout:checkout-duplicate" },
    { fn: "addCredits", userId: "user-123", amount: 50 },
    { fn: "claimPolarFulfillment", key: "checkout:checkout-duplicate" },
  ]);
});
