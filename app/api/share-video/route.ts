import { NextRequest, NextResponse } from "next/server";
import { generateShareVideo } from "../../../lib/generateShareVideo";

export const runtime = "nodejs";
// Video generation involves fetching a remote audio URL and running ffmpeg
// end-to-end — comfortably longer than a typical API response, so this
// needs an explicit budget the same way app/api/analyze/route.ts does.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const photo = formData.get("photo");
  const previewUrl = formData.get("previewUrl");
  const startSecondsRaw = formData.get("startSeconds");

  if (!(photo instanceof File) || typeof previewUrl !== "string" || !previewUrl) {
    return NextResponse.json({ error: "Missing photo or previewUrl" }, { status: 400 });
  }

  const startSeconds = typeof startSecondsRaw === "string" ? Number(startSecondsRaw) || 0 : 0;

  try {
    const photoBytes = Buffer.from(await photo.arrayBuffer());
    const videoBytes = await generateShareVideo({ photoBytes, previewUrl, startSeconds });
    return new NextResponse(new Uint8Array(videoBytes), {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="vibesong-story.mp4"',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Video generation failed" },
      { status: 500 }
    );
  }
}
