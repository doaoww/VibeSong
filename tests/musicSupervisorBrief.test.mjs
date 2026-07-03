import assert from "node:assert/strict";
import { test } from "node:test";

const msb = await import("../lib/musicSupervisorBrief.ts");

test("parseMusicSupervisorBrief returns safe defaults when raw is not an object", () => {
  const result = msb.parseMusicSupervisorBrief(null);
  assert.deepEqual(result, {
    narrative: "",
    emotionalSubtext: "",
    restraint: "balanced",
    context: "",
    direction: "",
    avoid: "",
  });
});

test("parseMusicSupervisorBrief trims whitespace and caps free-text fields at 300 chars", () => {
  const result = msb.parseMusicSupervisorBrief({
    narrative: "  a quiet morning selfie  ",
    emotionalSubtext: "x".repeat(500),
  });
  assert.equal(result.narrative, "a quiet morning selfie");
  assert.equal(result.emotionalSubtext.length, 300);
});

test("parseMusicSupervisorBrief defaults restraint to balanced when invalid or missing", () => {
  assert.equal(msb.parseMusicSupervisorBrief({}).restraint, "balanced");
  assert.equal(msb.parseMusicSupervisorBrief({ restraint: "extremely loud" }).restraint, "balanced");
  assert.equal(msb.parseMusicSupervisorBrief({ restraint: "expressive" }).restraint, "expressive");
  assert.equal(msb.parseMusicSupervisorBrief({ restraint: "understated" }).restraint, "understated");
});

test("parseMusicSupervisorBrief coerces non-string field values to empty string", () => {
  const result = msb.parseMusicSupervisorBrief({ narrative: 5, avoid: null, context: ["not", "a", "string"] });
  assert.equal(result.narrative, "");
  assert.equal(result.avoid, "");
  assert.equal(result.context, "");
});

test("buildBriefText concatenates narrative/emotionalSubtext/restraint/context/direction", () => {
  const text = msb.buildBriefText({
    narrative: "A quiet morning selfie.",
    emotionalSubtext: "none, this is literal.",
    restraint: "understated",
    context: "private, just for herself.",
    direction: "something soft and unhurried.",
    avoid: "nothing loud or ironic.",
  });
  assert.ok(text.includes("A quiet morning selfie."));
  assert.ok(text.includes("Restraint: understated."));
  assert.ok(text.includes("private, just for herself."));
  assert.ok(text.includes("something soft and unhurried."));
});

test("buildBriefText never includes the avoid field's text", () => {
  const text = msb.buildBriefText({
    narrative: "n",
    emotionalSubtext: "e",
    restraint: "balanced",
    context: "c",
    direction: "d",
    avoid: "nothing euphoric or ironic",
  });
  assert.ok(!text.includes("euphoric"), "avoid text must never reach the embedded string");
  assert.ok(!text.includes("ironic"));
});
