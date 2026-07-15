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

import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

export interface GenerateShareVideoInput {
  photoBytes: Buffer;
  previewUrl: string;
  startSeconds: number;
}

/**
 * Combines a still photo with a trimmed audio clip into an MP4 sized for
 * Instagram Stories, via a temporary directory and a spawned ffmpeg
 * process. Requires a real ffmpeg binary — no automated test; verified
 * manually (Step 4 below) and again against the deployed route in Task 7.
 */
export async function generateShareVideo({
  photoBytes,
  previewUrl,
  startSeconds,
}: GenerateShareVideoInput): Promise<Buffer> {
  const plan = buildShareVideoPlan(startSeconds);
  const dir = await mkdtemp(join(tmpdir(), "vibesong-share-"));
  const photoPath = join(dir, "photo.jpg");
  const outputPath = join(dir, "output.mp4");

  try {
    await writeFile(photoPath, photoBytes);

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(photoPath)
        .inputOptions(plan.photoInputOptions)
        .input(previewUrl)
        .inputOptions(plan.audioInputOptions)
        .outputOptions(plan.outputOptions)
        .on("end", () => resolve())
        .on("error", (err) => reject(err instanceof Error ? err : new Error(String(err))))
        .save(outputPath);
    });

    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
