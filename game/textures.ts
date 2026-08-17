import Phaser from "phaser";
import { COLORS } from "./theme";
import { ITEM_SIZE } from "./items";

type G = Phaser.GameObjects.Graphics;

function circ(g: G, x: number, y: number, r: number, color: number, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillCircle(x, y, r);
}

function ellipse(g: G, x: number, y: number, w: number, h: number, color: number, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillEllipse(x, y, w, h);
}

function poly(g: G, pts: [number, number][], color: number, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillPoints(
    pts.map(([x, y]) => new Phaser.Math.Vector2(x, y)),
    true
  );
}

function shine(g: G, x: number, y: number, w: number, h: number) {
  ellipse(g, x, y, w, h, COLORS.white, 0.32);
}

// ---- Good items -------------------------------------------------------

// A small 4-point sparkle/glint, pulsed over the diamond ring's facet.
export const SPARKLE_SIZE = 64;

function drawSparkle(g: G, s: number) {
  const cx = s / 2;
  const cy = s / 2;
  const outerR = s * 0.5;
  const innerR = s * 0.16;
  const points: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  poly(g, points, COLORS.white, 0.95);
  circ(g, cx, cy, s * 0.12, COLORS.white, 0.9);
}

// ---- Bad items ----------------------------------------------------------


// ---- Player avatar eye pupils ----------------------------------------
// Every avatar's own art shows plain sclera white where the eyes are, leaving these as
// the only visible pupils — generated at a large base size and scaled down in MainScene
// for crisp downscaling, colored per-avatar (see applyAvatarProfile's irisColor).

export const EYE_PUPIL_SIZE = 64;
// The black pupil is sized off this UN-boosted fraction, so growing the iris below
// doesn't grow the pupil along with it -- they're independent, not proportional.
const EYE_PUPIL_BASE_FILL_RATIO = 0.72;
// The drawn iris circle fills this fraction of the texture's own canvas (leaving room
// around it so the "shine" highlight doesn't clip past the edge) -- setDisplaySize scales
// the whole texture, so callers sizing the iris to a specific visible diameter need to
// divide by this ratio, not use that diameter directly.
export const EYE_PUPIL_FILL_RATIO = EYE_PUPIL_BASE_FILL_RATIO * 1.1;

function drawEyePupil(g: G, s: number, color: number, pupilYOffsetFraction: number) {
  const irisRadius = (s * EYE_PUPIL_FILL_RATIO) / 2;
  circ(g, s / 2, s / 2, irisRadius, color);
  // The true black pupil, inside the colored iris -- drawn before the shine/catchlight so
  // both sit on top of it, not the other way around. Fixed size (not relative to the
  // iris radius above) so it doesn't grow along with the iris; 0.45 * 0.85 * 0.8 * 1.1 *
  // 1.2 * 1.2 = another 20% bigger on top of the previous adjustments.
  const pupilRadius = (s * EYE_PUPIL_BASE_FILL_RATIO * 0.45 * 0.85 * 0.8 * 1.1 * 1.2 * 1.2) / 2;
  // The iris is much taller than the sclera crop window that ends up showing it, so its
  // own center (where this would otherwise sit) is clipped away entirely -- offset down to
  // land inside the window instead (see PUPIL_TEXTURE_Y_OFFSET_FRACTION in MainScene.ts).
  const pupilCy = s / 2 + pupilYOffsetFraction * s;
  circ(g, s / 2, pupilCy, pupilRadius, 0x000000);
  // A small, sharp catchlight on the pupil itself (upper-right), distinct from the
  // broader, softer shine across the whole iris below.
  circ(g, s / 2 + pupilRadius * 0.35, pupilCy - pupilRadius * 0.3, pupilRadius * 0.45, COLORS.white, 1);
  shine(g, s * 0.4, s / 2 + pupilYOffsetFraction * s, s * 0.28, s * 0.24);
}

// A closed-eyelid patch, swapped in for the pupils during a periodic blink. Originally
// a thin dark line matching the pupil's own outline color -- but at the pupil's actual
// on-screen size (a few px tall once scaled down to sclera height), a thin stroke reads
// as basically nothing, so the blink looked like the iris simply vanishing to blank
// white sclera with nothing replacing it. A solid filled shape, generously sized and
// tinted to the avatar's own skin tone at blink time (see doBlink), reads as an eyelid
// actually closing over the eye regardless of exact size -- it doesn't depend on a
// stroke surviving being scaled down to a handful of pixels. Drawn white here so it can
// be tinted per avatar.
export const EYE_CLOSED_SIZE = { w: 96, h: 64 };

