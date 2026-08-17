"use client";

import { useEffect, useState } from "react";

const CANDY_SRC = ["/starburst-red.svg", "/starburst-orange.svg", "/starburst-green.svg", "/starburst-yellow.svg"];
const CANDY_SIZE = 38;
const COLOR_COUNT = 8; // per color -- 4 colors * 8 = 32 total
// Negative means candies are allowed to drift a little past the frame's own edge -- the
// wrapper's overflow:hidden then crops them, reading as a few candies spilling out of view
// rather than every one being conservatively clamped inside. Kept small (roughly 30% of a
// candy's own size on a typical phone-width frame) so a candy is never mostly cropped away.
const PLACEMENT_MARGIN = -3;
// Minimum gap (percent of the wrapper) between candy edges -- on top of the AABB check
// below (which alone only guarantees they don't touch), so they read as visibly separate.
const MIN_GAP = 3;
// Same-colored candies need even more room than that, so they never read as "next to" each
// other the way two adjacent different colors would -- this stays a hard rule even for the
// overlap-allowed candies below, since overlapping SAME-color candies would look like a
// mistake (two identical icons stacked) rather than a deliberate pile of different candies.
const MIN_SAME_COLOR_DIST = 20;
// A little over half of the candies are deliberately placed near an already-placed one
// instead of a fully independent random spot, so the layout reads as some candies bunched
// close together and others far apart, rather than one even scatter -- pure uniform-random
// placement (this is a random walk relative to whichever candy came before it, not a bias
// toward the screen's center or any fixed point).
const CLUSTER_FRACTION = 0.45;
// Exactly this many of the 32 candies are allowed to overlap other (differently-colored)
// candies -- the rest must never overlap anything. Zones (logo/text/button) stay a hard
// no-overlap constraint for all 32 regardless.
const OVERLAP_ALLOWED_COUNT = 12;

export type PctRect = { left: number; right: number; top: number; bottom: number };

type Candy = {
  // The candy's CENTER (not top-left) -- rendered via a translate(-50%,-50%) wrapper, so
  // rotating it (see candyFloat) expands its bounding box symmetrically around this same
  // point, matching how the collision math below inflates around it too.
  xPct: number;
  yPct: number;
  rotateDeg: number;
  duration: number;
  delay: number;
  pulseDuration: number;
  pulseDelay: number;
  colorIndex: number;
  // Only candies with this set may overlap -- and only each other (see generateCandies).
  canOverlap: boolean;
};

function centerRectOverlapsZone(cx: number, cy: number, w: number, h: number, z: PctRect): boolean {
  const left = cx - w / 2;
  const right = cx + w / 2;
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  return left < z.right && right > z.left && top < z.bottom && bottom > z.top;
}

function centerSquaresOverlap(ax: number, ay: number, bx: number, by: number, w: number, h: number, gap: number): boolean {
  return Math.abs(ax - bx) < w + gap && Math.abs(ay - by) < h + gap;
}

