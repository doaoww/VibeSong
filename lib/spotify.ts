export interface SpotifyTopData {
  topArtists: string[];
  topTracks: string[];
}

export async function getSpotifyTopData(
  accessToken: string
): Promise<SpotifyTopData> {
  const [artistsRes, tracksRes] = await Promise.all([
    fetch(
      "https://api.spotify.com/v1/me/top/artists?limit=10&time_range=medium_term",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ),
    fetch(
      "https://api.spotify.com/v1/me/top/tracks?limit=20&time_range=medium_term",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    ),
  ]);

  const artists = artistsRes.ok ? await artistsRes.json() : { items: [] };
  const tracks = tracksRes.ok ? await tracksRes.json() : { items: [] };

  return {
    topArtists: (artists.items || []).map(
      (a: { name: string }) => a.name
    ),
    topTracks: (tracks.items || []).map(
      (t: { name: string; artists: { name: string }[] }) =>
        `${t.name} by ${t.artists[0]?.name}`
    ),
  };
}

export async function createSpotifyPlaylist(
  accessToken: string,
  userId: string,
  trackUris: string[],
  playlistName = "My VibeSong Matches"
): Promise<string | null> {
  const createRes = await fetch(
    `https://api.spotify.com/v1/users/${userId}/playlists`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: playlistName, public: true }),
    }
  );
  if (!createRes.ok) return null;
  const playlist = await createRes.json();

  await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris: trackUris }),
  });

  return playlist.external_urls?.spotify || null;
}
