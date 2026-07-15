export interface ShareVideoPlan {
  width: number;
  height: number;
  durationSeconds: number;
  scaleCropFilter: string;
  photoInputOptions: string[];
  audioInputOptions: string[];
  outputOptions: string[];
}

/**
 * Pure construction of the ffmpeg option arrays for combining a still photo
 * with a trimmed audio clip into a 1080x1920, 15-second MP4. No process
 * spawning or file I/O here — that's generateShareVideo (same file, added
 * in the next task), which needs a real ffmpeg binary and has no
 * automated test. This stays pure so the option-building logic is
 * verified without needing ffmpeg installed in the test environment.
 */
export function buildShareVideoPlan(startSeconds: number): ShareVideoPlan {
  const width = 1080;
  const height = 1920;
  const durationSeconds = 15;
  const scaleCropFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
  const safeStart = Math.max(0, startSeconds);

  return {
    width,
    height,
    durationSeconds,
    scaleCropFilter,
    photoInputOptions: ["-loop", "1"],
    audioInputOptions: ["-ss", String(safeStart)],
    outputOptions: [
      "-vf", scaleCropFilter,
      "-c:v", "libx264",
      "-tune", "stillimage",
      "-c:a", "aac",
      "-b:a", "128k",
      "-pix_fmt", "yuv420p",
      "-shortest",
      "-t", String(durationSeconds),
      "-movflags", "+faststart",
    ],
  };
}
