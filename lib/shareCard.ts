export interface CoverFit {
  offsetX: number;
  offsetY: number;
  drawWidth: number;
  drawHeight: number;
}

/**
 * Computes draw offsets/dimensions to render a source image onto a canvas
 * with CSS object-fit: cover semantics — fills the frame edge-to-edge,
 * cropping whichever dimension overflows. Pure math only — canvas drawing
 * happens in generateShareCard (Task 2), which stays untested since it
 * needs a real DOM.
 */
export function computeCoverFit(
  imgWidth: number,
  imgHeight: number,
  canvasWidth: number,
  canvasHeight: number
): CoverFit {
  const imgRatio = imgWidth / imgHeight;
  const targetRatio = canvasWidth / canvasHeight;
  let drawWidth = canvasWidth;
  let drawHeight = canvasHeight;
  let offsetX = 0;
  let offsetY = 0;
  if (imgRatio > targetRatio) {
    drawHeight = canvasHeight;
    drawWidth = canvasHeight * imgRatio;
    offsetX = (canvasWidth - drawWidth) / 2;
  } else {
    drawWidth = canvasWidth;
    drawHeight = canvasWidth / imgRatio;
    offsetY = (canvasHeight - drawHeight) / 2;
  }
  return { offsetX, offsetY, drawWidth, drawHeight };
}

export async function generateShareCard(photoUrl: string): Promise<Blob> {
  const width = 1080;
  const height = 1920;
  const img = await loadImage(photoUrl);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const fit = computeCoverFit(img.width, img.height, width, height);
  ctx.drawImage(img, fit.offsetX, fit.offsetY, fit.drawWidth, fit.drawHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/png");
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}
