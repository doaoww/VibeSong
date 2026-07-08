// Client-only: downscales/compresses a photo before it's base64-encoded and
// POSTed to /api/analyze. Vercel enforces a hard, non-configurable 4.5MB
// request body limit on serverless functions (returns 413 before our route
// handler even runs) — full-resolution phone photos (routinely 2-8MB as JPEG)
// blow past that once base64 inflates them ~33%. This guarantees the output
// stays well under that ceiling regardless of input size/resolution.

const MAX_DIMENSION = 1600;
const TARGET_BYTES = 1.5 * 1024 * 1024; // 1.5MB — leaves generous margin under the 4.5MB wall after base64 inflation
const QUALITY_STEPS = [0.82, 0.7, 0.6, 0.5];
const MIN_DIMENSION = 640;

const THUMBNAIL_MAX_DIMENSION = 240;
const THUMBNAIL_QUALITY = 0.6;

export interface CompressionResult {
  base64: string;
  mimeType: string;
  originalWidth: number;
  originalHeight: number;
  originalBytes: number;
  compressedWidth: number;
  compressedHeight: number;
  compressedBytes: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))),
      "image/jpeg",
      quality
    );
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function drawAtDimension(img: HTMLImageElement, maxDimension: number): HTMLCanvasElement {
  const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

/** Compresses an image file client-side, iterating quality/dimension until under TARGET_BYTES. */
export async function compressImageFile(file: File): Promise<CompressionResult> {
  const img = await loadImage(file);
  const originalWidth = img.naturalWidth;
  const originalHeight = img.naturalHeight;

  let maxDimension = MAX_DIMENSION;
  let bestBlob: Blob | null = null;
  let bestWidth = originalWidth;
  let bestHeight = originalHeight;

  outer: while (maxDimension >= MIN_DIMENSION) {
    const canvas = drawAtDimension(img, maxDimension);
    for (const quality of QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, quality);
      bestBlob = blob;
      bestWidth = canvas.width;
      bestHeight = canvas.height;
      if (blob.size <= TARGET_BYTES) break outer;
    }
    maxDimension = Math.round(maxDimension * 0.8);
  }

  if (!bestBlob) throw new Error("Image compression produced no output");

  const base64 = await blobToBase64(bestBlob);

  return {
    base64,
    mimeType: "image/jpeg",
    originalWidth,
    originalHeight,
    originalBytes: file.size,
    compressedWidth: bestWidth,
    compressedHeight: bestHeight,
    compressedBytes: bestBlob.size,
  };
}

/**
 * Small, self-contained thumbnail for saved/skipped song history
 * (`Track.sourceImage`). Deliberately separate from compressImageFile()'s
 * ~1.5MB output: that size is fine for a single GPT-4o request but would
 * bloat every saved-song row and balloon /api/feedback's response if reused
 * here. Returns a ready-to-use data: URL (unlike compressImageFile's bare
 * base64) so it works as-is wherever a blob:/http URL would have gone.
 */
export async function compressThumbnail(file: File): Promise<string> {
  const img = await loadImage(file);
  const canvas = drawAtDimension(img, THUMBNAIL_MAX_DIMENSION);
  const blob = await canvasToBlob(canvas, THUMBNAIL_QUALITY);
  const base64 = await blobToBase64(blob);
  return `data:image/jpeg;base64,${base64}`;
}
