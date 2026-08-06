"use client";
import { useEffect, useState } from "react";
import { isConfidenceBlocked, isLanguageUnknownBlocked } from "../../lib/recommend";

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
  tag_source?: string;
  manual_reviewed_at?: string | null;
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

// A song can be "needs review" (0.35-0.6 confidence) without ever being
// excluded from recommendations — it's still scored normally, just flagged.
// "Hard-blocked" is the much smaller, more urgent set: songs isConfidenceBlocked
// or isLanguageUnknownBlocked actually removes from EVERY recommendation
// request (lib/recommend.ts guards 0.5/0.6), regardless of how well they'd
// otherwise match a photo. That's the set worth triaging first.
function hardBlockedReasons(song: Song): string[] {
  const reasons: string[] = [];
  if (isConfidenceBlocked(song)) reasons.push("low confidence");
  if (isLanguageUnknownBlocked(song)) reasons.push("unknown language");
  return reasons;
}

function sortForHardBlockedTriage(songs: Song[]): Song[] {
  return [...songs].sort((a, b) => {
    const confA = a.final_confidence ?? 1;
    const confB = b.final_confidence ?? 1;
    return confA - confB;
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
  const [editLanguage, setEditLanguage] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "needs_review" | "hard_blocked">("all");

  const headers = { "Content-Type": "application/json", "x-admin-secret": ADMIN_SECRET };

  const load = async () => {
    // limit=2000: the default limit=200 only covers the most-recently-added
    // songs (list_catalog orders by created_at DESC) — with a 1000+ song
    // catalog that silently hid ~80% of it from this page, including most of
    // what the hard-blocked filter below needs to find.
    const res = await fetch("/api/admin/songs?limit=2000", { headers });
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
      body: JSON.stringify({ story_intent_tags: tags, language: editLanguage.trim() || undefined }),
    });
    setEditId(null);
    await load();
  };

  const approveSong = async (id: string) => {
    await fetch(`/api/admin/songs/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ approve: true }),
    });
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this song?")) return;
    await fetch(`/api/admin/songs/${id}`, { method: "DELETE", headers });
    await load();
  };

  const hardBlockedSongs = songs.filter((s) => hardBlockedReasons(s).length > 0);
  const visibleSongs =
    filterMode === "hard_blocked"
      ? sortForHardBlockedTriage(hardBlockedSongs)
      : filterMode === "needs_review"
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

      <div style={{ display: "flex", gap: 8, marginBottom: 16, fontSize: 13 }}>
        {([
          ["all", `All (${songs.length})`],
          ["needs_review", `Needs review (${songs.filter((s) => s.needs_review).length})`],
          ["hard_blocked", `Hard-blocked (${hardBlockedSongs.length})`],
        ] as const).map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setFilterMode(mode)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid " + (filterMode === mode ? "#7C3AED" : "#333"),
              background: filterMode === mode ? "#7C3AED" : "#111",
              color: filterMode === mode ? "#fff" : "#888",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {filterMode === "hard_blocked" && (
        <p style={{ color: "#666", fontSize: 12, marginTop: -8, marginBottom: 16 }}>
          These songs never appear in any recommendation, regardless of the photo — sorted worst
          confidence first. &quot;Approve&quot; fixes a <span style={{ color: "#eab308" }}>low confidence</span>{" "}
          block; an <span style={{ color: "#ef4444" }}>unknown language</span> block needs the language
          set via Edit instead (approving alone won&apos;t clear it).
        </p>
      )}

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
              <td style={{ padding: "6px 8px" }}>
                {editId === s.id ? (
                  <input
                    value={editLanguage}
                    onChange={(e) => setEditLanguage(e.target.value)}
                    placeholder={s.language}
                    style={{ width: 90, padding: "4px 8px", background: "#1a1a1a", border: "1px solid #444", borderRadius: 4, color: "#fff", fontSize: 12 }}
                  />
                ) : (
                  <span style={{ color: s.language === "Unknown" ? "#ef4444" : "#888" }}>{s.language}</span>
                )}
              </td>
              <td style={{ padding: "6px 8px", color: "#888" }}>{s.popularity_tier}</td>
              <td style={{ padding: "6px 8px" }}>
                <span
                  title={s.confidence_reason || ""}
                  style={{ color: confidenceColor(s.final_confidence), fontWeight: 600 }}
                >
                  {s.final_confidence != null ? s.final_confidence.toFixed(2) : "-"}
                  {s.confidence_level ? ` (${s.confidence_level})` : ""}
                </span>
                {s.tag_source === "auto_plus_manual" && (
                  <span style={{ marginLeft: 6, color: "#22c55e", fontSize: 10 }} title={s.manual_reviewed_at ?? ""}>
                    ✓ reviewed
                  </span>
                )}
                {hardBlockedReasons(s).map((reason) => (
                  <span
                    key={reason}
                    style={{
                      display: "block",
                      marginTop: 2,
                      color: reason === "unknown language" ? "#ef4444" : "#eab308",
                      fontSize: 10,
                      fontWeight: 400,
                    }}
                  >
                    ⊘ {reason}
                  </span>
                ))}
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
                    setEditLanguage(s.language === "Unknown" ? "" : s.language);
                  }}
                  style={{ padding: "3px 8px", background: "#1a1a1a", color: "#888", border: "1px solid #333", borderRadius: 4, cursor: "pointer", fontSize: 11 }}
                >
                  Edit
                </button>
                {s.tag_source !== "auto_plus_manual" && (
                  <button
                    onClick={() => approveSong(s.id)}
                    title="Mark as human-reviewed — bypasses the low-confidence hard filter in recommendations"
                    style={{ padding: "3px 8px", background: "#1a1a1a", color: "#22c55e", border: "1px solid #333", borderRadius: 4, cursor: "pointer", fontSize: 11 }}
                  >
                    Approve
                  </button>
                )}
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
