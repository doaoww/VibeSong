import assert from "node:assert/strict";
import { test } from "node:test";

const { resolveSongLink } = await import("../lib/songLink.ts");

test("resolveSongLink prefers appleMusicUrl over everything else", () => {
  const link = resolveSongLink({
    appleMusicUrl: "https://music.apple.com/song/1",
    youtubeUrl: "https://youtube.com/watch?v=ignored",
    youtubeId: "ignored",
    previewUrl: "https://preview.example/ignored.m4a",
  });
  assert.equal(link, "https://music.apple.com/song/1");
});

test("resolveSongLink falls back to youtubeUrl when appleMusicUrl is missing", () => {
  const link = resolveSongLink({
    youtubeUrl: "https://youtube.com/watch?v=abc123",
    youtubeId: "ignored",
  });
  assert.equal(link, "https://youtube.com/watch?v=abc123");
});

test("resolveSongLink constructs a YouTube watch URL from youtubeId when youtubeUrl is missing", () => {
  const link = resolveSongLink({ youtubeId: "dQw4w9WgXcQ" });
  assert.equal(link, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});

test("resolveSongLink falls back to previewUrl when nothing else is available", () => {
  const link = resolveSongLink({ previewUrl: "https://preview.example/song.m4a" });
  assert.equal(link, "https://preview.example/song.m4a");
});

test("resolveSongLink returns null when no link can be resolved", () => {
  assert.equal(resolveSongLink({}), null);
});