function generateCandies(avoidZones: PctRect[], candyWPct: number, candyHPct: number): Candy[] {
  const colors = [0, 1, 2, 3].flatMap((c) => Array(COLOR_COUNT).fill(c));
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }

  // Independently shuffled from `colors` so which 12 candies get overlap permission has no
  // relationship to which color they happen to be.
  const allowOverlap = Array.from({ length: colors.length }, (_, i) => i < OVERLAP_ALLOWED_COUNT);
  for (let i = allowOverlap.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allowOverlap[i], allowOverlap[j]] = [allowOverlap[j], allowOverlap[i]];
  }

  const placed: Candy[] = [];
  colors.forEach((colorIndex, idx) => {
    const canOverlap = allowOverlap[idx];
    const wantsCluster = placed.length > 0 && Math.random() < CLUSTER_FRACTION;
    const anchor = wantsCluster ? placed[Math.floor(Math.random() * placed.length)] : null;
    // A cluster anchor normally lands just outside the no-overlap gap from its anchor; an
    // overlap-allowed candy is free to land much closer, including squarely on top of it,
    // which is what actually produces the deliberate overlapping piles.
    const clusterNearMin = canOverlap ? Math.max(candyWPct, candyHPct) * 0.05 : Math.max(candyWPct, candyHPct) + MIN_GAP * 1.1;
    const clusterNearMax = canOverlap ? Math.max(candyWPct, candyHPct) * 0.9 : clusterNearMin * 2.4;
    const minCoord = PLACEMENT_MARGIN + candyWPct / 2;
    const maxCoordX = 100 - PLACEMENT_MARGIN - candyWPct / 2;
    const maxCoordY = 100 - PLACEMENT_MARGIN - candyHPct / 2;

    // Avoiding the logo/text zones, and staying clear of same-colored candies, are HARD
    // constraints for every candy -- never violated, not even as a last resort (two
    // identical-colored icons stacked would read as a mistake, not a deliberate pile).
    // Overlapping a DIFFERENT-colored candy is only ever allowed between two candies that are
    // BOTH flagged `canOverlap` -- a `canOverlap` candy still may never overlap one of the 20
    // that aren't (their own "never overlaps anything" guarantee has to hold no matter which
    // order candies get placed in). Even for the allowed pairing it's a soft preference, not a
    // requirement: with 32 candies to pack into the space the zones leave open, rejection
    // sampling can genuinely run out of fully-clear spots, so this tracks the least-bad
    // zone-safe/same-color-safe candidate seen across every attempt, rather than falling back
    // to an unchecked fixed point (which is exactly what caused every leftover candy to pile
    // up in the same spot before).
    let best: { x: number; y: number; disallowedOverlapCount: number; sameColorDist: number } | null = null;
    for (let attempt = 0; attempt < 300; attempt++) {
      let x: number;
      let y: number;
      if (anchor) {
        const dist = clusterNearMin + Math.random() * (clusterNearMax - clusterNearMin);
        const angle = Math.random() * Math.PI * 2;
        x = anchor.xPct + Math.cos(angle) * dist;
        y = anchor.yPct + Math.sin(angle) * dist;
        if (x < minCoord || x > maxCoordX || y < minCoord || y > maxCoordY) continue;
      } else {
        x = minCoord + Math.random() * (maxCoordX - minCoord);
        y = minCoord + Math.random() * (maxCoordY - minCoord);
      }
      if (avoidZones.some((z) => centerRectOverlapsZone(x, y, candyWPct, candyHPct, z))) continue;

      let disallowedOverlapCount = 0;
      let nearestSameColorDist = Infinity;
      for (const p of placed) {
        const isOverlapping = centerSquaresOverlap(x, y, p.xPct, p.yPct, candyWPct, candyHPct, MIN_GAP);
        if (isOverlapping && !(canOverlap && p.canOverlap)) disallowedOverlapCount++;
        if (p.colorIndex === colorIndex) {
          const d = Math.hypot(p.xPct - x, p.yPct - y);
          if (d < nearestSameColorDist) nearestSameColorDist = d;
        }
      }
      if (nearestSameColorDist >= MIN_SAME_COLOR_DIST && disallowedOverlapCount === 0) {
        best = { x, y, disallowedOverlapCount, sameColorDist: nearestSameColorDist };
        break;
      }
      // Fallback ranking when no attempt fully satisfies both constraints: first prioritize
      // clearing the hard same-color-distance rule, and only once that's satisfied prefer
      // fewer disallowed candy-candy overlaps.
      const bestClearsSameColor = best !== null && best.sameColorDist >= MIN_SAME_COLOR_DIST;
      const candidateClearsSameColor = nearestSameColorDist >= MIN_SAME_COLOR_DIST;
      const isBetter =
        !best ||
        (!bestClearsSameColor && (candidateClearsSameColor || nearestSameColorDist > best.sameColorDist)) ||
        (bestClearsSameColor &&
          candidateClearsSameColor &&
          (disallowedOverlapCount < best.disallowedOverlapCount ||
            (disallowedOverlapCount === best.disallowedOverlapCount && nearestSameColorDist > best.sameColorDist)));
      if (isBetter) {
        best = { x, y, disallowedOverlapCount, sameColorDist: nearestSameColorDist };
      }
    }
    const spot = best ?? { x: 50, y: 50 };
    placed.push({
      xPct: spot.x,
      yPct: spot.y,
      colorIndex,
      canOverlap,
      rotateDeg: Math.random() * 360,
      duration: 2.6 + Math.random() * 1.8,
      delay: Math.random() * 2.5,
      // Long cycle, brief bump near the end (see candyPulse) -- kept long and staggered so
      // pulses feel occasional rather than a constant breathing effect.
      pulseDuration: 7 + Math.random() * 7,
      pulseDelay: Math.random() * 8,
    });
  });
  return placed;
}

