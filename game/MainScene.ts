import Phaser from "phaser";
import {
  generateStaticTextures,
  generateEyePupilTexture,
  ITEM_HALO_KEY,
  EYE_CLOSED_SIZE,
  EYE_PUPIL_FILL_RATIO,
  EYE_PUPIL_SIZE,
  SUITCASE_SHADOW_KEY,
} from "./textures";
import { ALL_ITEMS, ItemDef, ITEM_SIZE, pickWeighted } from "./items";
import { gameEvents, gameCommands, ControlMode } from "./eventBus";
import { AVATAR_PROFILES, AvatarProfile } from "../data/avatarProfiles";

type PlayState = "idle" | "playing" | "over";

const CATCHER_BOTTOM_OFFSET = 135;
/** Fixed distance from the bottom of the screen to the avatar's anchor — independent of
 *  the catcher's position, so moving the suitcase doesn't move the character. Measured
 *  against the ORIGINAL 360-tall avatar viewBox's bottom edge (see AVATAR_CANVAS_HEIGHT
 *  below for why it's not simply "screen height minus canvas height"). */
const AVATAR_BASE_BOTTOM_OFFSET = 175;
const EYE_MAX_SHIFT_X = 4;
const ARM_THICKNESS = 22 * 1.3;
/** Fraction of the way from the elbow to the hand the bend's curve control sits, as a
 *  fraction of that vertical distance -- keeps the curve's initial tangent pointing
 *  straight down (matching the vertical segment above the elbow) before bending to the
 *  hand, rather than kinking sharply at the elbow. */
const ELBOW_BEND_T = 0.6;
/** Fraction of the catcher's own width it's allowed to hang off-screen on either side. */
const CATCHER_OVERHANG_FRACTION = 0.1;
/** Fraction of an item's size it's allowed to spawn past the screen edge. */
const ITEM_EDGE_OVERHANG_FRACTION = 0.08;
/** How far above the canvas's bottom edge a missed item starts fading out, in pixels. */
const ITEM_FADE_ZONE = 80;
/** Candy caught between mini-bonus triggers -- fires every Nth candy (12, 24, 36...). */
const MINI_BONUS_INTERVAL = 12;

// suitcase.svg / hands-neutral.svg share the same 360x360 viewBox/canvas — rasterized at
// 2x here for crispness. Keeping every position in that shared canvas space lets each
// piece land exactly where the source art places it relative to the others, instead of
// guessing an offset.
const SVG_RENDER_SIZE = 720;
const SUITCASE_ART_FRAME = { x: 48, y: 50, width: 624, height: 580 };
const HAND_LEFT_FRAME = { x: 10, y: 540, width: 196, height: 136 };
const HAND_RIGHT_FRAME = { x: 514, y: 540, width: 196, height: 136 };
const CATCHER_DISPLAY_WIDTH_DEFAULT = 190;
const CATCHER_DISPLAY_WIDTH = CATCHER_DISPLAY_WIDTH_DEFAULT * 1.1;
// Hands are sized off the ORIGINAL (pre-boost) scale -- the request was to grow the
// suitcase without growing the hands, only moving them out to the bigger suitcase's edges.
const HAND_ART_SCALE = CATCHER_DISPLAY_WIDTH_DEFAULT / SUITCASE_ART_FRAME.width;
// The catcher's own origin is its center, so scaling it up would grow it evenly in both
// directions -- shifting the center UP by half the height increase keeps the bottom edge
// exactly where it was before, with only the top edge moving higher. (Negative: less
// distance from the bottom offset means further up the screen.)
const CATCHER_HEIGHT_DEFAULT = SUITCASE_ART_FRAME.height * (CATCHER_DISPLAY_WIDTH_DEFAULT / SUITCASE_ART_FRAME.width);
const CATCHER_HEIGHT = SUITCASE_ART_FRAME.height * (CATCHER_DISPLAY_WIDTH / SUITCASE_ART_FRAME.width);
const CATCHER_Y_SHIFT = (CATCHER_HEIGHT_DEFAULT - CATCHER_HEIGHT) / 2;

const frameCenter = (f: { x: number; y: number; width: number; height: number }) => ({
  x: f.x + f.width / 2,
  y: f.y + f.height / 2,
});
const SUITCASE_ART_CENTER = frameCenter(SUITCASE_ART_FRAME);
const HAND_LEFT_CENTER = frameCenter(HAND_LEFT_FRAME);
const HAND_RIGHT_CENTER = frameCenter(HAND_RIGHT_FRAME);

// swimsuit.svg is a halter top + separate bottom piece on the same 360-canvas as the
// suitcase/hands art, with a clean transparent gap between them (top content ends at
// y=189, bottom starts at y=203, in 360-space) — split there so the two pieces can wiggle
// independently instead of as one rigid image.
const SWIMSUIT_SPLIT_360 = 196;
const SWIMSUIT_TOP_FRAME = { x: 0, y: 0, width: 360, height: SWIMSUIT_SPLIT_360 };
const SWIMSUIT_BOTTOM_FRAME = { x: 0, y: SWIMSUIT_SPLIT_360, width: 360, height: 360 - SWIMSUIT_SPLIT_360 };
const SWIMSUIT_RENDER_SCALE = SVG_RENDER_SIZE / 360;

// plane.svg / plane2.svg are the same plane art, differing only in the size of the baked-in
// exclamation mark — pixel-diffing the two rendered frames showed everything OUTSIDE this
// rect is identical between them (bbox x:137-222 y:37-322 in 360-space, padded a bit here).
// Cropping just this patch lets the exclamation pulse/shake on its own while the plane sprite
// underneath stays a single static texture.
const PLANE_ICON_FRAME = { x: 130, y: 30, width: 100, height: 300 };
const PLANE_ICON_RENDER_SCALE = SVG_RENDER_SIZE / 360;

// Every avatar's smile/frown PNGs are a full 360-wide local canvas (mostly transparent
// outside their own content, matching the 720x1100 actual image at 2x) -- eye/shoulder
// coordinates in each AvatarProfile are measured directly in this shared canvas space,
// which is what makes swapping the whole profile at runtime (applyAvatarProfile) work
// without any per-avatar offset math.
const AVATAR_CANVAS = 360;
// The viewBox is taller than it is wide (long hair / shirt hem extend past a square
// frame) — origin(0.5,1) anchors to *this* bottom edge, not AVATAR_CANVAS.
// 1100px texture height (up from 880) -- gives real headroom above the hairline for
// avatars whose source photo shows more torso below the shoulder relative to their eye
// spacing than the original reference photos did (without this, that extra content has
// nowhere to go but clipping the hair off the top when bottom-anchored). Purely additive:
// avatar.y (the screen bottom-anchor) and every existing avatar's on-screen position are
// unaffected by this -- the extra canvas space only ever adds empty margin above content
// that already fit; it never moves anything that didn't need it.
const AVATAR_CANVAS_HEIGHT = 550;
const AVATAR_SVG_RENDER_WIDTH = SVG_RENDER_SIZE;
const AVATAR_BASE_DISPLAY_WIDTH = 179;

// Every avatar (9 preloaded characters + any user-generated one) is now a photo-based
// smile/frown image pair sharing this same rig -- eye/shoulder positions, sclera height,
// and arm/skin/iris colors all come from a per-avatar AvatarProfile (data/avatarProfiles.ts
// for preloaded characters, lib/avatarPipeline.ts at runtime for a generated one) applied
// via applyAvatarProfile(), not from module-level constants. There is no more non-photo
// fallback rig.

