import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);

async function loadAppleMusicPlaylistModule() {
  const filename = new URL('../lib/appleMusicPlaylist.ts', import.meta.url);
  const filepath = fileURLToPath(filename);
  const source = await readFile(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });

  const cjsModule = { exports: {} };
  const context = {
    AbortController,
    AbortSignal,
    Headers,
    Request,
    Response,
    URL,
    clearTimeout,
    console,
    exports: cjsModule.exports,
    fetch: (...args) => globalThis.fetch(...args),
    module: cjsModule,
    process,
    require,
    setTimeout,
  };

  vm.runInNewContext(compiled.outputText, context, {
    filename: filepath,
  });

  return cjsModule.exports;
}

const {
  InvalidUrlError,
  ParseError,
  parseAppleMusicPlaylist,
} = await loadAppleMusicPlaylistModule();

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function responseFromHtml(html) {
  return {
    ok: true,
    status: 200,
    async text() {
      return html;
    },
  };
}

async function withMockedFetch(html, callback) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (...args) => {
    calls.push(args);
    return responseFromHtml(html);
  };

  try {
    return await callback(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function readFixture(name) {
  return readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
}

function htmlWithServerData(serverData) {
  return `
    <!doctype html>
    <html>
      <head>
        <script type="application/json" id="serialized-server-data">
          ${JSON.stringify(serverData)}
        </script>
      </head>
      <body></body>
    </html>
  `;
}

function extractExpectedPairsFromFixture(html) {
  const match = html.match(
    /<script[^>]+id=["']serialized-server-data["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  assert.ok(match, 'fixture should contain serialized-server-data');

  const parsed = JSON.parse(match[1].trim());
  const pairs = [];
  const seen = new Set();

  function walk(value) {
    if (!value || typeof value !== 'object') {
      return;
    }

    if (
      typeof value.title === 'string' &&
      value.title.trim() &&
      typeof value.artistName === 'string' &&
      value.artistName.trim()
    ) {
      const pair = {
        title: value.title.trim(),
        artist: value.artistName.trim(),
      };
      const key = `${pair.title.toLocaleLowerCase()}::${pair.artist.toLocaleLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push(pair);
      }
    }

    for (const nested of Object.values(value)) {
      walk(nested);
    }
  }

  walk(parsed);
  return pairs.slice(0, 30);
}

test('parseAppleMusicPlaylist parses tracks from serialized server data fixture', async () => {
  const html = await readFixture('apple-music-playlist.html');
  const expected = extractExpectedPairsFromFixture(html);

  assert.ok(expected.length > 0, 'fixture should include at least one track pair');

  await withMockedFetch(html, async (calls) => {
    const result = await parseAppleMusicPlaylist(
      'https://music.apple.com/us/playlist/example/pl.u-test',
    );

    assert.equal(calls.length, 1);
    assert.deepEqual(plain(result), {
      tracks: expected,
      truncated: false,
      totalFound: expected.length,
    });
    assert.ok(result.tracks.every((track) => track.title && track.artist));
  });
});

test('parseAppleMusicPlaylist rejects non-Apple Music playlist URLs', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('fetch should not be called for invalid urls');
  };

  try {
    await assert.rejects(
      parseAppleMusicPlaylist('https://example.com/not-a-playlist'),
      InvalidUrlError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('parseAppleMusicPlaylist rejects pages without serialized server data', async () => {
  const html = await readFixture('apple-music-no-server-data.html');

  await withMockedFetch(html, async () => {
    await assert.rejects(
      parseAppleMusicPlaylist('https://music.apple.com/us/playlist/empty/pl.u-test'),
      ParseError,
    );
  });
});

test('parseAppleMusicPlaylist rejects when serialized server data has no title and artist pairs', async () => {
  const html = htmlWithServerData({
    data: [
      { title: 'No Artist' },
      { artistName: 'No Title' },
      { title: '   ', artistName: 'Blank Title' },
      { title: 'Blank Artist', artistName: '   ' },
    ],
  });

  await withMockedFetch(html, async () => {
    await assert.rejects(
      parseAppleMusicPlaylist('https://music.apple.com/us/playlist/empty/pl.u-test'),
      ParseError,
    );
  });
});

test('parseAppleMusicPlaylist deduplicates repeated title and artist pairs', async () => {
  const html = htmlWithServerData({
    sections: [
      {
        items: [
          { title: 'Same Song', artistName: 'Same Artist' },
          { title: 'Same Song', artistName: 'Same Artist' },
          { title: 'Same Song', artistName: 'Different Artist' },
          { title: 'Another Song', artistName: 'Same Artist' },
        ],
      },
    ],
  });

  await withMockedFetch(html, async () => {
    const result = await parseAppleMusicPlaylist(
      'https://music.apple.com/us/playlist/duplicates/pl.u-test',
    );

    assert.deepEqual(plain(result), {
      tracks: [
        { title: 'Same Song', artist: 'Same Artist' },
        { title: 'Same Song', artist: 'Different Artist' },
        { title: 'Another Song', artist: 'Same Artist' },
      ],
      truncated: false,
      totalFound: 3,
    });
  });
});

test('parseAppleMusicPlaylist caps imported tracks at 30 in playlist order', async () => {
  const sourceTracks = Array.from({ length: 35 }, (_, index) => ({
    title: `Track ${index + 1}`,
    artistName: `Artist ${index + 1}`,
  }));
  const html = htmlWithServerData({ playlist: { tracks: sourceTracks } });

  await withMockedFetch(html, async () => {
    const result = await parseAppleMusicPlaylist(
      'https://music.apple.com/us/playlist/long/pl.u-test',
    );

    assert.deepEqual(plain(result), {
      tracks: sourceTracks.slice(0, 30).map((track) => ({
        title: track.title,
        artist: track.artistName,
      })),
      truncated: true,
      totalFound: 35,
    });
  });
});