// While a pointer is held down (see StartScreen's gather interaction), every candy converges
// slowly onto that exact point (overlapping there is fine -- this is a deliberate "pile up"
// effect, not the resting layout's no-overlap rule); releasing snaps them back quickly.
const GATHER_TRANSITION = "left 1.8s ease-out, top 1.8s ease-out";
const RELEASE_TRANSITION = "left 0.35s ease-in, top 0.35s ease-in";

export default function TitleCandyDecor({
  avoidZones,
  wrapperPx,
  pointerPct,
}: {
  avoidZones: PctRect[];
  /** The wrapper's own pixel size -- CANDY_SIZE (a fixed pixel value) needs this to convert
   *  to a percent-of-wrapper width/height for the overlap math above. */
  wrapperPx: { width: number; height: number };
  /** Set while a pointer is held down somewhere other than the button -- candies gather
   *  toward it, then release back to their resting spot when it goes back to null. */
  pointerPct: { x: number; y: number } | null;
}) {
  // Generated client-side only (not at module scope, not in a lazy useState initializer) --
  // random positions computed during server render wouldn't match the client's own render,
  // which React would flag as a hydration mismatch.
  const [candies, setCandies] = useState<Candy[] | null>(null);
  // The parent recomputes `avoidZones` as a new array/object identity on every StartScreen
  // re-render (e.g. once highScore finishes loading from localStorage asynchronously, adding
  // the "High Score" text as a zone that didn't exist yet on first mount) -- keying off the
  // serialized content, not just running once, means the layout regenerates when the zones
  // actually change instead of forever avoiding a zone that didn't exist yet when candies
  // were first placed.
  const avoidZonesKey = JSON.stringify(avoidZones);
  useEffect(() => {
    // Each candy carries a random `rotate` (persists even at rest -- see candyFloat's 0%
    // keyframe), so its actual on-screen axis-aligned footprint isn't the plain CANDY_SIZE
    // square -- a square rotated 45deg has a bounding box up to sqrt(2) times wider/taller.
    // Sizing the collision math off the worst case (and treating positions as the shared
    // center both share, see the Candy type) keeps candies clear of zones/each other
    // regardless of which rotation they end up with.
    const safeCandySize = CANDY_SIZE * Math.SQRT2;
    const candyWPct = (safeCandySize / wrapperPx.width) * 100;
    const candyHPct = (safeCandySize / wrapperPx.height) * 100;
    setCandies(generateCandies(avoidZones, candyWPct, candyHPct));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avoidZonesKey, wrapperPx.width, wrapperPx.height]);

  if (!candies) return null;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {candies.map((candy, i) => {
        // The gather offset lives on this outer positioning div (animated via a `left`/`top`
        // transition) so it doesn't fight with the inner img's own rotate/translate/scale
        // keyframe animation -- an element's keyframes fully own whichever CSS properties
        // they animate, so the two effects have to live on separate elements to compose.
        const gatherX = pointerPct ? pointerPct.x : candy.xPct;
        const gatherY = pointerPct ? pointerPct.y : candy.yPct;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${gatherX}%`,
              top: `${gatherY}%`,
              transform: "translate(-50%, -50%)",
              transition: pointerPct ? GATHER_TRANSITION : RELEASE_TRANSITION,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={CANDY_SRC[candy.colorIndex]}
              alt=""
              width={CANDY_SIZE}
              height={CANDY_SIZE}
              style={{
                display: "block",
                // Faint transparent halo behind each icon's own silhouette.
                filter: "drop-shadow(0 0 3px rgba(0,0,0,0.22)) drop-shadow(0 0 7px rgba(0,0,0,0.14))",
                // @ts-expect-error -- custom property read by the candyFloat keyframe
                "--candy-rot": `${candy.rotateDeg}deg`,
                animation: `candyFloat ${candy.duration}s ease-in-out ${candy.delay}s infinite, candyPulse ${candy.pulseDuration}s ease-in-out ${candy.pulseDelay}s infinite`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