// 20% larger than the base catalog width, and anchored further from the bottom, so the
// torso fully covers the back-arm segment (armsBackGraphics) instead of it peeking out
// past the edges.
const AVATAR_DISPLAY_WIDTH = AVATAR_BASE_DISPLAY_WIDTH * 1.2;
const AVATAR_BOTTOM_OFFSET = AVATAR_BASE_BOTTOM_OFFSET + 10;
// Scale from the loaded texture to its on-screen display size (used with setScale
// on the image objects themselves, which operate in texture-pixel space).
const AVATAR_ART_SCALE = AVATAR_DISPLAY_WIDTH / AVATAR_SVG_RENDER_WIDTH;
// Scale from the shared 360-unit local canvas space (where every avatar's eye/shoulder
// coordinates are measured) to on-screen pixels.
const AVATAR_LOCAL_SCALE = AVATAR_DISPLAY_WIDTH / AVATAR_CANVAS;
// The iris's diameter is the avatar's own detected sclera height, bumped up a bit further
// so it doesn't read as undersized -- not a fixed size that may be larger or smaller than
// what's actually drawn. Anchored from the BOTTOM: its bottom edge sits IRIS_BOTTOM_GAP_PX
// above the sclera's own bottom edge (actual on-screen pixels, via AVATAR_LOCAL_SCALE, so
// it stays consistent across avatars at different display scales), so the size beyond the
// sclera's own height extends upward past its top edge instead of growing evenly on both
// sides -- clipped off there (see clipPupilToSclera) so it doesn't spill onto the eyebrow art.
const IRIS_SIZE_BOOST = 1.91664; // 1.5972 * 1.2 -- another 20% on top of the previous boost
// Small gap on purpose -- close enough to read as sitting in the sclera, not touching its
// bottom edge, just enough that the eyes read as looking slightly up rather than centered.
const IRIS_BOTTOM_GAP_PX = 2;
const IRIS_BOTTOM_GAP_LOCAL = IRIS_BOTTOM_GAP_PX / AVATAR_LOCAL_SCALE;

export class MainScene extends Phaser.Scene {
  private catcher!: Phaser.Physics.Arcade.Image;
  private catcherShadow!: Phaser.GameObjects.Image;
  private avatar!: Phaser.GameObjects.Image;
  private leftPupil!: Phaser.GameObjects.Image;
  private rightPupil!: Phaser.GameObjects.Image;
  private blinkTimer: Phaser.Time.TimerEvent | null = null;
  /** Portion of each arm within the body/head's own silhouette — behind them. */
  private armsBackGraphics!: Phaser.GameObjects.Graphics;
  /** Portion of each arm past the body's bottom edge, reaching to the hands — in front. */
  private armsFrontGraphics!: Phaser.GameObjects.Graphics;
  private leftHand!: Phaser.GameObjects.Image;
  private rightHand!: Phaser.GameObjects.Image;
  private shoulderLeft = { x: 0, y: 0 };
  private shoulderRight = { x: 0, y: 0 };
  private eyeBaseLeft = { x: 0, y: 0 };
  private eyeBaseRight = { x: 0, y: 0 };
  // Unlike eyeBaseLeft/Right (the iris's own resting position, offset by
  // eyePupilCenterYBiasLocal), these track the sclera's own true center -- used only
  // to position the clipping mask, which must stay put where the sclera art actually is.
  private scleraCenterLeft = { x: 0, y: 0 };
  private scleraCenterRight = { x: 0, y: 0 };
  private items!: Phaser.Physics.Arcade.Group;
  private halos: Phaser.GameObjects.Image[] = [];
  private score = 0;
  private lives = 3;
  private candyCount = 0;
  private lastSpawnedKey: string | null = null;
  private spawnZoneBag: number[] = [];
  private moodTimer: Phaser.Time.TimerEvent | null = null;
  private bonusPaused = false;
  private bonusPauseRemaining = 0;
  private speedStage = 0;
  private playState: PlayState = "idle";
  private spawnAccum = 0;
  private elapsed = 0;
  private unsubscribers: Array<() => void> = [];
  private controlMode: ControlMode = "drag";
  private tiltActive = false;
  private tiltTargetX = 0;
  /** The currently-applied avatar's geometry/colors -- see applyAvatarProfile(). Always
   *  set (defaults to the first preloaded character before any pick is made). */
  private avatarProfile!: AvatarProfile;
  private irisDiameterLocal = 0;
  private eyePupilRadiusLocal = 0;
  private eyePupilCenterYBiasLocal = 0;
  /** Whether items are currently falling -- separate from playState so a character can be
   *  revealed (visible, blinking, arms drawn) for a moment before spawning actually begins
   *  (see revealAvatar/beginSpawning), without freezing update() entirely to do it. */
  private spawningEnabled = false;
  /** Texture keys added at runtime via addBase64 for a user-generated avatar, tracked so
   *  a previous generated avatar's textures can be released when a new one replaces it. */
  private generatedTextureKeys: string[] = [];

  constructor() {
    super("main");
  }

  preload() {
    this.load.svg("suitcase-art", "/suitcase.svg", { width: SVG_RENDER_SIZE, height: SVG_RENDER_SIZE });
    this.load.svg("hands-art", "/hands-neutral.svg", { width: SVG_RENDER_SIZE, height: SVG_RENDER_SIZE });
    this.load.svg("seashell", "/seashell.svg", { width: ITEM_SIZE["seashell"], height: ITEM_SIZE["seashell"] });
    this.load.svg("hotel-key", "/hotelkey.svg", { width: ITEM_SIZE["hotel-key"], height: ITEM_SIZE["hotel-key"] });
    this.load.svg("credit-card", "/creditcard.svg", { width: ITEM_SIZE["credit-card"], height: ITEM_SIZE["credit-card"] });
    this.load.svg("candy-pink", "/starburst-red.svg", { width: ITEM_SIZE["candy-pink"], height: ITEM_SIZE["candy-pink"] });
    this.load.svg("candy-orange", "/starburst-orange.svg", { width: ITEM_SIZE["candy-orange"], height: ITEM_SIZE["candy-orange"] });
    this.load.svg("candy-green", "/starburst-green.svg", { width: ITEM_SIZE["candy-green"], height: ITEM_SIZE["candy-green"] });
    this.load.svg("candy-yellow", "/starburst-yellow.svg", { width: ITEM_SIZE["candy-yellow"], height: ITEM_SIZE["candy-yellow"] });
    this.load.svg("innertube", "/innertube.svg", { width: ITEM_SIZE["innertube"], height: ITEM_SIZE["innertube"] });
    this.load.svg("sunglasses", "/sunglasses.svg", { width: ITEM_SIZE["sunglasses"], height: ITEM_SIZE["sunglasses"] });
    // Loaded twice: "swimsuit" at the item's small display size drives the invisible
    // physics/collision body, "swimsuit-art" at full render size supplies the two
    // separately-wiggling top/bottom frames (see SWIMSUIT_TOP_FRAME etc.) actually shown.
    this.load.svg("swimsuit", "/swimsuit.svg", { width: ITEM_SIZE["swimsuit"], height: ITEM_SIZE["swimsuit"] });
    this.load.svg("swimsuit-art", "/swimsuit.svg", { width: SVG_RENDER_SIZE, height: SVG_RENDER_SIZE });
    this.load.svg("bad-email", "/email.svg", { width: ITEM_SIZE["bad-email"], height: ITEM_SIZE["bad-email"] });
    this.load.svg("bad-email-in", "/email1.svg", { width: ITEM_SIZE["bad-email"], height: ITEM_SIZE["bad-email"] });
    this.load.svg("bad-emoji", "/sademoji.svg", { width: ITEM_SIZE["bad-emoji"], height: ITEM_SIZE["bad-emoji"] });
    this.load.svg("bad-fish", "/fish.svg", { width: ITEM_SIZE["bad-fish"], height: ITEM_SIZE["bad-fish"] });
    this.load.svg("ring", "/diamondring1.svg", { width: ITEM_SIZE["ring"], height: ITEM_SIZE["ring"] });
    this.load.svg("ring-2", "/diamondring2.svg", { width: ITEM_SIZE["ring"], height: ITEM_SIZE["ring"] });
    this.load.svg("ring-3", "/diamondring3.svg", { width: ITEM_SIZE["ring"], height: ITEM_SIZE["ring"] });
    this.load.svg("bad-weather", "/cloud1.svg", { width: ITEM_SIZE["bad-weather"], height: ITEM_SIZE["bad-weather"] });
    this.load.svg("bad-weather-2", "/cloud2.svg", { width: ITEM_SIZE["bad-weather"], height: ITEM_SIZE["bad-weather"] });
    this.load.svg("bad-weather-3", "/cloud3.svg", { width: ITEM_SIZE["bad-weather"], height: ITEM_SIZE["bad-weather"] });
    this.load.svg("bad-weather-4", "/cloud4.svg", { width: ITEM_SIZE["bad-weather"], height: ITEM_SIZE["bad-weather"] });
    this.load.svg("journal", "/journal.svg", { width: ITEM_SIZE["journal"], height: ITEM_SIZE["journal"] });
    this.load.svg("journal-2", "/journal2.svg", { width: ITEM_SIZE["journal"], height: ITEM_SIZE["journal"] });
    // The base plane texture stays a single static sprite; the exclamation mark is a
    // separate cropped overlay (see PLANE_ICON_FRAME) so it can pulse/shake on its own.
    this.load.svg("bad-plane", "/plane.svg", { width: ITEM_SIZE["bad-plane"], height: ITEM_SIZE["bad-plane"] });
    this.load.svg("plane-icon-small-art", "/plane.svg", { width: SVG_RENDER_SIZE, height: SVG_RENDER_SIZE });
    this.load.svg("plane-icon-large-art", "/plane2.svg", { width: SVG_RENDER_SIZE, height: SVG_RENDER_SIZE });
    // All 9 preloaded characters loaded eagerly (18 small PNGs) so picking one from the
    // library is instant -- no per-avatar loading screen, matching "skip straight to
    // gameplay" for preloaded picks. A user-generated avatar's textures are added later,
    // at runtime, via this.textures.addBase64 (see loadGeneratedAvatarTextures).
    for (const p of AVATAR_PROFILES) {
      this.load.image(p.smileKey, p.smileSrc);
      this.load.image(p.frownKey, p.frownSrc);
    }
  }

