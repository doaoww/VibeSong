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
