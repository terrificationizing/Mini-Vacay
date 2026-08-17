import { fal } from "@fal-ai/client";
import { FROWN_PROMPT } from "@/lib/avatarPrompts";

const MODEL = "fal-ai/gemini-3-pro-image-preview/edit";

export async function POST(request: Request) {
  const body = await request.json();
  const smileImageUrl = body?.smileImageUrl;
  if (typeof smileImageUrl !== "string") {
    return Response.json({ error: "missing smileImageUrl" }, { status: 400 });
  }

  fal.config({ credentials: process.env.FAL_KEY });

  try {
    const result = await fal.subscribe(MODEL, {
      input: {
        prompt: FROWN_PROMPT,
        image_urls: [smileImageUrl],
        num_images: 1,
        aspect_ratio: "3:4",
        output_format: "png",
        resolution: "1K",
      },
      logs: true,
    });

    const images = result.data.images as { url: string }[];
    return Response.json({ image: images[0].url });
  } catch (err) {
    console.error("avatar frown generation failed", err);
    return Response.json({ error: "generation_failed" }, { status: 502 });
  }
}