  create() {
    generateStaticTextures(this);
    // Placeholder iris texture so the pupil Image objects below have a real texture to
    // reference at creation time -- applyAvatarProfile (called once everything else in
    // create() exists) immediately regenerates this with the actual first avatar's values.
    generateEyePupilTexture(this, AVATAR_PROFILES[0].irisColor, 0);
    this.textures
      .get("suitcase-art")
      .add("suitcase-frame", 0, SUITCASE_ART_FRAME.x, SUITCASE_ART_FRAME.y, SUITCASE_ART_FRAME.width, SUITCASE_ART_FRAME.height);
    this.textures
      .get("hands-art")
      .add("hand-left", 0, HAND_LEFT_FRAME.x, HAND_LEFT_FRAME.y, HAND_LEFT_FRAME.width, HAND_LEFT_FRAME.height);
    this.textures
      .get("hands-art")
      .add("hand-right", 0, HAND_RIGHT_FRAME.x, HAND_RIGHT_FRAME.y, HAND_RIGHT_FRAME.width, HAND_RIGHT_FRAME.height);
    this.textures.get("swimsuit-art").add(
      "swimsuit-top",
      0,
      SWIMSUIT_TOP_FRAME.x * SWIMSUIT_RENDER_SCALE,
      SWIMSUIT_TOP_FRAME.y * SWIMSUIT_RENDER_SCALE,
      SWIMSUIT_TOP_FRAME.width * SWIMSUIT_RENDER_SCALE,
      SWIMSUIT_TOP_FRAME.height * SWIMSUIT_RENDER_SCALE
    );
    this.textures.get("swimsuit-art").add(
      "swimsuit-bottom",
      0,
      SWIMSUIT_BOTTOM_FRAME.x * SWIMSUIT_RENDER_SCALE,
      SWIMSUIT_BOTTOM_FRAME.y * SWIMSUIT_RENDER_SCALE,
      SWIMSUIT_BOTTOM_FRAME.width * SWIMSUIT_RENDER_SCALE,
      SWIMSUIT_BOTTOM_FRAME.height * SWIMSUIT_RENDER_SCALE
    );
    this.textures.get("plane-icon-small-art").add(
      "icon",
      0,
      PLANE_ICON_FRAME.x * PLANE_ICON_RENDER_SCALE,
      PLANE_ICON_FRAME.y * PLANE_ICON_RENDER_SCALE,
      PLANE_ICON_FRAME.width * PLANE_ICON_RENDER_SCALE,
      PLANE_ICON_FRAME.height * PLANE_ICON_RENDER_SCALE
    );
    this.textures.get("plane-icon-large-art").add(
      "icon",
      0,
      PLANE_ICON_FRAME.x * PLANE_ICON_RENDER_SCALE,
      PLANE_ICON_FRAME.y * PLANE_ICON_RENDER_SCALE,
      PLANE_ICON_FRAME.width * PLANE_ICON_RENDER_SCALE,
      PLANE_ICON_FRAME.height * PLANE_ICON_RENDER_SCALE
    );

    const { width, height } = this.scale;

    this.physics.world.setBounds(0, 0, width, height);

    this.catcher = this.physics.add.image(width / 2, height - CATCHER_BOTTOM_OFFSET + CATCHER_Y_SHIFT, "suitcase-art", "suitcase-frame");
    this.catcher.setImmovable(true);
    this.catcher.setDepth(1);
    this.catcher.setScale(CATCHER_DISPLAY_WIDTH / SUITCASE_ART_FRAME.width);
    (this.catcher.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    // Catch trigger sits low, near the dark horizontal line at the back of the open
    // interior, so items visibly fall into the case before they're caught/vanish. Narrower
    // than the case's own width (rather than matching it) so a catch has to land closer to
    // center, not right at the case's outer edges.
    this.catcher.body!.setSize(this.catcher.width * 0.54, this.catcher.height * 0.16);
    this.catcher.body!.setOffset(this.catcher.width * 0.23, this.catcher.height * 0.7);

    // Soft oval shadow on the ground beneath the suitcase, tracking it horizontally (see
    // drawArms/handleResize for the position sync) -- sits just behind the case itself but
    // in front of the avatar/arms, like it's cast onto the pool deck the case rests on. The
    // 0.56 offset clears the case's own bottom edge (half its height is 0.5) so the shadow
    // reads as sitting below it, not hidden behind its opaque art. Visibility is tied to
    // setCharacterVisible so it only ever shows during actual gameplay, matching the case.
    this.catcherShadow = this.add.image(this.catcher.x, this.catcher.y + this.catcher.displayHeight * 0.56, SUITCASE_SHADOW_KEY);
    this.catcherShadow.setDepth(0.95);
    this.catcherShadow.setDisplaySize(this.catcher.displayWidth * 0.92, this.catcher.displayWidth * 0.15);
    this.catcherShadow.setVisible(false);

    this.avatar = this.add.image(width / 2, height - AVATAR_BOTTOM_OFFSET, AVATAR_PROFILES[0].smileKey);
    this.avatar.setOrigin(0.5, 1);
    this.avatar.setDepth(0);
    this.avatar.setScale(AVATAR_ART_SCALE);

    this.leftPupil = this.add.image(0, 0, "eye-pupil").setDepth(0.05);
    this.rightPupil = this.add.image(0, 0, "eye-pupil").setDepth(0.05);
    // Each arm is split in two at the body's bottom edge (see drawArms): the part still
    // within the body/head's own silhouette renders behind them, tucked out of sight, and
    // the part reaching on to the hands renders in front, fully visible. Depth alone only
    // controls render ORDER -- the back segment is only actually hidden wherever the
    // avatar sprite drawn after it happens to be opaque, so the measured shoulder edge
    // needs a real safety margin (see SHOULDER_SAFETY_INSET below), not a flush fit.
    this.armsBackGraphics = this.add.graphics().setDepth(-0.1);
    this.armsFrontGraphics = this.add.graphics().setDepth(0.3);
    this.leftHand = this.add.image(0, 0, "hands-art", "hand-left").setDepth(1.1).setScale(HAND_ART_SCALE);
    this.rightHand = this.add.image(0, 0, "hands-art", "hand-right").setDepth(1.1).setScale(HAND_ART_SCALE);
    // Sets pupil size/position, hand tint, arm color, and the real eye-pupil texture --
    // see applyAvatarProfile for the full sequence this replaces.
    this.applyAvatarProfile(AVATAR_PROFILES[0]);
    this.setCharacterVisible(false);
    this.scheduleBlink();

    this.items = this.physics.add.group();

    this.physics.add.overlap(this.catcher, this.items, this.handleCatch as never, undefined, this);

    // On touch devices "pointermove" only fires while a finger is actively touching, but on
    // mouse/trackpad it fires continuously on hover — gate it on isDown so the catcher only
    // follows an active press/drag, not the cursor merely passing over the canvas. Deliberately
    // NOT also bound to "pointerdown" -- that would snap the catcher straight to a plain tap/
    // click anywhere on screen. Only real movement while pressed (an actual drag) should move it.
    const dragMove = (pointer: Phaser.Input.Pointer) => {
      if (this.playState !== "playing") return;
      if (this.controlMode === "tilt" && this.tiltActive) return;
      if (!pointer.isDown) return;
      const { min, max } = this.getCatcherClampBounds();
      this.catcher.x = Phaser.Math.Clamp(pointer.x, min, max);
    };
    this.input.on("pointermove", dragMove);

    this.scale.on("resize", this.handleResize, this);

    this.unsubscribers.push(
      gameCommands.on("restart", ({ controlMode }) => {
        this.controlMode = controlMode;
        this.tiltActive = false;
        this.tiltTargetX = this.scale.width / 2;
        this.prepareCharacter();
        this.beginSpawning();
      }),
      gameCommands.on("tilt", ({ gamma }) => {
        if (this.controlMode !== "tilt") return;
        this.tiltActive = true;
        const { min, max } = this.getCatcherClampBounds();
        const clamped = Phaser.Math.Clamp(gamma, -24, 24);
        const t = (clamped + 24) / 48;
        this.tiltTargetX = Phaser.Math.Linear(min, max, t);
      }),
      gameCommands.on("resetToStart", () => {
        this.playState = "idle";
        this.items.clear(true, true);
        this.clearHalos();
        this.setCharacterVisible(false);
        gameEvents.emit("state-change", { state: "start" });
      }),
      gameCommands.on("setAvatar", (source) => {
        if (source.kind === "preloaded") {
          const profile = AVATAR_PROFILES.find((p) => p.id === source.id) ?? AVATAR_PROFILES[0];
          this.applyAvatarProfile(profile);
          gameEvents.emit("avatar-ready", undefined);
          return;
        }
        // Generated avatar: add its two textures first (async), then apply -- geometry
        // comes straight from the caller (lib/avatarPipeline.ts's output), no lookup needed.
        // "avatar-ready" only fires here, once applyAvatarProfile has actually run -- a
        // caller emitting "revealAvatar" right after "setAvatar" (same tick) would
        // otherwise call prepareCharacter() against the STILL-PREVIOUS avatarProfile,
        // since that promise hasn't resolved yet at that point.
        this.loadGeneratedAvatarTextures(source.id, source.smileDataUrl, source.frownDataUrl).then(({ smileKey, frownKey }) => {
          this.applyAvatarProfile({
            id: source.id,
            displayName: "You",
            smileKey,
            frownKey,
            smileSrc: "",
            frownSrc: "",
            ...source.geometry,
          });
          gameEvents.emit("avatar-ready", undefined);
        });
      }),
      // Shows the character/suitcase (HUD chrome, 0/0 counters) and applies the given
      // control mode, without starting item spawning -- used for every fresh game start;
      // React decides when beginSpawning follows (immediately, or after the one-time tilt
      // tip is dismissed). "restart" above skips this gap since the tip only applies to a
      // session's first play.
      gameCommands.on("revealAvatar", ({ controlMode }) => {
        this.controlMode = controlMode;
        this.tiltActive = false;
        this.tiltTargetX = this.scale.width / 2;
        this.prepareCharacter();
      }),
      gameCommands.on("beginSpawning", () => {
        this.beginSpawning();
      })
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribers.forEach((fn) => fn());
      this.scale.off("resize", this.handleResize, this);
    });
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    const width = gameSize.width;
    const height = gameSize.height;
    this.physics.world.setBounds(0, 0, width, height);
    if (this.catcher) {
      this.catcher.y = height - CATCHER_BOTTOM_OFFSET + CATCHER_Y_SHIFT;
      const { min, max } = this.getCatcherClampBounds(width);
      this.catcher.x = Phaser.Math.Clamp(this.catcher.x, min, max);
    }
    if (this.catcherShadow) {
      this.catcherShadow.x = this.catcher.x;
      this.catcherShadow.y = this.catcher.y + this.catcher.displayHeight * 0.56;
    }
    if (this.avatar) {
      this.avatar.x = width / 2;
      this.avatar.y = height - AVATAR_BOTTOM_OFFSET;
    }
    if (this.leftPupil) {
      this.updateAvatarAnchors();
      this.leftPupil.setPosition(this.eyeBaseLeft.x, this.eyeBaseLeft.y);
      this.rightPupil.setPosition(this.eyeBaseRight.x, this.eyeBaseRight.y);
      this.clipPupilToSclera(this.leftPupil, this.scleraCenterLeft.y);
      this.clipPupilToSclera(this.rightPupil, this.scleraCenterRight.y);
      this.drawArms();
    }
  }

