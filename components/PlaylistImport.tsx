"use client";
import { FormEvent, useState } from "react";
import { useTranslation } from "../lib/translations/useTranslation";

interface ImportedSong {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
}

interface ImportResponse {
  resolved: ImportedSong[];
  truncated: boolean;
  skipped: number;
  error?: string;
}

interface PlaylistImportProps {
  compact?: boolean;
  onImported?: (result: ImportResponse) => void;
  onManualFallback?: () => void;
}

type Status = "idle" | "reading" | "success" | "error";

export default function PlaylistImport({
  compact = false,
  onImported,
  onManualFallback,
}: PlaylistImportProps) {
  const t = useTranslation();
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);

  const importing = status === "reading";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setStatus("error");
      setError(t.playlistImport.emptyUrl);
      return;
    }

    setStatus("reading");
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/taste/import-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl }),
      });
      const data = (await res.json().catch(() => ({}))) as ImportResponse;
      if (!res.ok) {
        setStatus("error");
        setError(data.error ?? t.playlistImport.genericError);
        return;
      }

      setStatus("success");
      setResult(data);
      onImported?.(data);
    } catch {
      setStatus("error");
      setError(t.playlistImport.genericError);
    }
  };

  const addedCount = result?.resolved.length ?? 0;
  const totalCount = addedCount + (result?.skipped ?? 0);

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      {!compact && (
        <div>
          <h2 className="font-display font-bold text-white text-lg">
            {t.playlistImport.heading}
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            {t.playlistImport.subtitle}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block space-y-2">
          <span className="text-white/45 text-xs font-semibold uppercase tracking-wide">
            {t.playlistImport.urlLabel}
          </span>
          <input
            type="url"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              if (status === "error") {
                setStatus("idle");
                setError(null);
              }
            }}
            placeholder={t.playlistImport.placeholder}
            disabled={importing}
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-hot-pink transition-colors text-base disabled:opacity-60"
          />
        </label>

        <button
          type="submit"
          disabled={importing}
          className="w-full py-3.5 rounded-xl bg-hot-pink text-white font-display font-bold text-base active:scale-95 transition-all disabled:opacity-60 glow-pink"
        >
          {importing ? t.playlistImport.reading : t.playlistImport.importLabel}
        </button>
      </form>

      {status === "success" && result && (
        <div className="rounded-xl border border-hot-pink/25 bg-hot-pink/10 p-4 space-y-2">
          <p className="text-white text-sm font-semibold">
            {totalCount > 0
              ? t.playlistImport.addedCount(addedCount, totalCount)
              : t.playlistImport.noSongsAdded}
          </p>
          {result.truncated && (
            <p className="text-white/55 text-xs">
              {t.playlistImport.truncated}
            </p>
          )}
          {result.skipped > 0 && (
            <p className="text-white/55 text-xs">
              {t.playlistImport.skipped(result.skipped)}
            </p>
          )}
        </div>
      )}

      {status === "reading" && (
        <p className="text-on-surface-variant text-sm">
          {t.playlistImport.reading}
        </p>
      )}

      {status === "error" && error && (
        <div className="rounded-xl border border-error/30 bg-error/10 p-4 space-y-3">
          <p role="alert" className="text-error text-sm">
            {error}
          </p>
          {onManualFallback && (
            <button
              type="button"
              onClick={onManualFallback}
              className="text-hot-pink text-sm font-semibold hover:underline"
            >
              {t.playlistImport.manualFallback}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

