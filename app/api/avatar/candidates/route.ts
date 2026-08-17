import { fal } from "@fal-ai/client";
import fs from "fs/promises";
import path from "path";
import { SMILE_PROMPT } from "@/lib/avatarPrompts";

const MODEL = "fal-ai/gemini-25-flash-image/edit";

export async function POST(request: Request) {
  const formData = await request.formData();
  const selfie = formData.get("selfie");
  if (!(selfie instanceof Blob)) {
    return Response.json({ error: "missing selfie" }, { status: 400 });
  }

  fal.config({ credentials: process.env.FAL_KEY });

  try {
    const templateBuffer = await fs.readFile(path.join(process.cwd(), "assets/avatar-template.jpg"));
    const [selfieUrl, templateUrl] = await Promise.all([
      fal.storage.upload(selfie),
      fal.storage.upload(new Blob([new Uint8Array(templateBuffer)], { type: "image/jpeg" })),
    ]);

    const result = await fal.subscribe(MODEL, {
      input: {
        prompt: SMILE_PROMPT,
        image_urls: [selfieUrl, templateUrl],
        num_images: 4,
        aspect_ratio: "3:4",
        output_format: "png",
      },
      logs: true,
    });

    const images = (result.data.images as { url: string }[]).map((i) => i.url);
    return Response.json({ images });
  } catch (err) {
    console.error("avatar candidates generation failed", err);
    return Response.json({ error: "generation_failed" }, { status: 502 });
  }
}