  /**
   * Recomputes the world-space shoulder and eye-socket anchors from the avatar's current
   * position, using the shared 360-unit local canvas space every avatar's eye/shoulder
   * coordinates are measured in (this.avatarProfile.eyeLocal / shoulderLocal).
   */
  private updateAvatarAnchors() {
    const toWorld = (localX: number, localY: number) => ({
      x: this.avatar.x + (localX - AVATAR_CANVAS / 2) * AVATAR_LOCAL_SCALE,
      y: this.avatar.y + (localY - AVATAR_CANVAS_HEIGHT) * AVATAR_LOCAL_SCALE,
    });
    const { eyeLocal, shoulderLocal } = this.avatarProfile;
    this.shoulderLeft = toWorld(shoulderLocal.left.x, shoulderLocal.left.y);
    this.shoulderRight = toWorld(shoulderLocal.right.x, shoulderLocal.right.y);
    this.eyeBaseLeft = toWorld(eyeLocal.left.x, eyeLocal.left.y + this.eyePupilCenterYBiasLocal);
    this.eyeBaseRight = toWorld(eyeLocal.right.x, eyeLocal.right.y + this.eyePupilCenterYBiasLocal);
    this.scleraCenterLeft = toWorld(eyeLocal.left.x, eyeLocal.left.y);
    this.scleraCenterRight = toWorld(eyeLocal.right.x, eyeLocal.right.y);
  }

  // Crops the pupil's own texture frame down to whatever vertical slice of it currently
  // overlaps the sclera's own (fixed) height -- the iris is sized/anchored to overflow past
  // the sclera's edges (see eyePupilCenterYBiasLocal above), and without this it would
  // visibly spill onto the eyebrow art above/below the eye. Recomputed every frame the pupil
  // moves (see updateEyes), since setCrop works in the pupil's own local frame space, not
  // world space -- a fixed crop would drift out of alignment as it tracks the catcher.
  // No-op mid-blink, when the texture isn't the iris.
  private clipPupilToSclera(pupil: Phaser.GameObjects.Image, scleraCenterY: number) {
    if (pupil.texture.key !== "eye-pupil") {
      pupil.setCrop();
      return;
    }
    const scleraHeightWorld = this.avatarProfile.scleraHeightLocal * AVATAR_LOCAL_SCALE;
    const scleraTop = scleraCenterY - scleraHeightWorld / 2;
    const scleraBottom = scleraCenterY + scleraHeightWorld / 2;
    const pupilTop = pupil.y - pupil.displayHeight / 2;
    const toFramePx = (worldY: number) =>
      Phaser.Math.Clamp(((worldY - pupilTop) / pupil.displayHeight) * EYE_PUPIL_SIZE, 0, EYE_PUPIL_SIZE);
    const cropTop = toFramePx(scleraTop);
    const cropBottom = toFramePx(scleraBottom);
    pupil.setCrop(0, cropTop, EYE_PUPIL_SIZE, Math.max(0, cropBottom - cropTop));
  }

  /**
   * Applies a new avatar's geometry/colors to every part of the rig that depends on it:
   * regenerates the iris texture (color + sclera-fit offset are per-avatar), resizes/
   * retints the pupils and hands, swaps the body texture to the new smile art, and
   * recomputes anchors/arms off the new eye/shoulder positions. This is THE single
   * entry point both the preloaded-character path and the generated-avatar path go
   * through -- replaces the old (unused) setPlayerAvatarTexture, which only swapped the
   * texture key and left every geometry/color constant untouched.
   */
  private applyAvatarProfile(profile: AvatarProfile) {
    this.avatarProfile = profile;
    this.irisDiameterLocal = profile.scleraHeightLocal * IRIS_SIZE_BOOST;
    this.eyePupilRadiusLocal = this.irisDiameterLocal / 2;
    this.eyePupilCenterYBiasLocal = profile.scleraHeightLocal / 2 - IRIS_BOTTOM_GAP_LOCAL - this.irisDiameterLocal / 2;
    // The black pupil/catchlight are drawn at the texture's own center by default, but
    // since the iris is so much taller than the sclera crop window, that center sits well
    // above the window and gets clipped away entirely -- this fraction is where the crop
    // window actually falls within the texture (offset down from center), see drawEyePupil.
    const pupilTextureYOffsetFraction =
      -this.eyePupilCenterYBiasLocal / (this.irisDiameterLocal / EYE_PUPIL_FILL_RATIO);
    generateEyePupilTexture(this, profile.irisColor, pupilTextureYOffsetFraction);

    this.avatar.setTexture(profile.smileKey);
    // The "eye-pupil" texture's own drawn circle only fills EYE_PUPIL_FILL_RATIO of its
    // canvas (see textures.ts) -- divide by that ratio here so the VISIBLE iris comes out
    // at the intended diameter.
    const pupilDiameter = (this.eyePupilRadiusLocal * 2 * AVATAR_LOCAL_SCALE) / EYE_PUPIL_FILL_RATIO;
    this.leftPupil.setTexture("eye-pupil").setDisplaySize(pupilDiameter, pupilDiameter);
    this.rightPupil.setTexture("eye-pupil").setDisplaySize(pupilDiameter, pupilDiameter);
    this.leftHand.setTint(profile.skinColor);
    this.rightHand.setTint(profile.skinColor);

    this.updateAvatarAnchors();
    this.leftPupil.setPosition(this.eyeBaseLeft.x, this.eyeBaseLeft.y);
    this.rightPupil.setPosition(this.eyeBaseRight.x, this.eyeBaseRight.y);
    this.clipPupilToSclera(this.leftPupil, this.scleraCenterLeft.y);
    this.clipPupilToSclera(this.rightPupil, this.scleraCenterRight.y);
    this.drawArms();
  }

