"use client";
import { useEffect, useState } from "react";

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "";

interface Song {
  id: string;
  title: string;
  artist: string;
  language: string;
  popularity_tier: number;
  story_intent_tags: string[];
  quality_score: number;
  final_confidence: number | null;
  needs_review: boolean;
  confidence_level?: string | null;
  confidence_reason?: string | null;
  discarded_tags?: string[];
  vibe_summary?: string | null;
  save_count?: number;
  skip_count?: number;
}

function confidenceColor(score: number | null | undefined): string {
  if (score == null) return "#666";
  if (score >= 0.6) return "#22c55e";
  if (score >= 0.35) return "#eab308";
  return "#ef4444";
}

function sortForReviewQueue(songs: Song[]): Song[] {
  return [...songs].sort((a, b) => {
    if (a.needs_review !== b.needs_review) return a.needs_review ? -1 : 1;
    const confA = a.final_confidence ?? 1;
    const confB = b.final_confidence ?? 1;
    if (confA !== confB) return confA - confB;
    const usageA = (a.save_count ?? 0) + (a.skip_count ?? 0);
    const usageB = (b.save_count ?? 0) + (b.skip_count ?? 0);
    return usageB - usageA;
  });
}

export default function AdminPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTags, setEditTags] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);

  const headers = { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET };

  const load = async () => {
    const res = await fetch("/api/admin/songs", { headers });
    const data = await res.json();
    setSongs(data.songs ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const addSong = async () => {
    if (!title || !artist) return;
    setLoading(true);
    setStatus("Tagging...");
    const res = await fetch("/api/admin/songs", {
      method: "POST",
      headers,
      body: JSON.stringify({ title, artist }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatus(`Added: ${data.song.title} (${data.song.language}, tier ${data.song.popularity_tier})`);
      setTitle("");
      setArtist("");
      await load();
    } else {
      setStatus(`Error: ${data.error}`);
    }
    setLoading(false);
  };

  const saveEdit = async (id: string) => {
    const tags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await fetch(`/api/admin/songs/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ story_intent_tags: tags }),
    });
    setEditId(null);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this song?")) return;
    await fetch(`/api/admin/songs/${id}`, { method: "DELETE", headers });
    await load();
  };

  const visibleSongs = reviewOnly
    ? sortForReviewQueue(songs.filter((s) => s.needs_review))
    : songs;

  return (
    <div style={{ padding: 24, fontFamily: "monospace", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>VibeSong Catalog Admin</h1>
      <p style={{ color: "#888", marginBottom: 16 }}>{songs.length} songs in catalog</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Song title"
          style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#fff" }}
        />
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="Artist"
          style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #333", background: "#111", color: "#fff" }}
        />
        <button
          onClick={addSong}
          disabled={loading}
          style={{ padding: "8px 16px", background: "#7C3AED", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
        >
          {loading ? "Tagging..." : "Add + Auto-tag"}
        </button>
      </div>
      {status && <p style={{ color: "#A855F7", marginBottom: 16 }}>{status}</p>}

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "#888", fontSize: 13 }}>
        <input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} />
        Show only needs review
      </label>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333", color: "#888" }}>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Title</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Artist</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Lang</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Tier</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Confidence</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Story Tags</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Vibe Summary</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Discarded</th>
            <th style={{ textAlign: "left", padding: "6px 8px" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {visibleSongs.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
              <td style={{ padding: "6px 8px", color: "#fff" }}>{s.title}</td>
              <td style={{ padding: "6px 8px", color: "#aaa" }}>{s.artist}</td>
              <td style={{ padding: "6px 8px", color: "#888" }}>{s.language}</td>
              <td style={{ padding: "6px 8px", color: "#888" }}>{s.popularity_tier}</td>
              <td style={{ padding: "6px 8px" }}>
                <span
                  title={s.confidence_reason || ""}
                  style={{ color: confidenceColor(s.final_confidence), fontWeight: 600 }}
                >
                  {s.final_confidence != null ? s.final_confidence.toFixed(2) : "-"}
                  {s.confidence_level ? ` (${s.confidence_level})` : ""}
                </span>
              </td>
              <td style={{ padding: "6px 8px" }}>
                {editId === s.id ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      style={{ flex: 1, padding: "4px 8px", background: "#1a1a1a", border: "1px solid #444", borderRadius: 4, color: "#fff", fontSize: 12 }}
                    />
                    <button
                      onClick={() => saveEdit(s.id)}
                      style={{ padding: "4px 8px", background: "#22c55e", color: "#000", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      style={{ padding: "4px 8px", background: "#333", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <span style={{ color: "#A855F7", fontSize: 11 }}>{s.story_intent_tags?.join(", ") || "-"}</span>
                )}
              </td>
              <td style={{ padding: "6px 8px", color: "#888", fontSize: 11, maxWidth: 220 }}>{s.vibe_summary || "-"}</td>
              <td style={{ padding: "6px 8px", color: "#666", fontSize: 11 }}>{s.discarded_tags?.join(", ") || "-"}</td>
              <td style={{ padding: "6px 8px", display: "flex", gap: 6 }}>
                <button
                  onClick={() => {
                    setEditId(s.id);
                    setEditTags(s.story_intent_tags?.join(", ") ?? "");
                  }}
                  style={{ padding: "3px 8px", background: "#1a1a1a", color: "#888", border: "1px solid #333", borderRadius: 4, cursor: "pointer", fontSize: 11 }}
                >
                  Edit tags
                </button>
                <button
                  onClick={() => remove(s.id)}
                  style={{ padding: "3px 8px", background: "#1a1a1a", color: "#ef4444", border: "1px solid #333", borderRadius: 4, cursor: "pointer", fontSize: 11 }}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
