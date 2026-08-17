import type { AvatarGeometry } from "@/data/avatarGeometry";

// Client-side (Canvas 2D) port of the validated Python avatar-processing pipeline:
// flood-fill background removal, eye-pair/skin detection, global-width-max shoulder
// detection, lower-torso-corner arm-color sampling, and reference-eye-spacing scale +
// bottom-anchor placement onto a shared 720x1100 canvas. See data/avatarProfiles.ts for
// the same pipeline's Python equivalent (scripts/derive_avatar_profiles.py) run against
// the 9 preloaded characters -- this produces the identical AvatarGeometry shape at runtime
// for a user's own photo.

const CANVAS_W = 720;
const CANVAS_H = 1100;
// Fixed reference eye spacing every avatar is scaled to match, so head-scale stays
// consistent across avatars regardless of the source photo's own framing/zoom.
const REFERENCE_EYE_SPACING = 430.4103079376872 - 289.49388599449946;

type RGB = [number, number, number];

type Placement = { scaleFactor: number; offsetX: number; offsetY: number };

export type ProcessedSmileResult = {
  geometry: AvatarGeometry;
  pngDataUrl: string;
  placement: Placement;
};

export type ProcessedFrownResult = {
  pngDataUrl: string;
};

function rgbToHex([r, g, b]: RGB): number {
  return (r << 16) | (g << 8) | b;
}

function isNearWhite([r, g, b]: RGB): boolean {
  const mn = Math.min(r, g, b);
  const mx = Math.max(r, g, b);
  return mn > 205 && mx - mn < 20;
}

/** BFS flood fill from every border pixel, clearing alpha wherever the color is within
 *  `tolerance` of the sampled corner background color -- a typed-array queue with
 *  read/write indices (not Array.push/shift) keeps this fast at ~792,000 pixels (720x1100).
 *  Visited is marked at PUSH time (not pop time) so each pixel is enqueued at most once,
 *  keeping the queue's fixed Int32Array sized to exactly width*height. */
