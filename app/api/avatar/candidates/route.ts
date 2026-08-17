import { fal } from "@fal-ai/client";
import fs from "fs/promises";
import path from "path";
import { SMILE_PROMPT } from "@/lib/avatarPrompts";

const MODEL = "fal-ai/gemini-3-pro-image-preview/edit";

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
        // SMILE_PROMPT defines "Image 1" as the identity-less structural template and
        // "Image 2" as the sole person reference -- image_urls order IS that numbering, so
        // template must come first. Getting this backwards (selfie first) means the model
        // reads the user's own photo as the no-identity structure reference and the blank
        // gray template as "the person," directly contradicting every instruction in the
        // prompt -- a likely cause of inconsistent/degraded generation quality.
        image_urls: [templateUrl, selfieUrl],
        num_images: 4,
        aspect_ratio: "3:4",
        output_format: "png",
        resolution: "1K",
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