  /** Adds a user-generated avatar's smile/frown images as new textures and returns their
   *  keys once both are ready -- the runtime equivalent of the preloaded pairs already
   *  loaded in preload(). Releases the previous generated avatar's textures, if any, since
   *  each new generation would otherwise leak two full-size textures per avatar created. */
  private loadGeneratedAvatarTextures(id: string, smileDataUrl: string, frownDataUrl: string): Promise<{ smileKey: string; frownKey: string }> {
    const smileKey = `generated-${id}-smile`;
    const frownKey = `generated-${id}-frown`;
    for (const key of this.generatedTextureKeys) {
      if (this.textures.exists(key)) this.textures.remove(key);
    }
    this.generatedTextureKeys = [smileKey, frownKey];
    const added = (key: string, dataUrl: string) =>
      new Promise<void>((resolve) => {
        if (this.textures.exists(key)) this.textures.remove(key);
        // Filtered by key, not a bare .once -- both calls run concurrently below (via
        // Promise.all), so an unfiltered listener could resolve on the OTHER texture's
        // ADD event instead of its own.
        const onAdd = (addedKey: string) => {
          if (addedKey !== key) return;
          this.textures.off(Phaser.Textures.Events.ADD, onAdd);
          resolve();
        };
        this.textures.on(Phaser.Textures.Events.ADD, onAdd);
        this.textures.addBase64(key, dataUrl);
      });
    return Promise.all([added(smileKey, smileDataUrl), added(frownKey, frownDataUrl)]).then(() => ({ smileKey, frownKey }));
  }

  private drawArms() {
    // Split across two depths: the shoulder-to-torso-bottom segment draws on "back" (depth
    // -0.1, BEHIND the torso at depth 0) so it's actually hidden wherever the torso art is
    // opaque, instead of visibly overlapping it. Only the elbow-to-hand curve, which reaches
    // out past the torso's own silhouette, draws on "front" (0.3) -- still behind the hands
    // (1.1), so it tucks under the suitcase it's reaching for.
    const back = this.armsBackGraphics;
    const front = this.armsFrontGraphics;
    const armColor = this.avatarProfile.armColor;
    back.clear();
    front.clear();
    if (this.catcherShadow) this.catcherShadow.x = this.catcher.x;
    const artScale = this.catcher.scaleX;
    const handLeft = {
      x: this.catcher.x + (HAND_LEFT_CENTER.x - SUITCASE_ART_CENTER.x) * artScale,
      y: this.catcher.y + (HAND_LEFT_CENTER.y - SUITCASE_ART_CENTER.y) * artScale,
    };
    const handRight = {
      x: this.catcher.x + (HAND_RIGHT_CENTER.x - SUITCASE_ART_CENTER.x) * artScale,
      y: this.catcher.y + (HAND_RIGHT_CENTER.y - SUITCASE_ART_CENTER.y) * artScale,
    };
    // Each arm has an outer edge (not centerline) flush with the torso's own outer edge at
    // the shoulder, running perfectly vertical (same x) straight down to the bottom of the
    // torso (this.avatar.y, the avatar sprite's own bottom-anchor point, origin (0.5,1)).
    // Only past that point does it bend and curve out to the hand. The curve's control
    // point sits directly below the elbow (same x) so its initial tangent continues
    // straight down from the segment above it, instead of kinking sharply, before bending
    // toward the hand.
    const quadPoint = (p0: Phaser.Types.Math.Vector2Like, p1: Phaser.Types.Math.Vector2Like, p2: Phaser.Types.Math.Vector2Like, t: number) => ({
      x: (1 - t) * (1 - t) * p0.x! + 2 * (1 - t) * t * p1.x! + t * t * p2.x!,
      y: (1 - t) * (1 - t) * p0.y! + 2 * (1 - t) * t * p1.y! + t * t * p2.y!,
    });
    [
      { shoulder: this.shoulderLeft, hand: handLeft, side: -1 },
      { shoulder: this.shoulderRight, hand: handRight, side: 1 },
    ].forEach(({ shoulder, hand, side }) => {
      // shoulder.x is the torso's own measured outer silhouette edge -- the stroke extends
      // ARM_THICKNESS/2 to either side of ITS centerline, so the centerline itself needs to
      // sit that much further in, or the outer half of the stroke would poke out past the
      // body's true edge (reading as a second, wider "shoulder" bump beside the real one).
      const armTop = { x: shoulder.x - side * (ARM_THICKNESS / 2), y: shoulder.y };
      // Perfectly vertical (same x as armTop, NOT tapered inward) all the way down to the
      // bottom of the torso -- flush with the body's true outer edge the whole way, only
      // bending once it's past the torso and reaching out toward the hand.
      const elbow = { x: armTop.x, y: this.avatar.y };
      const bendControl = { x: elbow.x, y: Phaser.Math.Linear(elbow.y, hand.y, ELBOW_BEND_T) };

      const straightPoints = [armTop, elbow];
      const curvePoints = [elbow, ...[0.25, 0.5, 0.75, 1].map((t) => quadPoint(elbow, bendControl, hand, t))];

      back.lineStyle(ARM_THICKNESS, armColor, 1);
      back.beginPath();
      back.moveTo(straightPoints[0].x, straightPoints[0].y);
      straightPoints.slice(1).forEach((p) => back.lineTo(p.x, p.y));
      back.strokePath();
      // strokePath() strokes each segment as an independent rectangle with no real line
      // join, so the concave (inside) corner at every bend is left as an unstroked notch --
      // stamping a filled circle at each vertex (matching the round shoulder cap below)
      // plugs that gap regardless of how sharp the bend is, instead of relying on the
      // segments happening to overlap enough on their own.
      back.fillStyle(armColor, 1);
      straightPoints.forEach((p) => back.fillCircle(p.x, p.y, ARM_THICKNESS / 2));

      front.lineStyle(ARM_THICKNESS, armColor, 1);
      front.beginPath();
      front.moveTo(curvePoints[0].x, curvePoints[0].y);
      curvePoints.slice(1).forEach((p) => front.lineTo(p.x, p.y));
      front.strokePath();
      front.fillStyle(armColor, 1);
      curvePoints.slice(0, -1).forEach((p) => front.fillCircle(p.x, p.y, ARM_THICKNESS / 2));
    });

    this.leftHand.setPosition(handLeft.x, handLeft.y);
    this.rightHand.setPosition(handRight.x, handRight.y);
  }

  /** How far the catcher's center is allowed to travel, including a bit of off-screen overhang. */
  private getCatcherClampBounds(width = this.scale.width) {
    const half = this.catcher.displayWidth / 2;
    const overhang = this.catcher.displayWidth * CATCHER_OVERHANG_FRACTION;
    return { min: half - overhang, max: width - half + overhang };
  }