function floodRemoveBackground(data: Uint8ClampedArray, width: number, height: number, tolerance = 10) {
  const bg: RGB = [data[0], data[1], data[2]];
  const n = width * height;
  const visited = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const tryPush = (idx: number) => {
    if (!visited[idx]) {
      visited[idx] = 1;
      queue[tail++] = idx;
    }
  };
  for (let x = 0; x < width; x++) {
    tryPush(x);
    tryPush((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    tryPush(y * width);
    tryPush(y * width + width - 1);
  }
  const close = (r: number, g: number, b: number) =>
    Math.abs(r - bg[0]) <= tolerance && Math.abs(g - bg[1]) <= tolerance && Math.abs(b - bg[2]) <= tolerance;

  while (head < tail) {
    const idx = queue[head++];
    const p = idx * 4;
    if (!close(data[p], data[p + 1], data[p + 2])) continue;
    data[p + 3] = 0;
    const x = idx % width;
    const y = (idx / width) | 0;
    if (x + 1 < width) tryPush(idx + 1);
    if (x - 1 >= 0) tryPush(idx - 1);
    if (y + 1 < height) tryPush(idx + width);
    if (y - 1 >= 0) tryPush(idx - width);
  }
}

/** After floodRemoveBackground clears the connected background, some generated avatars
 *  still have residual pure-white fringing right at the edge of the hair silhouette
 *  (compositing artifacts from the original background removal that the tolerance-based
 *  pass didn't fully catch). This extends the transparency through any EXACTLY pure-white
 *  (255,255,255, no tolerance) pixel connected to the already-transparent region -- same
 *  border-BFS shape as floodRemoveBackground, just seeded from the transparent/opaque
 *  boundary instead of the image edge. Exact-match-only and connectivity-only (never a
 *  blanket "remove all white pixels" pass) means it can't reach interior pure-white
 *  features like the eyes' own blank sclera or teeth, since neither touches the
 *  already-transparent background. */
function maskConnectedPureWhite(data: Uint8ClampedArray, width: number, height: number) {
  const n = width * height;
  const visited = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const isPureWhite = (idx: number) => {
    const p = idx * 4;
    return data[p + 3] !== 0 && data[p] === 255 && data[p + 1] === 255 && data[p + 2] === 255;
  };
  const tryPush = (idx: number) => {
    if (!visited[idx] && isPureWhite(idx)) {
      visited[idx] = 1;
      queue[tail++] = idx;
    }
  };
  for (let idx = 0; idx < n; idx++) {
    if (data[idx * 4 + 3] !== 0) continue;
    const x = idx % width;
    const y = (idx / width) | 0;
    if (x + 1 < width) tryPush(idx + 1);
    if (x - 1 >= 0) tryPush(idx - 1);
    if (y + 1 < height) tryPush(idx + width);
    if (y - 1 >= 0) tryPush(idx - width);
  }
  while (head < tail) {
    const idx = queue[head++];
    data[idx * 4 + 3] = 0;
    const x = idx % width;
    const y = (idx / width) | 0;
    if (x + 1 < width) tryPush(idx + 1);
    if (x - 1 >= 0) tryPush(idx - 1);
    if (y + 1 < height) tryPush(idx + width);
    if (y - 1 >= 0) tryPush(idx - width);
  }
}

type AlphaBBox = { left: number; top: number; right: number; bottom: number };

/** Exclusive right/bottom, matching PIL's getbbox() convention (one past the last
 *  opaque pixel), since the rest of the pipeline was ported directly from that code. */
function computeAlphaBBox(data: Uint8ClampedArray, width: number, height: number): AlphaBBox {
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 20) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return { left, top, right: right + 1, bottom: bottom + 1 };
}

type Blob = { size: number; cx: number; cy: number; w: number; h: number };

type EyeDetection = {
  leftEye: Blob;
  rightEye: Blob;
  eyeSpacing: number;
  eyeCx: number;
  eyeCy: number;
  eyeScleraH: number;
  skinRgb: RGB;
};

const SKIN_BUCKET_BIN = 28;

function sampleDominantColor(data: Uint8ClampedArray, width: number, x0: number, x1: number, y0: number, y1: number): RGB {
  const buckets = new Map<string, { count: number; colors: Map<string, { count: number; rgb: RGB }> }>();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = (y * width + x) * 4;
      if (data[p + 3] <= 200) continue;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const bucketKey = `${(r / SKIN_BUCKET_BIN) | 0},${(g / SKIN_BUCKET_BIN) | 0},${(b / SKIN_BUCKET_BIN) | 0}`;
      let bucket = buckets.get(bucketKey);
      if (!bucket) {
        bucket = { count: 0, colors: new Map() };
        buckets.set(bucketKey, bucket);
      }
      bucket.count++;
      const colorKey = `${r},${g},${b}`;
      const existing = bucket.colors.get(colorKey);
      if (existing) existing.count++;
      else bucket.colors.set(colorKey, { count: 1, rgb: [r, g, b] });
    }
  }
  let bestBucket: { count: number; colors: Map<string, { count: number; rgb: RGB }> } | null = null;
  for (const bucket of buckets.values()) {
    if (!bestBucket || bucket.count > bestBucket.count) bestBucket = bucket;
  }
  if (!bestBucket) return [0, 0, 0];
  let bestColor: RGB = [0, 0, 0];
  let bestCount = -1;
  for (const c of bestBucket.colors.values()) {
    if (c.count > bestCount) {
      bestCount = c.count;
      bestColor = c.rgb;
    }
  }
  return bestColor;
}

/** Near-white blob BFS restricted to the top 60% of the opaque bbox, filtered to
 *  wide-than-tall blobs, best-scoring pair by size+vertical-alignment -- that pair is the
 *  two sclera whites. From it: eye spacing/center/sclera height, plus a cheek-patch skin
 *  color sample (eye-anchored, below and between the detected eyes). */
