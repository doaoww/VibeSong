export interface ShareCardLayout {
  width: number;
  height: number;
  gradientStartY: number;
  gradientEndY: number;
  plate: { x: number; y: number; width: number; height: number; radius: number };
  artwork: { x: number; y: number; size: number };
  title: { x: number; y: number; maxWidth: number };
  artist: { x: number; y: number; maxWidth: number };
}

/**
 * Lays out a 9:16 "music sticker" card: photo fills the frame, a rounded
 * plate sits near the bottom holding a square artwork thumbnail with the
 * track title/artist beside it. Pure math only — no canvas/DOM here so this
 * stays unit-testable; drawing happens in generateShareCardImage (Task 2).
 */
export function computeShareCardLayout(width = 1080, height = 1920): ShareCardLayout {
  const margin = Math.round(width * 0.06);
  const plateHeight = Math.round(height * 0.11);
  const plateWidth = width - margin * 2;
  const plateY = height - margin * 2 - plateHeight;
  const artworkPadding = Math.round(plateHeight * 0.14);
  const artworkSize = plateHeight - artworkPadding * 2;
  const artworkX = margin + artworkPadding;
  const artworkY = plateY + artworkPadding;
  const textX = artworkX + artworkSize + artworkPadding;
  const textMaxWidth = margin + plateWidth - artworkPadding - textX;

  return {
    width,
    height,
    gradientStartY: Math.round(height * 0.55),
    gradientEndY: height,
    plate: {
      x: margin,
      y: plateY,
      width: plateWidth,
      height: plateHeight,
      radius: Math.round(plateHeight * 0.18),
    },
    artwork: { x: artworkX, y: artworkY, size: artworkSize },
    title: { x: textX, y: artworkY + Math.round(artworkSize * 0.1), maxWidth: textMaxWidth },
    artist: { x: textX, y: artworkY + Math.round(artworkSize * 0.58), maxWidth: textMaxWidth },
  };
}

/**
 * Shortens text to fit maxWidth using a caller-supplied measure function
 * (canvas's ctx.measureText in production, a trivial length-based stub in
 * tests) so the truncation logic itself stays DOM-free and testable.
 */
export function truncateToWidth(text: string, maxWidth: number, measure: (s: string) => number): string {
  if (measure(text) <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && measure(text.slice(0, end) + "…") > maxWidth) {
    end -= 1;
  }
  return text.slice(0, end) + "…";
}

export async function generateShareCardImage(
  track: { title: string; artist: string; artwork?: string; thumbnail: string },
  photoUrl: string
): Promise<Blob> {
  const layout = computeShareCardLayout();
  const photo = await loadImage(photoUrl, false);

  const blob = await renderCard(layout, track, photo, true);
  if (blob) return blob;

  // Cross-origin artwork tainted the canvas (CDN didn't send CORS headers) —
  // redraw without it instead of failing the whole share flow.
  const fallbackBlob = await renderCard(layout, track, photo, false);
  if (!fallbackBlob) throw new Error("Canvas toBlob failed");
  return fallbackBlob;
}

async function renderCard(
  layout: ShareCardLayout,
  track: { title: string; artist: string; artwork?: string; thumbnail: string },
  photo: HTMLImageElement,
  includeArtwork: boolean
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  drawCover(ctx, photo, layout.width, layout.height);

  const gradient = ctx.createLinearGradient(0, layout.gradientStartY, 0, layout.gradientEndY);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, layout.gradientStartY, layout.width, layout.gradientEndY - layout.gradientStartY);

  drawRoundedRectPath(ctx, layout.plate.x, layout.plate.y, layout.plate.width, layout.plate.height, layout.plate.radius);
  ctx.fillStyle = "rgba(17, 17, 17, 0.72)";
  ctx.fill();

  const artUrl = track.artwork || track.thumbnail;
  if (includeArtwork && artUrl) {
    try {
      const art = await loadImage(artUrl, true);
      ctx.save();
      drawRoundedRectPath(ctx, layout.artwork.x, layout.artwork.y, layout.artwork.size, layout.artwork.size, 16);
      ctx.clip();
      ctx.drawImage(art, layout.artwork.x, layout.artwork.y, layout.artwork.size, layout.artwork.size);
      ctx.restore();
    } catch {
      // Artwork failed to load at all (network error/404) — the plate still
      // renders fine with just the title/artist text.
    }
  }

  ctx.textBaseline = "top";
  ctx.fillStyle = "#F5F5F5";
  ctx.font = "700 44px Inter, sans-serif";
  ctx.fillText(
    truncateToWidth(track.title, layout.title.maxWidth, (s) => ctx.measureText(s).width),
    layout.title.x,
    layout.title.y
  );

  ctx.fillStyle = "#888888";
  ctx.font = "400 34px Inter, sans-serif";
  ctx.fillText(
    truncateToWidth(track.artist, layout.artist.maxWidth, (s) => ctx.measureText(s).width),
    layout.artist.x,
    layout.artist.y
  );

  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    } catch {
      resolve(null);
    }
  });
}

function loadImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, width: number, height: number) {
  const imgRatio = img.width / img.height;
  const targetRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  let offsetX = 0;
  let offsetY = 0;
  if (imgRatio > targetRatio) {
    drawHeight = height;
    drawWidth = height * imgRatio;
    offsetX = (width - drawWidth) / 2;
  } else {
    drawWidth = width;
    drawHeight = width / imgRatio;
    offsetY = (height - drawHeight) / 2;
  }
  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
