"use client";
import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import exifr from "exifr";
import type { ExifData } from "../store/useAppStore";
import { compressImageFile } from "../lib/imageCompression";

interface DropZoneProps {
  onImageReady: (base64: string, mimeType: string, objectUrl: string, exifData: ExifData) => void;
  disabled?: boolean;
}

async function extractExif(file: File): Promise<ExifData> {
  try {
    const parsed = await exifr.parse(file, { pick: ["DateTimeOriginal", "GPSLatitude", "GPSLongitude"] });
    if (!parsed) return {};
    const dt = parsed.DateTimeOriginal;
    return {
      capturedHour: dt instanceof Date ? dt.getHours() : undefined,
      capturedMonth: dt instanceof Date ? dt.getMonth() + 1 : undefined,
      latitude: typeof parsed.GPSLatitude === "number" ? parsed.GPSLatitude : undefined,
      longitude: typeof parsed.GPSLongitude === "number" ? parsed.GPSLongitude : undefined,
    };
  } catch {
    return {};
  }
}

const MAX_SIZE = 15 * 1024 * 1024;

// Same ceiling as lib/imageCompression.ts — 4K+ video frames can be just as
// large as an uncompressed photo, so the same defense applies here.
const MAX_VIDEO_FRAME_DIMENSION = 1600;

async function extractVideoFrame(
  file: File
): Promise<{ base64: string; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.currentTime = 1;
    video.onseeked = () => {
      const nativeWidth = video.videoWidth || 1280;
      const nativeHeight = video.videoHeight || 720;
      const scale = Math.min(1, MAX_VIDEO_FRAME_DIMENSION / Math.max(nativeWidth, nativeHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(nativeWidth * scale));
      canvas.height = Math.max(1, Math.round(nativeHeight * scale));
      canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
      resolve({ base64, objectUrl });
    };
    video.onerror = reject;
    video.load();
  });
}

export default function DropZone({ onImageReady, disabled = false }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isBusy = disabled || isProcessing;

  const handleFile = useCallback(
    async (file: File) => {
      // Guard against double-submit: ignore a second file while the first is still compressing.
      if (isProcessing) return;
      setError(null);
      if (file.size > MAX_SIZE) {
        setError("File too large. Max 15MB.");
        return;
      }
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) {
        setError("Only JPG, PNG, or MP4 files supported.");
        return;
      }
      setIsProcessing(true);
      try {
        if (isVideo) {
          const [{ base64, objectUrl }, exifData] = await Promise.all([
            extractVideoFrame(file),
            Promise.resolve({} as ExifData),
          ]);
          onImageReady(base64, "image/jpeg", objectUrl, exifData);
          return;
        }

        const objectUrl = URL.createObjectURL(file);
        const [compressed, exifData] = await Promise.all([
          compressImageFile(file),
          extractExif(file),
        ]);

        const requestBodyBytes = compressed.base64.length; // JSON-stringified base64 chars ≈ transmitted bytes for this field
        console.log("[DropZone] image upload prepared:", {
          original: `${compressed.originalWidth}x${compressed.originalHeight} (${(compressed.originalBytes / 1024).toFixed(0)}KB)`,
          compressed: `${compressed.compressedWidth}x${compressed.compressedHeight} (${(compressed.compressedBytes / 1024).toFixed(0)}KB)`,
          estRequestBodySize: `${(requestBodyBytes / 1024 / 1024).toFixed(2)}MB`,
        });

        onImageReady(compressed.base64, compressed.mimeType, objectUrl, exifData);
      } catch (err) {
        console.error("[DropZone] file processing failed:", err);
        setError("Couldn't prepare that file for upload. Please try another photo or video.");
      } finally {
        setIsProcessing(false);
      }
    },
    [onImageReady, isProcessing]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div>
      <motion.div
        whileTap={isBusy ? undefined : { scale: 0.98 }}
        onDragOver={(e) => {
          if (isBusy) return;
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={isBusy ? undefined : onDrop}
        onClick={() => { if (!isBusy) inputRef.current?.click(); }}
        className={`dashed-upload-border rounded-2xl p-6 flex flex-col items-center text-center gap-4 transition-all duration-300 ${
          isBusy
            ? "opacity-50 cursor-not-allowed"
            : isDragging
            ? "bg-hot-pink/10 cursor-pointer"
            : "bg-surface-container-low/50 hover:bg-surface-container/60 cursor-pointer"
        }`}
      >
        <div className="w-14 h-14 bg-hot-pink/15 rounded-full flex items-center justify-center">
          <span
            className={`material-symbols-outlined text-hot-pink text-3xl ${isProcessing ? "animate-spin" : ""}`}
          >
            {isProcessing ? "progress_activity" : "add_photo_alternate"}
          </span>
        </div>
        <div>
          <p className="font-display font-bold text-white text-base">
            {isProcessing ? "Preparing your photo..." : "Drop your photo or video"}
          </p>
          <p className="text-on-surface-variant text-xs mt-1">
            {isProcessing ? "Resizing for upload, just a moment" : "JPG, PNG, MP4 · Max 15MB"}
          </p>
        </div>
        <div className="flex gap-3 w-full">
          <button
            type="button"
            disabled={isBusy}
            onClick={(e) => {
              e.stopPropagation();
              if (!isBusy && inputRef.current) {
                inputRef.current.accept = "image/*";
                inputRef.current.click();
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 bg-hot-pink text-white px-4 py-3 rounded-full text-sm font-semibold font-display hover:bg-[#ff4488] active:scale-95 transition-all glow-pink disabled:pointer-events-none"
          >
            <span className="material-symbols-outlined text-[18px]">
              photo_camera
            </span>
            Photo
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={(e) => {
              e.stopPropagation();
              if (!isBusy && inputRef.current) {
                inputRef.current.accept = "video/*";
                inputRef.current.click();
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 border border-white/25 text-white px-4 py-3 rounded-full text-sm font-semibold font-display hover:border-white/50 active:scale-95 transition-all disabled:pointer-events-none"
          >
            <span className="material-symbols-outlined text-[18px]">movie</span>
            Video
          </button>
        </div>
      </motion.div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {error && (
        <p className="text-error text-xs mt-2 text-center">{error}</p>
      )}
    </div>
  );
}