function detectEyesAndSkin(data: Uint8ClampedArray, width: number, bbox: AlphaBBox): EyeDetection {
  const { left, top, right, bottom } = bbox;
  const searchBottom = Math.floor(top + (bottom - top) * 0.6);
  const isWhite = new Uint8Array(width * searchBottom);
  for (let y = top; y < searchBottom; y++) {
    for (let x = left; x < right; x++) {
      const p = (y * width + x) * 4;
      if (data[p + 3] <= 200) continue;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const mn = Math.min(r, g, b);
      const mx = Math.max(r, g, b);
      if (mn > 195 && mx - mn < 40) isWhite[y * width + x] = 1;
    }
  }

  const visited = new Uint8Array(width * searchBottom);
  const queue = new Int32Array(width * searchBottom);
  const blobs: Blob[] = [];

  const tryVisit = (nx: number, ny: number, tail: number) => {
    if (nx < left || nx >= right || ny < top || ny >= searchBottom) return tail;
    const nidx = ny * width + nx;
    if (isWhite[nidx] && !visited[nidx]) {
      visited[nidx] = 1;
      queue[tail] = nidx;
      return tail + 1;
    }
    return tail;
  };

  for (let y = top; y < searchBottom; y++) {
    for (let x = left; x < right; x++) {
      const start = y * width + x;
      if (!isWhite[start] || visited[start]) continue;
      let head = 0;
      let tail = 0;
      visited[start] = 1;
      queue[tail++] = start;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let count = 0;
      let sumX = 0;
      let sumY = 0;
      while (head < tail) {
        const idx = queue[head++];
        const cx = idx % width;
        const cy = (idx / width) | 0;
        count++;
        sumX += cx;
        sumY += cy;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        tail = tryVisit(cx + 1, cy, tail);
        tail = tryVisit(cx - 1, cy, tail);
        tail = tryVisit(cx, cy + 1, tail);
        tail = tryVisit(cx, cy - 1, tail);
      }
      if (count > 30) {
        blobs.push({ size: count, cx: sumX / count, cy: sumY / count, w: maxX - minX, h: maxY - minY });
      }
    }
  }

  const candidates = blobs.filter((b) => b.w > b.h);
  let bestPair: [Blob, Blob] | null = null;
  let bestScore = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      const score = Math.abs(a.size - b.size) + Math.abs(a.cy - b.cy) * 5;
      if (score < bestScore) {
        bestScore = score;
        bestPair = [a, b];
      }
    }
  }
  if (!bestPair) throw new Error("avatarPipeline: could not detect an eye pair in this photo");
  const [eyeA, eyeB] = bestPair;
  const [leftEye, rightEye] = eyeA.cx < eyeB.cx ? [eyeA, eyeB] : [eyeB, eyeA];
  const eyeSpacing = rightEye.cx - leftEye.cx;
  const eyeCx = (leftEye.cx + rightEye.cx) / 2;
  const eyeCy = (leftEye.cy + rightEye.cy) / 2;
  const eyeScleraH = (leftEye.h + rightEye.h) / 2;

  const skinCx = eyeCx;
  const skinCy = eyeCy + eyeSpacing * 0.45;
  const skinHalf = Math.max(6, Math.floor(eyeSpacing * 0.06));
  const skinRgb = sampleDominantColor(
    data,
    width,
    Math.floor(skinCx - skinHalf),
    Math.floor(skinCx + skinHalf),
    Math.floor(skinCy - skinHalf),
    Math.floor(skinCy + skinHalf)
  );

  return { leftEye, rightEye, eyeSpacing, eyeCx, eyeCy, eyeScleraH, skinRgb };
}

type ShoulderRow = { y: number; left: number; right: number };

/** The shoulder is the single widest row of the avatar's own silhouette, full stop --
 *  no search window, no heuristics. See scripts/derive_avatar_profiles.py's Python
 *  equivalent, verified against multiple avatars' hand-measured ground truth. */
function findShoulderRow(data: Uint8ClampedArray, width: number, height: number): ShoulderRow | null {
  let best: ShoulderRow & { width: number } = { y: 0, left: 0, right: 0, width: -1 };
  for (let y = 0; y < height; y += 2) {
    let minX = -1;
    let maxX = -1;
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 20) {
        if (minX === -1) minX = x;
        maxX = x;
      }
    }
    if (minX !== -1) {
      const w = maxX - minX;
      if (w > best.width) best = { y, left: minX, right: maxX, width: w };
    }
  }
  return best.width >= 0 ? best : null;
}

/** Samples at the LOWER corners of the torso (near the canvas bottom), not the shoulder --
 *  a short sleeve can still cover the shoulder (the widest row) while the lower torso is
 *  already bare skin. Falls back to skinRgb if the raw sample reads near-white (a plain
 *  light base layer, not real fabric coverage). */
