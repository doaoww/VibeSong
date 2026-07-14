import assert from "node:assert/strict";
import { test } from "node:test";

const { isIOSSafari, canUseWebShareFiles } = await import("../lib/instagramShare.ts");

test("isIOSSafari detects iPhone Safari", () => {
  const ua =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/604.1";
  assert.equal(isIOSSafari(ua), true);
});

test("isIOSSafari detects iPad Safari", () => {
  const ua =
    "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/604.1";
  assert.equal(isIOSSafari(ua), true);
});

test("isIOSSafari rejects Chrome on iOS (CriOS)", () => {
  const ua =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.111 Mobile/15E148 Safari/604.1";
  assert.equal(isIOSSafari(ua), false);
});

test("isIOSSafari rejects Android Chrome", () => {
  const ua =
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
  assert.equal(isIOSSafari(ua), false);
});

test("canUseWebShareFiles reflects navigator.canShare() true", () => {
  const file = new File(["x"], "a.png", { type: "image/png" });
  assert.equal(canUseWebShareFiles({ canShare: () => true }, file), true);
});

test("canUseWebShareFiles reflects navigator.canShare() false", () => {
  const file = new File(["x"], "a.png", { type: "image/png" });
  assert.equal(canUseWebShareFiles({ canShare: () => false }, file), false);
});

test("canUseWebShareFiles is false when canShare is missing entirely", () => {
  const file = new File(["x"], "a.png", { type: "image/png" });
  assert.equal(canUseWebShareFiles({}, file), false);
});