  private updateEyes() {
    const { min, max } = this.getCatcherClampBounds();
    const range = Math.max(1, (max - min) / 2);
    const norm = Phaser.Math.Clamp((this.catcher.x - this.scale.width / 2) / range, -1, 1);
    const shiftX = norm * EYE_MAX_SHIFT_X;
    // No vertical "look up" nudge -- the photo-based iris is large and precisely
    // bottom-anchored to the sclera (see eyePupilCenterYBiasLocal), and any shift here
    // would swamp that positioning entirely.
    const targetLeft = { x: this.eyeBaseLeft.x + shiftX, y: this.eyeBaseLeft.y };
    const targetRight = { x: this.eyeBaseRight.x + shiftX, y: this.eyeBaseRight.y };
    this.leftPupil.x = Phaser.Math.Linear(this.leftPupil.x, targetLeft.x, 0.2);
    this.leftPupil.y = Phaser.Math.Linear(this.leftPupil.y, targetLeft.y, 0.2);
    this.rightPupil.x = Phaser.Math.Linear(this.rightPupil.x, targetRight.x, 0.2);
    this.rightPupil.y = Phaser.Math.Linear(this.rightPupil.y, targetRight.y, 0.2);
    this.clipPupilToSclera(this.leftPupil, this.scleraCenterLeft.y);
    this.clipPupilToSclera(this.rightPupil, this.scleraCenterRight.y);
  }

  /** Reschedules itself with a new random delay after each blink, for natural variability. */
  private scheduleBlink() {
    this.blinkTimer = this.time.delayedCall(Phaser.Math.Between(2500, 5500), () => {
      this.doBlink();
      this.scheduleBlink();
    });
  }

  private doBlink() {
    if (this.playState !== "playing") return;
    if (!this.leftPupil.visible || this.avatar.texture.key !== this.avatarProfile.smileKey) return;
    const openDiameter = (this.eyePupilRadiusLocal * 2 * AVATAR_LOCAL_SCALE) / EYE_PUPIL_FILL_RATIO;
    // The iris is deliberately oversized and off-center from the sclera (see
    // eyePupilCenterYBiasLocal) -- the closed-eye shape has no such offset, so sizing/
    // positioning it off the iris's own (inflated, shifted) diameter/position reads as
    // blinking somewhere above the actual eye. Use the sclera's own true size/center
    // instead, which is unaffected by however big we've made the iris.
    const scleraHeightWorld = this.avatarProfile.scleraHeightLocal * AVATAR_LOCAL_SCALE;
    // Deliberately generous -- wide enough to cover the sclera's full almond width, tall
    // enough to fully cover its height with real margin. This only has to reliably COVER
    // the eye opening, not be a precisely-fitted line, so it stays visible/robust at any
    // avatar's actual on-screen scale instead of shrinking down to an unnoticeable sliver.
    const closedWidth = scleraHeightWorld * 3;
    const closedHeight = closedWidth * (EYE_CLOSED_SIZE.h / EYE_CLOSED_SIZE.w);
    const leftPos = this.scleraCenterLeft;
    const rightPos = this.scleraCenterRight;
    [
      { pupil: this.leftPupil, pos: leftPos },
      { pupil: this.rightPupil, pos: rightPos },
    ].forEach(({ pupil, pos }) => {
      pupil.setTexture("eye-closed");
      // Tinted to the avatar's own skin tone so this reads as an eyelid actually closing
      // over the eye (covering both the iris AND the white sclera underneath it),
      // instead of a colored line that still leaves the sclera visible around it.
      pupil.setTint(this.avatarProfile.skinColor);
      pupil.setDisplaySize(closedWidth, closedHeight);
      pupil.setPosition(pos.x, pos.y);
      // clipPupilToSclera's crop rect is sized for the "eye-pupil" texture's own frame --
      // left applied here, it'd crop this completely differently-sized/shaped texture down
      // to almost nothing until updateEyes() next happens to clear it. Clear it immediately
      // instead of waiting a frame.
      pupil.setCrop();
    });
    this.time.delayedCall(140, () => {
      [
        { pupil: this.leftPupil, pos: leftPos, scleraCenterY: this.scleraCenterLeft.y },
        { pupil: this.rightPupil, pos: rightPos, scleraCenterY: this.scleraCenterRight.y },
      ].forEach(({ pupil, pos, scleraCenterY }) => {
        pupil.setTexture("eye-pupil");
        pupil.clearTint();
        pupil.setDisplaySize(openDiameter, openDiameter);
        pupil.setPosition(pos.x, pos.y);
        // Don't wait for the next update() tick's updateEyes() to reapply this -- restore
        // it here directly so the eye is never even one frame away from correct.
        this.clipPupilToSclera(pupil, scleraCenterY);
      });
    });
  }

  private setCharacterVisible(visible: boolean) {
    this.catcher.setVisible(visible);
    this.catcherShadow.setVisible(visible);
    this.avatar.setVisible(visible);
    // Both mood art states have their own baked-in eyes; the movable pupils only belong
    // on top of the smile state (the frown state's eyes are already closed in the art).
    const notSad = this.avatar.texture.key === this.avatarProfile.smileKey;
    this.leftPupil.setVisible(visible && notSad);
    this.rightPupil.setVisible(visible && notSad);
    this.armsBackGraphics.setVisible(visible);
    this.armsFrontGraphics.setVisible(visible);
    this.leftHand.setVisible(visible);
    this.rightHand.setVisible(visible);
  }

  private destroyHalo(halo: Phaser.GameObjects.Image | undefined) {
    if (!halo) return;
    halo.destroy();
    this.halos = this.halos.filter((h) => h !== halo);
  }

  private clearHalos() {
    this.halos.forEach((h) => h.destroy());
    this.halos = [];
  }

  /**
   * Shows the character/suitcase and resets round state, but does NOT start item
   * spawning (see spawningEnabled / beginSpawning) -- split out of what used to be a
   * single startGame() so a generated avatar's reveal -> flourish -> "Hurry and pack!"
   * sequence can have the character visible and blinking for a moment with nothing
   * falling yet. update() only runs at all once playState is "playing" (blinking, arm
   * sway, etc. all live there), so this sets that immediately rather than introducing a
   * separate "revealed but frozen" state, which would leave the character looking dead
   * during the flourish.
   */
  private prepareCharacter() {
    this.items.clear(true, true);
    this.clearHalos();
    this.catcher.x = this.scale.width / 2;
    this.score = 0;
    this.lives = 3;
    this.candyCount = 0;
    this.lastSpawnedKey = null;
    this.spawnZoneBag = [];
    this.speedStage = 0;
    this.bonusPaused = false;
    this.bonusPauseRemaining = 0;
    this.physics.resume();
    this.tweens.resumeAll();
    this.time.paused = false;
    if (this.moodTimer) {
      this.moodTimer.remove();
      this.moodTimer = null;
    }
    this.avatar.setTexture(this.avatarProfile.smileKey);
    this.leftPupil.setVisible(true);
    this.rightPupil.setVisible(true);
    this.elapsed = 0;
    this.spawnAccum = 0;
    this.spawningEnabled = false;
    this.playState = "playing";
    this.drawArms();
    this.setCharacterVisible(true);
    gameEvents.emit("score-change", { score: this.score });
    gameEvents.emit("lives-change", { lives: this.lives });
    gameEvents.emit("candy-change", { count: this.candyCount });
    gameEvents.emit("speed-stage", { stage: 0 });
    gameEvents.emit("state-change", { state: "playing" });
  }

  /** Starts item spawning on an already-revealed character (see prepareCharacter). Resets
   *  spawnAccum so time elapsed during a pre-spawn flourish doesn't cause an instant burst
   *  of spawns the moment spawning turns on. */
  private beginSpawning() {
    this.spawnAccum = 0;
    this.spawningEnabled = true;
  }

  private endGame() {
    this.playState = "over";
    this.bonusPaused = false;
    this.bonusPauseRemaining = 0;
    this.physics.resume();
    this.tweens.resumeAll();
    this.time.paused = false;
    this.items.clear(true, true);
    this.clearHalos();
    // A bad catch's 450ms mood-timer (see handleCatch) can still be pending if that
    // catch is what ended the game — left running, it would re-show the pupils after
    // everything else is already hidden, leaving them floating on the game-over screen.
    if (this.moodTimer) {
      this.moodTimer.remove();
      this.moodTimer = null;
    }
    this.setCharacterVisible(false);
    gameEvents.emit("state-change", { state: "gameover" });
  }