function drawEyeClosed(g: G) {
  const { w, h } = EYE_CLOSED_SIZE;
  ellipse(g, w / 2, h / 2, w * 0.94, h * 0.86, 0xffffff, 1);
}

// ---- Falling-item halo (soft dark shadow for contrast against the busy
// background). Uses normal alpha blending, not a Phaser MULTIPLY blend mode,
// because the plant background is a separate DOM layer behind the transparent
// canvas — a Phaser-internal blend mode only composites against other objects
// drawn on the same canvas (e.g. the suitcase/character), never against DOM
// content, so it wouldn't darken the background at all.
// -------------------------------------------------------------------------

export const ITEM_HALO_KEY = "item-halo";
export const ITEM_HALO_SIZE = 128;

function generateHaloTexture(scene: Phaser.Scene) {
  const size = ITEM_HALO_SIZE;
  const canvasTexture = scene.textures.createCanvas(ITEM_HALO_KEY, size, size)!;
  const ctx = canvasTexture.context;
  const cx = size / 2;
  const cy = size / 2;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  gradient.addColorStop(0, "rgba(0,0,0,0.22)");
  gradient.addColorStop(0.3, "rgba(0,0,0,0.15)");
  gradient.addColorStop(0.55, "rgba(0,0,0,0.08)");
  gradient.addColorStop(0.78, "rgba(0,0,0,0.03)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fill();
  canvasTexture.refresh();
}

// ---- Suitcase ground shadow --------------------------------------------
// A soft oval beneath the catcher that tracks it horizontally. Drawn as a round radial
// gradient (like the item halo above) and then stretched much wider than tall via
// setDisplaySize, which keeps the gradient's falloff proportional so it reads as a flat
// oval rather than a squashed circle. The falloff is tighter than the item halo's -- the
// halo is meant to fade very gradually into a busy background, but this needs a visible
// (if soft) oval edge, not a diffuse haze.

export const SUITCASE_SHADOW_KEY = "suitcase-shadow";
export const SUITCASE_SHADOW_SIZE = 128;

function generateSuitcaseShadowTexture(scene: Phaser.Scene) {
  const size = SUITCASE_SHADOW_SIZE;
  const canvasTexture = scene.textures.createCanvas(SUITCASE_SHADOW_KEY, size, size)!;
  const ctx = canvasTexture.context;
  const cx = size / 2;
  const cy = size / 2;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  gradient.addColorStop(0, "rgba(20,15,20,0.18)");
  gradient.addColorStop(0.55, "rgba(20,15,20,0.14)");
  gradient.addColorStop(0.78, "rgba(20,15,20,0.08)");
  gradient.addColorStop(0.92, "rgba(20,15,20,0.02)");
  gradient.addColorStop(1, "rgba(20,15,20,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fill();
  canvasTexture.refresh();
}

// ---- Generator ------------------------------------------------------------

/** Avatar-independent textures -- generated once at scene creation. */
export function generateStaticTextures(scene: Phaser.Scene) {
  const g = scene.add.graphics();

  const make = (key: string, size: number, draw: (g: G, s: number) => void) => {
    g.clear();
    draw(g, size);
    g.generateTexture(key, size, size);
  };

  make("sparkle", SPARKLE_SIZE, drawSparkle);

  g.clear();
  drawEyeClosed(g);
  g.generateTexture("eye-closed", EYE_CLOSED_SIZE.w, EYE_CLOSED_SIZE.h);

  generateHaloTexture(scene);
  generateSuitcaseShadowTexture(scene);

  g.destroy();
}

/** The iris/pupil texture depends on the current avatar's iris color and its sclera-fit
 * offset -- regenerated every time the avatar profile changes (unlike the static set
 * above), so this removes any previous "eye-pupil" texture first rather than assuming
 * it's the first time this key has been generated. */
export function generateEyePupilTexture(scene: Phaser.Scene, irisColor: number, pupilYOffsetFraction: number) {
  if (scene.textures.exists("eye-pupil")) scene.textures.remove("eye-pupil");
  const g = scene.add.graphics();
  drawEyePupil(g, EYE_PUPIL_SIZE, irisColor, pupilYOffsetFraction);
  g.generateTexture("eye-pupil", EYE_PUPIL_SIZE, EYE_PUPIL_SIZE);
  g.destroy();
}