function sampleArmColor(data: Uint8ClampedArray, width: number, height: number, anchorBottomY: number, skinRgb: RGB): RGB {
  const sampleY = Math.min(height - 1, Math.floor(anchorBottomY) - 25);
  const sampleSide = (fromLeft: boolean): RGB | null => {
    let edge = -1;
    if (fromLeft) {
      for (let x = 0; x < width; x++) {
        if (data[(sampleY * width + x) * 4 + 3] > 200) {
          edge = x;
          break;
        }
      }
    } else {
      for (let x = width - 1; x >= 0; x--) {
        if (data[(sampleY * width + x) * 4 + 3] > 200) {
          edge = x;
          break;
        }
      }
    }
    if (edge === -1) return null;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let count = 0;
    for (let dx = 0; dx < 14; dx++) {
      const xx = fromLeft ? edge + dx : edge - dx;
      for (let dy = -4; dy <= 4; dy++) {
        const yy = sampleY + dy;
        if (xx < 0 || xx >= width || yy < 0 || yy >= height) continue;
        const p = (yy * width + xx) * 4;
        if (data[p + 3] > 200) {
          sumR += data[p];
          sumG += data[p + 1];
          sumB += data[p + 2];
          count++;
        }
      }
    }
    if (count === 0) return null;
    return [(sumR / count) | 0, (sumG / count) | 0, (sumB / count) | 0];
  };
  const left = sampleSide(true);
  const right = sampleSide(false);
  let sample: RGB | null = left && right ? [((left[0] + right[0]) / 2) | 0, ((left[1] + right[1]) / 2) | 0, ((left[2] + right[2]) / 2) | 0] : left || right;
  if (!sample || isNearWhite(sample)) sample = skinRgb;
  return sample;
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("avatarPipeline: 2D canvas context unavailable");
  return { canvas, ctx };
}

/** Runs background removal + eye/shoulder/color detection on a freshly-generated smile
 *  image, producing the same AvatarGeometry shape as the preloaded-character table, plus
 *  a processed transparent PNG scaled/bottom-anchored onto the shared 720x1100 canvas.
 *  Returns `placement` so processFrownImage can reuse the exact same scale/offset. */
export async function processSmileImage(img: HTMLImageElement, irisColor: number): Promise<ProcessedSmileResult> {
  const { canvas: srcCanvas, ctx: srcCtx } = makeCanvas(img.naturalWidth, img.naturalHeight);
  srcCtx.drawImage(img, 0, 0);
  const srcImageData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  floodRemoveBackground(srcImageData.data, srcCanvas.width, srcCanvas.height, 10);
  maskConnectedPureWhite(srcImageData.data, srcCanvas.width, srcCanvas.height);
  srcCtx.putImageData(srcImageData, 0, 0);

  const bbox = computeAlphaBBox(srcImageData.data, srcCanvas.width, srcCanvas.height);
  const eyes = detectEyesAndSkin(srcImageData.data, srcCanvas.width, bbox);

  const scaleFactor = REFERENCE_EYE_SPACING / eyes.eyeSpacing;
  const newW = Math.max(1, Math.round(srcCanvas.width * scaleFactor));
  const newH = Math.max(1, Math.round(srcCanvas.height * scaleFactor));
  const resizedCx = eyes.eyeCx * scaleFactor;
  const resizedBottom = bbox.bottom * scaleFactor;
  const offsetX = Math.round(CANVAS_W / 2 - resizedCx);
  // Bottom-anchor: the photo's own content bbox-bottom lands exactly at the canvas's own
  // bottom row -- never crop, never anchor by eye position (see MainScene.ts's arm system,
  // which depends on this convention for every avatar).
  const offsetY = Math.round(CANVAS_H - resizedBottom);

  const { canvas: outCanvas, ctx: outCtx } = makeCanvas(CANVAS_W, CANVAS_H);
  outCtx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, offsetX, offsetY, newW, newH);

  const outImageData = outCtx.getImageData(0, 0, CANVAS_W, CANVAS_H);
  const shoulder = findShoulderRow(outImageData.data, CANVAS_W, CANVAS_H);
  if (!shoulder) throw new Error("avatarPipeline: could not detect a shoulder row in this photo");
  const armColorRgb = sampleArmColor(outImageData.data, CANVAS_W, CANVAS_H, CANVAS_H, eyes.skinRgb);

  const toGameSpace = (px: number, py: number): [number, number] => [px * scaleFactor + offsetX, py * scaleFactor + offsetY];
  const [leftEyeX, leftEyeY] = toGameSpace(eyes.leftEye.cx, eyes.leftEye.cy);
  const [rightEyeX, rightEyeY] = toGameSpace(eyes.rightEye.cx, eyes.rightEye.cy);
  const scleraHeightLocal = (eyes.eyeScleraH * scaleFactor) / 2;

  const geometry: AvatarGeometry = {
    eyeLocal: {
      left: { x: leftEyeX / 2, y: leftEyeY / 2 },
      right: { x: rightEyeX / 2, y: rightEyeY / 2 },
    },
    scleraHeightLocal,
    shoulderLocal: {
      left: { x: shoulder.left / 2, y: shoulder.y / 2 },
      right: { x: shoulder.right / 2, y: shoulder.y / 2 },
    },
    armColor: rgbToHex(armColorRgb),
    skinColor: rgbToHex(eyes.skinRgb),
    irisColor,
  };

  return {
    geometry,
    pngDataUrl: outCanvas.toDataURL("image/png"),
    placement: { scaleFactor, offsetX, offsetY },
  };
}

