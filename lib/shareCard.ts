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
