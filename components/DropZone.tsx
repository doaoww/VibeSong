"use client";
import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import exifr from "exifr";
import type { ExifData } from "../store/useAppStore";

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
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      const base64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
      resolve({ base64, objectUrl });
    };
    video.onerror = reject;
    video.load();
  });
}

async function fileToBase64(
  file: File
): Promise<{ base64: string; objectUrl: string }> {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve({ base64: result.split(",")[1], objectUrl });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DropZone({ onImageReady, disabled = false }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
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
      try {
        const [{ base64, objectUrl }, exifData] = await Promise.all([
          isVideo ? extractVideoFrame(file) : fileToBase64(file),
          isVideo ? Promise.resolve({} as ExifData) : extractExif(file),
        ]);
        onImageReady(base64, isVideo ? "image/jpeg" : file.type, objectUrl, exifData);
      } catch {
        setError("Failed to process file. Please try another.");
      }
    },
    [onImageReady]
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
        whileTap={disabled ? undefined : { scale: 0.98 }}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={disabled ? undefined : onDrop}
        onClick={() => { if (!disabled) inputRef.current?.click(); }}
        className={`dashed-upload-border rounded-2xl p-6 flex flex-col items-center text-center gap-4 transition-all duration-300 ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : isDragging
            ? "bg-hot-pink/10 cursor-pointer"
            : "bg-surface-container-low/50 hover:bg-surface-container/60 cursor-pointer"
        }`}
      >
        <div className="w-14 h-14 bg-hot-pink/15 rounded-full flex items-center justify-center">
          <span className="material-symbols-outlined text-hot-pink text-3xl">
            add_photo_alternate
          </span>
        </div>
        <div>
          <p className="font-display font-bold text-white text-base">
            Drop your photo or video
          </p>
          <p className="text-on-surface-variant text-xs mt-1">
            JPG, PNG, MP4 · Max 15MB
          </p>
        </div>
        <div className="flex gap-3 w-full">
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled && inputRef.current) {
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
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled && inputRef.current) {
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
