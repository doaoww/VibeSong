"use client";
import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import exifr from "exifr";
import type { ExifData } from "../store/useAppStore";
import { compressImageFile, compressThumbnail } from "../lib/imageCompression";
import Icon from "./Icon";

interface DropZoneProps {
  onImageReady: (
    base64: string,
    mimeType: string,
    objectUrl: string,
    exifData: ExifData,
    thumbnailDataUrl: string
  ) => void;
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
      const isImage = file.type.startsWith("image/");
      if (!isImage) {
        setError("Only JPG or PNG files supported.");
        return;
      }
      setIsProcessing(true);
      try {
        const objectUrl = URL.createObjectURL(file);
        const [compressed, thumbnailDataUrl, exifData] = await Promise.all([
          compressImageFile(file),
          compressThumbnail(file),
          extractExif(file),
        ]);

        const requestBodyBytes = compressed.base64.length; // JSON-stringified base64 chars ≈ transmitted bytes for this field
        console.log("[DropZone] image upload prepared:", {
          original: `${compressed.originalWidth}x${compressed.originalHeight} (${(compressed.originalBytes / 1024).toFixed(0)}KB)`,
          compressed: `${compressed.compressedWidth}x${compressed.compressedHeight} (${(compressed.compressedBytes / 1024).toFixed(0)}KB)`,
          estRequestBodySize: `${(requestBodyBytes / 1024 / 1024).toFixed(2)}MB`,
        });

        onImageReady(compressed.base64, compressed.mimeType, objectUrl, exifData, thumbnailDataUrl);
      } catch (err) {
        console.error("[DropZone] file processing failed:", err);
        setError("Couldn't prepare that file for upload. Please try another photo.");
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
          <Icon
            name={isProcessing ? "progress_activity" : "add_photo_alternate"}
            className={`text-hot-pink text-3xl ${isProcessing ? "animate-spin" : ""}`}
          />
        </div>
        <div>
          <p className="font-display font-bold text-white text-base">
            {isProcessing ? "Preparing your photo..." : "Drop your photo"}
          </p>
          <p className="text-on-surface-variant text-xs mt-1">
            {isProcessing ? "Resizing for upload, just a moment" : "JPG, PNG · Max 15MB"}
          </p>
        </div>
        <div className="flex gap-3 w-full">
          <button
            type="button"
            disabled={isBusy}
            onClick={(e) => {
              e.stopPropagation();
              if (!isBusy && inputRef.current) {
                inputRef.current.click();
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 bg-hot-pink text-white px-4 py-3 rounded-full text-sm font-semibold font-display hover:bg-[#ff4488] active:scale-95 transition-all glow-pink disabled:pointer-events-none"
          >
            <Icon name="photo_camera" className="text-[18px]" />
            Photo
          </button>
        </div>
      </motion.div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
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