/** Background removal + placement only, reusing the smile pass's own placement -- the
 *  frown/eyes-closed image has nothing left to detect (eyes are closed), and reusing the
 *  same scale/offset keeps both images in identical alignment. */
export async function processFrownImage(img: HTMLImageElement, placement: Placement): Promise<ProcessedFrownResult> {
  const { canvas: srcCanvas, ctx: srcCtx } = makeCanvas(img.naturalWidth, img.naturalHeight);
  srcCtx.drawImage(img, 0, 0);
  const srcImageData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  floodRemoveBackground(srcImageData.data, srcCanvas.width, srcCanvas.height, 10);
  maskConnectedPureWhite(srcImageData.data, srcCanvas.width, srcCanvas.height);
  srcCtx.putImageData(srcImageData, 0, 0);

  const newW = Math.max(1, Math.round(srcCanvas.width * placement.scaleFactor));
  const newH = Math.max(1, Math.round(srcCanvas.height * placement.scaleFactor));

  const { canvas: outCanvas, ctx: outCtx } = makeCanvas(CANVAS_W, CANVAS_H);
  outCtx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, placement.offsetX, placement.offsetY, newW, newH);

  return { pngDataUrl: outCanvas.toDataURL("image/png") };
}

/** Shared entry point for every eye-detection consumer below (iris-presence check, iris-
 *  color sampling, overlay positioning) -- draws the image once, computes its bbox, and
 *  runs the same eye-pair detector used by the main pipeline. Returns null instead of
 *  throwing so callers can fall back gracefully (unusual framing, load error, a photo
 *  with no clear eye pair). */
async function detectEyeGeometry(img: HTMLImageElement): Promise<{ data: Uint8ClampedArray; width: number; height: number; eyes: EyeDetection } | null> {
  try {
    const { canvas, ctx } = makeCanvas(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const bbox = computeAlphaBBox(imageData.data, canvas.width, canvas.height);
    const eyes = detectEyesAndSkin(imageData.data, canvas.width, bbox);
    return { data: imageData.data, width: canvas.width, height: canvas.height, eyes };
  } catch {
    return null;
  }
}

function sampleAverageColorNear(data: Uint8ClampedArray, width: number, height: number, cx: number, cy: number, halfSize: number): RGB | null {
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;
  for (let y = cy - halfSize; y <= cy + halfSize; y++) {
    for (let x = cx - halfSize; x <= cx + halfSize; x++) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const p = (y * width + x) * 4;
      if (data[p + 3] <= 200) continue;
      sumR += data[p];
      sumG += data[p + 1];
      sumB += data[p + 2];
      count++;
    }
  }
  return count === 0 ? null : [(sumR / count) | 0, (sumG / count) | 0, (sumB / count) | 0];
}

/** Confidence level for whether a candidate still shows a visible iris/pupil despite the
 *  prompt's "blank white eyes" requirement -- Nano Banana doesn't follow that instruction
 *  100% of the time across all 4 outputs in a batch, so candidates need to be checked
 *  rather than trusted. "clean" found both eye blobs and neither shows a colored/dark
 *  center; "iris" found at least one eye with a colored/dark center; "unknown" means eye
 *  detection itself failed (unusual framing, load error) -- not confidently clean, but not
 *  confirmed to have an iris either. */
export type IrisCheck = "clean" | "iris" | "unknown";

/** Samples a small patch at each detected eye blob's own centroid -- a genuinely blank
 *  white/off-white eye (the eye-pair detector only connects near-white pixels in the
 *  first place) should read near-white at its center too, same as everywhere else in the
 *  blob. A visible iris/pupil leaves a colored or dark disc sitting in that same spot,
 *  which this catches directly rather than trying to infer it from the blob's outer shape. */