  private handleCatch = (
    catcherObj: Phaser.GameObjects.GameObject,
    itemObj: Phaser.GameObjects.GameObject
  ) => {
    const sprite = itemObj as Phaser.Physics.Arcade.Image;
    const def = sprite.getData("item") as ItemDef;
    if (!def || sprite.getData("caught")) return;
    sprite.setData("caught", true);
    (sprite.body as Phaser.Physics.Arcade.Body).enable = false;

    const halo = sprite.getData("halo") as Phaser.GameObjects.Image | undefined;
    if (halo) {
      this.tweens.add({ targets: halo, alpha: 0, duration: 200, onComplete: () => this.destroyHalo(halo) });
    }
    // Companion visuals (e.g. the ring's sparkle, the swimsuit's top/bottom pieces) fade
    // out alongside the sprite instead of vanishing abruptly.
    const companions = sprite.getData("companions") as Phaser.GameObjects.GameObject[] | undefined;
    const catchTargets = companions ? [sprite, ...companions] : sprite;

    if (def.kind === "good") {
      this.score += def.points;
      gameEvents.emit("score-change", { score: this.score });
      if (def.key.startsWith("candy-")) {
        this.candyCount += 1;
        gameEvents.emit("candy-change", { count: this.candyCount });
        if (this.candyCount % MINI_BONUS_INTERVAL === 0) this.triggerMiniBonus();
      }
      gameEvents.emit("catch-good", { x: sprite.x, y: sprite.y, points: def.points, label: def.label });
      this.tweens.add({
        targets: catchTargets,
        scale: sprite.scale * 1.4,
        alpha: 0,
        duration: 220,
        ease: "Cubic.easeOut",
        onComplete: () => sprite.destroy(),
      });
    } else {
      this.lives -= 1;
      this.score = Math.max(0, this.score + def.points);
      this.avatar.setTexture(this.avatarProfile.frownKey);
      this.leftPupil.setVisible(false);
      this.rightPupil.setVisible(false);
      if (this.moodTimer) this.moodTimer.remove();
      this.moodTimer = this.time.delayedCall(450, () => {
        this.avatar.setTexture(this.avatarProfile.smileKey);
        this.leftPupil.setVisible(true);
        this.rightPupil.setVisible(true);
        this.moodTimer = null;
      });
      gameEvents.emit("lives-change", { lives: this.lives });
      gameEvents.emit("score-change", { score: this.score });
      gameEvents.emit("catch-bad", { x: sprite.x, y: sprite.y, points: def.points, label: def.label });
      this.cameras.main.shake(160, 0.008);
      this.cameras.main.flash(160, 233, 75, 92, false);
      this.tweens.add({
        targets: catchTargets,
        scale: sprite.scale * 1.2,
        alpha: 0,
        duration: 220,
        ease: "Cubic.easeOut",
        onComplete: () => sprite.destroy(),
      });
      if (this.lives <= 0) {
        this.endGame();
      }
    }
  };

  // Fires every 20 candies (20, 40, 60, ...). Freezes gameplay briefly so the
  // popup/flash/background-dance all read clearly instead of getting lost mid-catch.
  // The resume is counted down in update() via delta rather than a Phaser delayedCall,
  // since this.time itself gets paused below (to freeze every timer-driven item
  // animation) and a delayedCall on a paused clock would never fire.
  private triggerMiniBonus() {
    this.score += 100;
    gameEvents.emit("score-change", { score: this.score });
    gameEvents.emit("mini-bonus", { count: this.candyCount });
    this.cameras.main.flash(180, 255, 255, 255, false);
    this.bonusPaused = true;
    this.bonusPauseRemaining = 1400;
    this.physics.pause();
    this.tweens.pauseAll();
    this.time.paused = true;
  }

  /**
   * A pure independent random-per-spawn x reads as "streaming" toward one
   * side for several spawns in a row purely by chance. Instead, divide the
   * spawnable width into zones and draw from a shuffled bag of zones (with
   * jitter inside each) so every part of the width gets a fair, non-streaky
   * turn before any zone repeats.
   */
  private static readonly SPAWN_ZONES = 6;

  private shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private nextSpawnX(itemSize: number) {
    if (this.spawnZoneBag.length === 0) {
      this.spawnZoneBag = this.shuffle(Array.from({ length: MainScene.SPAWN_ZONES }, (_, i) => i));
    }
    const zone = this.spawnZoneBag.pop()!;
    const overhang = itemSize * ITEM_EDGE_OVERHANG_FRACTION;
    const minX = -overhang;
    const maxX = this.scale.width + overhang;
    const zoneWidth = (maxX - minX) / MainScene.SPAWN_ZONES;
    return minX + zone * zoneWidth + Math.random() * zoneWidth;
  }

  /** Staged pacing: gets faster after 60s, faster again after 90s (see update()). */
  private getSpeedFactor() {
    let factor = Math.min(150, this.elapsed * 2.2);
    if (this.elapsed >= 60) factor += 40;
    if (this.elapsed >= 90) factor += 40;
    return factor;
  }

  private getSpawnDelay() {
    let minDelay = 360;
    if (this.elapsed >= 60) minDelay = 300;
    if (this.elapsed >= 90) minDelay = 250;
    return Math.max(minDelay, 900 - this.elapsed * 5.5);
  }

  /** Items that rock via an explicit angle tween instead of the default constant spin. */
  private static readonly ROCKING_ITEMS = new Set(["bad-email", "credit-card"]);

