import assert from "node:assert/strict";
import { test } from "node:test";

const { mergeFeedbackTracks } = await import("../lib/mergeFeedback.ts");

test("mergeFeedbackTracks returns the server list when local is empty", () => {
  const server = [{ title: "Runaway", artist: "Kanye West" }];
  assert.deepEqual(mergeFeedbackTracks([], server), server);
});

test("mergeFeedbackTracks keeps a local-only entry the server hasn't caught up to yet", () => {
  const server = [{ title: "Runaway", artist: "Kanye West" }];
  const local = [
    { title: "Runaway", artist: "Kanye West" },
    { title: "Just Saved", artist: "Some Artist" },
  ];
  const result = mergeFeedbackTracks(local, server);
  assert.deepEqual(result, [
    { title: "Runaway", artist: "Kanye West" },
    { title: "Just Saved", artist: "Some Artist" },
  ]);
});

test("mergeFeedbackTracks prefers the server's version when both have the same track", () => {
  const server = [{ title: "Runaway", artist: "Kanye West", sourceImage: "server-thumb" }];
  const local = [{ title: "Runaway", artist: "Kanye West", sourceImage: "local-thumb" }];
  const result = mergeFeedbackTracks(local, server);
  assert.deepEqual(result, [{ title: "Runaway", artist: "Kanye West", sourceImage: "server-thumb" }]);
});

test("mergeFeedbackTracks matches by title+artist case-insensitively and ignores surrounding whitespace", () => {
  const server = [{ title: "runaway", artist: "kanye west" }];
  const local = [{ title: " Runaway ", artist: " Kanye West " }];
  const result = mergeFeedbackTracks(local, server);
  assert.deepEqual(result, server);
});

test("mergeFeedbackTracks preserves all local entries when the server list is empty", () => {
  const local = [{ title: "Just Saved", artist: "Some Artist" }];
  assert.deepEqual(mergeFeedbackTracks(local, []), local);
});