export async function checkIrisPresence(img: HTMLImageElement): Promise<IrisCheck> {
  const geo = await detectEyeGeometry(img);
  if (!geo) return "unknown";
  const { data, width, height, eyes } = geo;

  const eyeCenterHasIris = (eye: Blob): boolean => {
    const half = Math.max(2, Math.round(Math.min(eye.w, eye.h) * 0.2));
    let nonWhite = 0;
    let total = 0;
    for (let y = Math.round(eye.cy) - half; y <= Math.round(eye.cy) + half; y++) {
      for (let x = Math.round(eye.cx) - half; x <= Math.round(eye.cx) + half; x++) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        const p = (y * width + x) * 4;
        if (data[p + 3] <= 200) continue;
        total++;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const mn = Math.min(r, g, b);
        const mx = Math.max(r, g, b);
        if (!(mn > 195 && mx - mn < 40)) nonWhite++;
      }
    }
    if (total === 0) return false;
    return nonWhite / total > 0.5;
  };

  return eyeCenterHasIris(eyes.leftEye) || eyeCenterHasIris(eyes.rightEye) ? "iris" : "clean";
}

/** Samples the actual iris/pupil color from the ORIGINAL selfie (a real photo, so its eyes
 *  have a genuine visible iris, unlike the generated avatars which are prompted to have
 *  none) -- this is what determines the color used both for the animated eye-overlay
 *  preview on the selection screen and the final in-game avatar's procedural pupil, so the
 *  preview and the real thing always match. Returns null if no eye pair could be found
 *  (caller should fall back to a shared default). */
export async function detectIrisColor(img: HTMLImageElement): Promise<number | null> {
  const geo = await detectEyeGeometry(img);
  if (!geo) return null;
  const { data, width, height, eyes } = geo;
  const sampleEye = (eye: Blob) => {
    const half = Math.max(2, Math.round(Math.min(eye.w, eye.h) * 0.15));
    return sampleAverageColorNear(data, width, height, Math.round(eye.cx), Math.round(eye.cy), half);
  };
  const left = sampleEye(eyes.leftEye);
  const right = sampleEye(eyes.rightEye);
  const rgb: RGB | null = left && right ? [((left[0] + right[0]) / 2) | 0, ((left[1] + right[1]) / 2) | 0, ((left[2] + right[2]) / 2) | 0] : left || right;
  return rgb ? rgbToHex(rgb) : null;
}

/** Eye positions/size for a candidate thumbnail, as PERCENTAGES of the image's own
 *  dimensions (not pixels) -- so an overlay positioned with these percentages lines up
 *  correctly regardless of how large the <img> is actually displayed, as long as it isn't
 *  itself cropped relative to its natural aspect ratio (true here: candidates are already
 *  requested at the same 3:4 ratio the display frame uses). Both sclera dimensions are
 *  included (not just height) so the overlay can clip to a true ellipse matching the
 *  detected eye shape, the same way clipPupilToSclera in MainScene.ts crops the real
 *  in-game iris down to the sclera's own bounds instead of drawing an uncropped circle. */
export type EyeOverlayInfo = {
  left: { xPct: number; yPct: number };
  right: { xPct: number; yPct: number };
  scleraWidthPct: number;
  scleraHeightPct: number;
};

export async function detectEyeOverlayInfo(img: HTMLImageElement): Promise<EyeOverlayInfo | null> {
  const geo = await detectEyeGeometry(img);
  if (!geo) return null;
  const { width, height, eyes } = geo;
  const scleraWidth = (eyes.leftEye.w + eyes.rightEye.w) / 2;
  return {
    left: { xPct: (eyes.leftEye.cx / width) * 100, yPct: (eyes.leftEye.cy / height) * 100 },
    right: { xPct: (eyes.rightEye.cx / width) * 100, yPct: (eyes.rightEye.cy / height) * 100 },
    scleraWidthPct: (scleraWidth / width) * 100,
    scleraHeightPct: (eyes.eyeScleraH / height) * 100,
  };
}

/** Loads an image (URL or data URL) as an HTMLImageElement, waiting for full decode. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`avatarPipeline: failed to load image ${src.slice(0, 80)}`));
    img.src = src;
  });
}
