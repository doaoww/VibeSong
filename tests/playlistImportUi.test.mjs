import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("PlaylistImport posts Apple Music links to the import-playlist API", async () => {
  const source = await readFile(new URL("../components/PlaylistImport.tsx", import.meta.url), "utf8");

  assert.match(source, /\/api\/taste\/import-playlist/);
  assert.match(source, /playlistImport\.reading/);
  assert.match(source, /onManualFallback/);
});

test("profile exposes playlist import inside a bottom sheet", async () => {
  const profileSource = await readFile(new URL("../app/profile/page.tsx", import.meta.url), "utf8");

  assert.match(profileSource, /PlaylistImport/);
  assert.match(profileSource, /showPlaylistImport/);
  assert.match(profileSource, /importPlaylist/);
});

test("onboarding story songs step can switch between manual song entry and playlist import", async () => {
  const source = await readFile(new URL("../components/onboarding/StorySongsStep.tsx", import.meta.url), "utf8");

  assert.match(source, /PlaylistImport/);
  assert.match(source, /entryMode/);
  assert.match(source, /playlistToggle/);
});