  private spawnItem() {
    let def = pickWeighted(ALL_ITEMS);
    for (let attempts = 0; attempts < 6 && def.key === this.lastSpawnedKey && ALL_ITEMS.length > 1; attempts++) {
      def = pickWeighted(ALL_ITEMS);
    }
    this.lastSpawnedKey = def.key;
    const x = this.nextSpawnX(def.size);
    const sprite = this.items.create(x, -def.size, def.key) as Phaser.Physics.Arcade.Image;
    sprite.setDepth(1.2);
    sprite.setData("item", def);
    sprite.setData("caught", false);

    // Soft dark halo behind the item so it reads clearly against the busy background.
    const halo = this.add.image(x, -def.size, ITEM_HALO_KEY);
    halo.setDepth(1.15);
    const haloSize = def.size * 2.1;
    halo.setDisplaySize(haloSize, haloSize);
    this.halos.push(halo);
    sprite.setData("halo", halo);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(def.size * 0.42, def.size * 0.08, def.size * 0.08);

    const speedFactor = this.getSpeedFactor();
    const vy = Phaser.Math.Between(190 + speedFactor, 260 + speedFactor);
    sprite.setVelocityY(vy);
    // Rocking items sway via an explicit angle tween (below) instead of a constant spin;
    // the plane stays fully static (only its exclamation-mark overlay animates).
    const isRocking = MainScene.ROCKING_ITEMS.has(def.key);
    const isStatic = def.key === "bad-plane";
    sprite.setAngularVelocity(
      def.tumbles ? Phaser.Math.Between(-50, 50) : isRocking || isStatic ? 0 : Phaser.Math.Between(-8, 8)
    );

    // The email icon animates between two art states — paper popped out, and paper
    // retracted lower into the envelope — while it rocks side to side as it falls.
    if (def.key === "bad-email") {
      const toggleTimer = this.time.addEvent({
        delay: 260,
        loop: true,
        callback: () => {
          sprite.setTexture(sprite.texture.key === "bad-email" ? "bad-email-in" : "bad-email");
        },
      });
      sprite.once(Phaser.GameObjects.Events.DESTROY, () => toggleTimer.remove());
    }

    if (isRocking) {
      this.tweens.add({
        targets: sprite,
        angle: { from: -12, to: 12 },
        duration: 450,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // The diamond glints in a 1,2,1,3 repeating sequence while a pulsing sparkle sits
    // on the facet — the sparkle is a separate image, position-synced via syncTargets.
    if (def.key === "ring") {
      const frames = ["ring", "ring-2", "ring", "ring-3"];
      let frameIdx = 0;
      const frameTimer = this.time.addEvent({
        delay: 220,
        loop: true,
        callback: () => {
          frameIdx = (frameIdx + 1) % frames.length;
          sprite.setTexture(frames[frameIdx]);
        },
      });
      sprite.once(Phaser.GameObjects.Events.DESTROY, () => frameTimer.remove());

      const sparkle = this.add.image(x, -def.size, "sparkle");
      sparkle.setDepth(1.25);
      const sparkleSize = def.size * 0.42;
      sparkle.setDisplaySize(sparkleSize, sparkleSize);
      const sparkleDy = -def.size * (115 / 360);
      sprite.setData("syncTargets", [{ obj: sparkle, dx: 0, dy: sparkleDy }]);
      sprite.setData("companions", [sparkle]);
      sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
        this.tweens.killTweensOf(sparkle);
        sparkle.destroy();
      });
      this.tweens.add({
        targets: sparkle,
        scale: { from: sparkle.scale * 0.6, to: sparkle.scale * 1.15 },
        alpha: { from: 0.5, to: 1 },
        duration: 480,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // Staged storm sequence: plain cloud (brief) -> lightning flash -> rain starts ->
    // rain falls further, then fades out and loops back to the plain cloud. The loop-back
    // fade tweens only the animated `sprite` -- a second, always-opaque plain-cloud image
    // sits directly behind it (same shape/position, since cloud1's body art is byte-identical
    // to the body baked into every other frame) so fading the front layer only ever reveals
    // that solid cloud underneath, never empty background. The rain/lightning extras have
    // nothing behind them, so they're what actually reads as fading -- the cloud itself never
    // visibly disappears.
    if (def.key === "bad-weather") {
      const frames = ["bad-weather", "bad-weather-2", "bad-weather-3", "bad-weather-4"];
      const durations = [90, 250, 300, 300];
      const cloudBody = this.add.image(x, -def.size, "bad-weather");
      cloudBody.setDepth(1.19);
      sprite.setData("syncTargets", [{ obj: cloudBody, dx: 0, dy: 0 }]);
      let cancelled = false;
      sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
        cancelled = true;
        cloudBody.destroy();
      });
      const playStep = (i: number) => {
        if (cancelled) return;
        sprite.setTexture(frames[i]);
        sprite.setAlpha(1);
        this.time.delayedCall(durations[i], () => {
          if (cancelled) return;
          if (i < frames.length - 1) {
            playStep(i + 1);
            return;
          }
          this.tweens.add({
            targets: sprite,
            alpha: 0,
            duration: 300,
            onComplete: () => {
              if (cancelled) return;
              sprite.setAlpha(1);
              playStep(0);
            },
          });
        });
      };
      playStep(0);
    }

    // The pen nudges back and forth between the two art states while it falls.
    if (def.key === "journal") {
      const toggleTimer = this.time.addEvent({
        delay: 200,
        loop: true,
        callback: () => {
          sprite.setTexture(sprite.texture.key === "journal" ? "journal-2" : "journal");
        },
      });
      sprite.once(Phaser.GameObjects.Events.DESTROY, () => toggleTimer.remove());
    }

    // The plane itself never moves — only the exclamation mark, a separate cropped overlay
    // (see PLANE_ICON_FRAME), pulses larger/smaller and gives a quick shake while enlarged.
    if (def.key === "bad-plane") {
      const iconWidth = (PLANE_ICON_FRAME.width / 360) * def.size;
      const iconHeight = (PLANE_ICON_FRAME.height / 360) * def.size;
      const icon = this.add.image(x, -def.size, "plane-icon-small-art", "icon");
      icon.setDepth(1.25);
      icon.setDisplaySize(iconWidth, iconHeight);
      sprite.setData("syncTargets", [{ obj: icon, dx: 0, dy: 0 }]);
      sprite.setData("companions", [icon]);

      let cancelled = false;
      sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
        cancelled = true;
        this.tweens.killTweensOf(icon);
        icon.destroy();
      });
      const PULSES = 3;
      const runCycle = () => {
        if (cancelled) return;
        let toggles = 0;
        const pulseTimer = this.time.addEvent({
          delay: 200,
          loop: true,
          callback: () => {
            if (cancelled) {
              pulseTimer.remove();
              return;
            }
            const isSmall = icon.texture.key === "plane-icon-small-art";
            icon.setTexture(isSmall ? "plane-icon-large-art" : "plane-icon-small-art", "icon");
            toggles++;
            if (toggles >= PULSES * 2) {
              pulseTimer.remove();
              icon.setTexture("plane-icon-large-art", "icon");
              this.tweens.add({
                targets: icon,
                angle: { from: -6, to: 6 },
                duration: 55,
                yoyo: true,
                repeat: 3,
                ease: "Sine.easeInOut",
                onComplete: () => {
                  icon.angle = 0;
                  icon.setTexture("plane-icon-small-art", "icon");
                  if (!cancelled) runCycle();
                },
              });
            }
          },
        });
      };
      runCycle();
    }

    // The swimsuit's top and bottom pieces wiggle independently — separate images
    // pivoting at the seam, position-synced to the (invisible) physics sprite below.
    if (def.key === "swimsuit") {
      sprite.setAlpha(0);
      const displayScale = def.size / SVG_RENDER_SIZE;
      const topHeight = SWIMSUIT_TOP_FRAME.height * SWIMSUIT_RENDER_SCALE * displayScale;
      const bottomHeight = SWIMSUIT_BOTTOM_FRAME.height * SWIMSUIT_RENDER_SCALE * displayScale;

      const top = this.add.image(x, -def.size - def.size / 2, "swimsuit-art", "swimsuit-top");
      top.setOrigin(0.5, 0);
      top.setDisplaySize(def.size, topHeight);
      top.setDepth(1.2);

      const bottom = this.add.image(x, -def.size + def.size / 2, "swimsuit-art", "swimsuit-bottom");
      bottom.setOrigin(0.5, 1);
      bottom.setDisplaySize(def.size, bottomHeight);
      bottom.setDepth(1.2);

      sprite.setData("syncTargets", [
        { obj: top, dx: 0, dy: -def.size / 2 },
        { obj: bottom, dx: 0, dy: def.size / 2 },
      ]);
      sprite.setData("companions", [top, bottom]);
      sprite.once(Phaser.GameObjects.Events.DESTROY, () => {
        this.tweens.killTweensOf([top, bottom]);
        top.destroy();
        bottom.destroy();
      });

      this.tweens.add({
        targets: top,
        angle: { from: -4, to: 4 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.tweens.add({
        targets: bottom,
        angle: { from: -4, to: 4 },
        duration: 900,
        delay: 150,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  update(_time: number, delta: number) {
    if (this.playState !== "playing") return;

    if (this.bonusPaused) {
      this.bonusPauseRemaining -= delta;
      if (this.bonusPauseRemaining <= 0) {
        this.bonusPaused = false;
        this.physics.resume();
        this.tweens.resumeAll();
        this.time.paused = false;
      }
      return;
    }

    if (this.controlMode === "tilt" && this.tiltActive) {
      this.catcher.x = Phaser.Math.Linear(this.catcher.x, this.tiltTargetX, 0.18);
    }

    this.drawArms();
    this.updateEyes();

    this.elapsed += delta / 1000;
    if (this.spawningEnabled) {
      this.spawnAccum += delta;
      if (this.spawnAccum >= this.getSpawnDelay()) {
        this.spawnAccum = 0;
        this.spawnItem();
      }
    }

    if (this.speedStage === 0 && this.elapsed >= 60) {
      this.speedStage = 1;
      gameEvents.emit("speed-stage", { stage: 1 });
    } else if (this.speedStage === 1 && this.elapsed >= 90) {
      this.speedStage = 2;
      gameEvents.emit("speed-stage", { stage: 2 });
    }

    const bottom = this.scale.height + 100;
    this.items.getChildren().forEach((child) => {
      const sprite = child as Phaser.Physics.Arcade.Image;
      const halo = sprite.getData("halo") as Phaser.GameObjects.Image | undefined;
      if (halo) halo.setPosition(sprite.x, sprite.y);
      const syncTargets = sprite.getData("syncTargets") as
        | { obj: Phaser.GameObjects.Image; dx: number; dy: number }[]
        | undefined;
      if (syncTargets) syncTargets.forEach(({ obj, dx, dy }) => obj.setPosition(sprite.x + dx, sprite.y + dy));
      // A missed item otherwise just gets clipped by the canvas's own bottom edge -- a hard,
      // flat cutoff. Fade it out over the last stretch above that edge instead, so it visibly
      // dissolves rather than vanishing behind a boundary. Skip caught items -- their catch
      // tween already animates alpha to 0 on its own.
      if (!sprite.getData("caught")) {
        const fade = 1 - Phaser.Math.Clamp((sprite.y - (this.scale.height - ITEM_FADE_ZONE)) / ITEM_FADE_ZONE, 0, 1);
        sprite.setAlpha(fade);
        if (halo) halo.setAlpha(fade);
        if (syncTargets) syncTargets.forEach(({ obj }) => obj.setAlpha(fade));
      }
      if (sprite.y > bottom) {
        this.destroyHalo(halo);
        sprite.destroy();
      }
    });
  }
}
