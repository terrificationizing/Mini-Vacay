"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarSource, ControlMode, gameCommands, gameEvents } from "@/game/eventBus";
import { musicEngine } from "@/game/music";
import { sfxEngine } from "@/game/sfx";
import { AVATAR_PROFILES } from "@/data/avatarProfiles";
import { addCreatedAvatar, CreatedAvatarEntry, loadAvatarLibrary, removeCreatedAvatar, renameCreatedAvatar } from "@/lib/avatarLibrary";
import Background from "./Background";
import Logo from "./Logo";
import Hud, { HUD_BAR_RADIUS } from "./Hud";
import StartScreen from "./StartScreen";
import GameOverScreen from "./GameOverScreen";
import CatchPopups from "./CatchPopups";
import MiniBonusPopup from "./MiniBonusPopup";
import TiltPermissionPrompt from "./TiltPermissionPrompt";
import PhotoSelectScreen from "./PhotoSelectScreen";
import AvatarGeneratingScreen from "./AvatarGeneratingScreen";
import AvatarSelectionScreen from "./AvatarSelectionScreen";
import AvatarPreparingScreen from "./AvatarPreparingScreen";
import AvatarFlourish from "./AvatarFlourish";

const PhaserGame = dynamic(() => import("./PhaserGame"), { ssr: false });

const HIGH_SCORE_KEY = "miniVacayHighScore";
const TOP_BAR_HEIGHT = 195;
const SCORE_ROW_HEIGHT = 52;
const BOTTOM_BAR_HEIGHT = 24;

// A second, React-only state machine layered on top of uiState, active only while
// uiState === "start" -- everything before Phaser's own "playing" state begins. Picking a
// preloaded/library avatar skips straight through to "start" (no generation needed);
// generating a custom one walks through every state below in order.
type AvatarFlowState = "closed" | "photoSelect" | "generating" | "selecting" | "preparing" | "flourish";

type DeviceOrientationEventIOS = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

// AvatarGeometry's eyeLocal.y is in "local" units (canvas px / 2, see lib/avatarPipeline.ts);
// GameOverScreen's per-avatar crop calibration wants it as a plain percentage of the shared
// 720x1100 canvas height.
const CANVAS_H = 1100;
function eyeYPctFromLocal(eyeLocalY: number): number {
  return ((eyeLocalY * 2) / CANVAS_H) * 100;
}

async function requestTiltPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return false;
  const DOE = DeviceOrientationEvent as DeviceOrientationEventIOS;
  if (typeof DOE.requestPermission === "function") {
    try {
      const result = await DOE.requestPermission();
      return result === "granted";
    } catch {
      return false;
    }
  }
  return true;
}

export default function GameRoot() {
  const [uiState, setUiState] = useState<"start" | "playing" | "gameover">("start");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [candyCount, setCandyCount] = useState(0);
  const [bonusCount, setBonusCount] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [controlMode, setControlMode] = useState<ControlMode>("drag");
  const [muted, setMuted] = useState(false);
  const [showTiltPermissionPrompt, setShowTiltPermissionPrompt] = useState(false);
  const tiltListenerAdded = useRef(false);
  // Whether the player has already made an explicit tilt-vs-drag choice this session (via
  // TiltPermissionPrompt) or already gone through the native permission prompt once -- once
  // true, resolveControlMode never asks again, same as the native prompt itself only ever
  // fires once per session.
  const tiltChoiceMadeRef = useRef(false);
  const tiltChoiceResolverRef = useRef<((useTilt: boolean) => void) | null>(null);

  const [avatarFlow, setAvatarFlow] = useState<AvatarFlowState>("closed");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [chosenCandidateUrl, setChosenCandidateUrl] = useState<string | null>(null);
  const [avatarLibrary, setAvatarLibrary] = useState<CreatedAvatarEntry[]>([]);
  const [detectedIrisColor, setDetectedIrisColor] = useState<number | null>(null);
  const [currentAvatarFrownSrc, setCurrentAvatarFrownSrc] = useState<string | null>(null);
  const [currentAvatarSmileSrc, setCurrentAvatarSmileSrc] = useState<string | null>(null);
  const [currentAvatarIrisColor, setCurrentAvatarIrisColor] = useState<number | null>(null);
  const [currentAvatarEyeYPct, setCurrentAvatarEyeYPct] = useState<number | null>(null);

  useEffect(() => {
    setAvatarLibrary(loadAvatarLibrary());
  }, []);

  // No manual drag/tilt picker anymore -- tilt is the default on touch-capable (mobile)
  // devices, since that's the only place a tilt sensor exists; desktop always uses drag.
  useEffect(() => {
    const supportsTilt = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    setControlMode(supportsTilt ? "tilt" : "drag");
  }, []);

  const handleTiltEvent = useCallback((e: DeviceOrientationEvent) => {
    if (e.gamma == null) return;
    gameCommands.emit("tilt", { gamma: e.gamma });
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(HIGH_SCORE_KEY);
    if (stored) setHighScore(Number(stored));
  }, []);

  useEffect(() => {
    if (uiState !== "gameover") return;
    setHighScore((prev) => {
      if (score <= prev) return prev;
      window.localStorage.setItem(HIGH_SCORE_KEY, String(score));
      return score;
    });
  }, [uiState, score]);

  useEffect(() => {
    const offState = gameEvents.on("state-change", ({ state }) => {
      setUiState(state);
      if (state === "gameover") {
        musicEngine.setPlaybackRate(1);
        musicEngine.startEndcard();
      }
    });
    const offScore = gameEvents.on("score-change", ({ score }) => setScore(score));
    const offLives = gameEvents.on("lives-change", ({ lives }) => setLives(lives));
    const offCandy = gameEvents.on("candy-change", ({ count }) => {
      setCandyCount(count);
      if (count === 0) setBonusCount(0);
    });
    const offCatchBad = gameEvents.on("catch-bad", () => sfxEngine.playPunch());
    const offCatchGood = gameEvents.on("catch-good", () => sfxEngine.playHarpFlourish());
    const offMiniBonus = gameEvents.on("mini-bonus", () => {
      sfxEngine.playBonusFanfare();
      setBonusCount((prev) => prev + 1);
    });
    const offSpeedStage = gameEvents.on("speed-stage", ({ stage }) => {
      musicEngine.setPlaybackRate(stage === 2 ? 1.3 : stage === 1 ? 1.15 : 1);
    });
    return () => {
      offState();
      offScore();
      offLives();
      offCandy();
      offCatchBad();
      offCatchGood();
      offMiniBonus();
      offSpeedStage();
      if (tiltListenerAdded.current) {
        window.removeEventListener("deviceorientation", handleTiltEvent);
      }
      musicEngine.destroy();
      sfxEngine.destroy();
    };
  }, [handleTiltEvent]);

  const ensureTiltListener = useCallback(async () => {
    if (tiltListenerAdded.current) return true;
    const granted = await requestTiltPermission();
    if (granted) {
      window.addEventListener("deviceorientation", handleTiltEvent);
      tiltListenerAdded.current = true;
    }
    return granted;
  }, [handleTiltEvent]);

  // Lets the player pick drag controls up front, before ever seeing the native "Allow
  // Motion & Orientation Access?" prompt -- previously the only way to end up with drag on
  // a tilt-capable device was to deny that (unexplained, OS-styled) native prompt. Shown at
  // most once per session; resolves to whichever button the player taps.
  const askTiltOrDrag = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      tiltChoiceResolverRef.current = resolve;
      setShowTiltPermissionPrompt(true);
    });
  }, []);

  const handleTiltPermissionChoice = useCallback((useTilt: boolean) => {
    setShowTiltPermissionPrompt(false);
    tiltChoiceMadeRef.current = true;
    tiltChoiceResolverRef.current?.(useTilt);
    tiltChoiceResolverRef.current = null;
  }, []);

  // Resolves the control mode actually usable for this play: asks tilt-vs-drag up front
  // (once per session) if the player hasn't already chosen, then requests the native tilt
  // permission if they opted in, falling back (and updating the stored preference) to drag
  // on denial either way.
  const resolveControlMode = useCallback(async () => {
    let mode = controlMode;
    if (mode === "tilt") {
      if (!tiltChoiceMadeRef.current) {
        const useTilt = await askTiltOrDrag();
        if (!useTilt) {
          mode = "drag";
          setControlMode("drag");
          return mode;
        }
      }
      const granted = await ensureTiltListener();
      if (!granted) {
        mode = "drag";
        setControlMode("drag");
      }
    }
    return mode;
  }, [controlMode, ensureTiltListener, askTiltOrDrag]);

  // A "setAvatar" command's own promise (real for a generated avatar's async texture
  // load, instant for a preloaded one) isn't observable from here -- MainScene emits
  // "avatar-ready" once it's actually finished applying. Without awaiting this,
  // "revealAvatar" emitted right after "setAvatar" could call prepareCharacter() against
  // the avatar that was showing BEFORE this pick, since only the emission order (not
  // completion) was ever guaranteed -- this is what caused a freshly-generated avatar to
  // render with no irises until the next mood-swap (frown/smile) forced a re-apply.
  const waitForAvatarReady = useCallback(
    () =>
      new Promise<void>((resolve) => {
        const off = gameEvents.on("avatar-ready", () => {
          off();
          resolve();
        });
      }),
    []
  );

  const restartGame = useCallback(async () => {
    // Started BEFORE the await, not after -- resolveControlMode() can await a real
    // native permission prompt (DeviceOrientationEvent.requestPermission on iOS), and
    // browsers only allow .play() within the original click's gesture window. Awaiting
    // first (as this used to) let that window lapse, so music silently failed to start
    // on the very first play and only worked once the tilt listener was already granted
    // from a prior attempt (making the await resolve fast enough not to matter).
    musicEngine.start();
    const mode = await resolveControlMode();
    gameCommands.emit("restart", { controlMode: mode });
  }, [resolveControlMode]);

  const startOver = useCallback(() => {
    musicEngine.start();
    // Clears the stale captured selfie/upload from the previous round -- otherwise
    // PhotoSelectScreen sees a non-null capturedPhotoDataUrl and skips straight to its
    // "your photo -> Make a Mini Me!" view instead of the picker grid, forcing an
    // unnecessary regeneration even when the player just wants to keep playing as an
    // avatar (preloaded or already-created) they can pick without generating anything.
    setCapturedPhoto(null);
    gameCommands.emit("resetToStart", undefined);
  }, []);

  // Preloaded or library pick: already fully processed, so this skips straight to
  // gameplay -- setAvatar first, then reveals the character/suitcase and either starts
  // spawning right away or shows the tilt tip first.
  const pickAvatarAndPlay = useCallback(
    async (source: AvatarSource) => {
      // Started before resolveControlMode()'s await, same reasoning as restartGame above --
      // this is the primary "start playing" path (tapping an avatar grid slot), so it's the
      // one most likely to be a player's very first music-start attempt of the session.
      musicEngine.start();
      // Registered BEFORE emitting "setAvatar", not after -- for a preloaded avatar,
      // MainScene's handler applies the profile and emits "avatar-ready" synchronously
      // inside this same emit() call. Waiting until after emit() to call
      // waitForAvatarReady() would register the listener too late to ever see that
      // synchronous event, leaving this promise permanently unresolved (the generated-
      // avatar path has a real async gap before its own "avatar-ready", so it was never
      // affected by this ordering).
      const avatarReadyPromise = waitForAvatarReady();
      gameCommands.emit("setAvatar", source);
      if (source.kind === "preloaded") {
        const profile = AVATAR_PROFILES.find((p) => p.id === source.id);
        setCurrentAvatarFrownSrc(profile?.frownSrc ?? null);
        setCurrentAvatarSmileSrc(profile?.smileSrc ?? null);
        setCurrentAvatarIrisColor(profile?.irisColor ?? null);
        setCurrentAvatarEyeYPct(profile ? eyeYPctFromLocal(profile.eyeLocal.left.y) : null);
      } else {
        setCurrentAvatarFrownSrc(source.frownDataUrl);
        setCurrentAvatarSmileSrc(source.smileDataUrl);
        setCurrentAvatarIrisColor(source.geometry.irisColor);
        setCurrentAvatarEyeYPct(eyeYPctFromLocal(source.geometry.eyeLocal.left.y));
      }
      setAvatarFlow("closed");
      // Run concurrently -- resolveControlMode() and the avatar's own texture load are
      // unrelated, so there's no need to serialize them just because both must finish
      // before revealAvatar can safely fire.
      const [mode] = await Promise.all([resolveControlMode(), avatarReadyPromise]);
      gameCommands.emit("revealAvatar", { controlMode: mode });
      gameCommands.emit("beginSpawning", undefined);
    },
    [resolveControlMode, waitForAvatarReady]
  );

  const handleUsePreloaded = useCallback((id: string) => pickAvatarAndPlay({ kind: "preloaded", id }), [pickAvatarAndPlay]);

  const handleUseCreated = useCallback(
    (entry: CreatedAvatarEntry) =>
      pickAvatarAndPlay({
        kind: "generated",
        id: entry.id,
        geometry: entry.geometry,
        smileDataUrl: entry.smileDataUrl,
        frownDataUrl: entry.frownDataUrl,
      }),
    [pickAvatarAndPlay]
  );

  const handleDeleteCreated = useCallback((id: string) => {
    setAvatarLibrary((prev) => removeCreatedAvatar(prev, id));
  }, []);

  const handleRenameCreated = useCallback((id: string, name: string) => {
    setAvatarLibrary((prev) => renameCreatedAvatar(prev, id, name));
  }, []);

  const handleTryAgain = useCallback(() => {
    setCandidates([]);
    setAvatarFlow("photoSelect");
  }, []);

  const handlePreparingReady = useCallback(
    async (entry: CreatedAvatarEntry) => {
      setAvatarLibrary((prev) => addCreatedAvatar(prev, entry));
      gameCommands.emit("setAvatar", {
        kind: "generated",
        id: entry.id,
        geometry: entry.geometry,
        smileDataUrl: entry.smileDataUrl,
        frownDataUrl: entry.frownDataUrl,
      });
      setCurrentAvatarFrownSrc(entry.frownDataUrl);
      setCurrentAvatarSmileSrc(entry.smileDataUrl);
      setCurrentAvatarIrisColor(entry.geometry.irisColor);
      setCurrentAvatarEyeYPct(eyeYPctFromLocal(entry.geometry.eyeLocal.left.y));
      const [mode] = await Promise.all([resolveControlMode(), waitForAvatarReady()]);
      musicEngine.start();
      gameCommands.emit("revealAvatar", { controlMode: mode });
      setAvatarFlow("flourish");
    },
    [resolveControlMode, waitForAvatarReady]
  );

  const handlePreparingError = useCallback(() => {
    setAvatarFlow("photoSelect");
  }, []);

  const handleFlourishDone = useCallback(() => {
    gameCommands.emit("beginSpawning", undefined);
    setAvatarFlow("closed");
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      musicEngine.setMuted(next);
      sfxEngine.setMuted(next);
      return next;
    });
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <Background />

      {uiState === "playing" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: `calc(env(safe-area-inset-top, 0px) + ${TOP_BAR_HEIGHT}px)`,
            paddingTop: `calc(env(safe-area-inset-top, 0px) + ${SCORE_ROW_HEIGHT}px)`,
            zIndex: 10,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <Logo width={155} />
        </div>
      )}

      {uiState === "playing" && <Hud score={score} lives={lives} />}

      {uiState === "playing" && (
        <button
          onClick={startOver}
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: `calc(env(safe-area-inset-bottom, 0px) + 20px)`,
            zIndex: 20,
            background: "none",
            border: "none",
            padding: 4,
            cursor: "pointer",
            fontFamily: "var(--font-baloo)",
            fontWeight: 600,
            fontSize: 12,
            letterSpacing: 0.5,
            color: "#ffffff",
            textShadow: "0 1px 2px rgba(0,0,0,0.25)",
          }}
        >
          EXIT GAME
        </button>
      )}

      <div
        style={{
          position: "absolute",
          top: "env(safe-area-inset-top, 0px)",
          bottom: `calc(env(safe-area-inset-bottom, 0px) + ${BOTTOM_BAR_HEIGHT}px)`,
          left: 0,
          right: 0,
          zIndex: 5,
        }}
      >
        <PhaserGame />
        <CatchPopups />
        <MiniBonusPopup />
        {uiState === "start" && avatarFlow === "preparing" && chosenCandidateUrl && (
          <AvatarPreparingScreen
            smileImageUrl={chosenCandidateUrl}
            irisColor={detectedIrisColor}
            onReady={handlePreparingReady}
            onError={handlePreparingError}
          />
        )}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: `calc(env(safe-area-inset-bottom, 0px) + ${BOTTOM_BAR_HEIGHT}px)`,
          zIndex: 10,
          pointerEvents: "none",
        }}
      />

      <button
        onClick={toggleMute}
        aria-label={muted ? "Unmute music" : "Mute music"}
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 10px)",
          right: 14,
          zIndex: 30,
          width: 34,
          height: 34,
          borderRadius: HUD_BAR_RADIUS,
          border: "none",
          background: muted ? "#ffe3c9" : "rgba(255,255,255,0.85)",
          padding: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 2px 0 rgba(0,0,0,0.12)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/soundoff.svg"
          alt=""
          style={{ width: "100%", height: "100%" }}
        />
      </button>

      {uiState === "start" && avatarFlow === "closed" && (
        <StartScreen onPlay={() => setAvatarFlow("photoSelect")} highScore={highScore} />
      )}
      {uiState === "start" && avatarFlow === "photoSelect" && (
        <PhotoSelectScreen
          capturedPhotoDataUrl={capturedPhoto}
          onPhotoReady={setCapturedPhoto}
          onDiscardPhoto={() => setCapturedPhoto(null)}
          onMakeMiniMe={() => setAvatarFlow("generating")}
          onUsePreloaded={handleUsePreloaded}
          onUseCreated={handleUseCreated}
          onDeleteCreated={handleDeleteCreated}
          onRenameCreated={handleRenameCreated}
          avatarLibrary={avatarLibrary}
        />
      )}
      {uiState === "start" && avatarFlow === "generating" && capturedPhoto && (
        <AvatarGeneratingScreen
          photoDataUrl={capturedPhoto}
          onCandidates={(urls, irisColor) => {
            setCandidates(urls);
            setDetectedIrisColor(irisColor);
            setAvatarFlow("selecting");
          }}
          onBack={() => {
            // Unlike AvatarSelectionScreen's TRY AGAIN (which intentionally keeps the
            // original photo so a fresh generation can be requeued without recapturing),
            // this Back is reached when the photo itself failed to produce usable
            // candidates (generation error, or no clean-eyes candidates) -- retrying the
            // exact same photo would very likely fail the same way. Clear it so
            // PhotoSelectScreen shows the full picker (camera/upload/grid) again instead
            // of looping back to a "your photo -> Make a Mini Me!" view for a photo that
            // just didn't work.
            setCapturedPhoto(null);
            setAvatarFlow("photoSelect");
          }}
        />
      )}
      {uiState === "start" && avatarFlow === "selecting" && (
        <AvatarSelectionScreen
          candidates={candidates}
          irisColor={detectedIrisColor}
          onTryAgain={handleTryAgain}
          onUse={(url) => {
            setChosenCandidateUrl(url);
            setAvatarFlow("preparing");
          }}
        />
      )}
      {/* Not gated on uiState === "start" like the screens above -- revealAvatar (fired
          right before this state) already flips uiState to "playing" via MainScene's own
          state-change event, so by the time this renders, the HUD is already showing at
          0/0 underneath it. */}
      {avatarFlow === "flourish" && <AvatarFlourish onDone={handleFlourishDone} />}
      {showTiltPermissionPrompt && <TiltPermissionPrompt onChoice={handleTiltPermissionChoice} />}
      {uiState === "gameover" && (
        <GameOverScreen
          score={score}
          candyCount={candyCount}
          bonusCount={bonusCount}
          avatarFrownSrc={currentAvatarFrownSrc}
          avatarSmileSrc={currentAvatarSmileSrc}
          avatarIrisColor={currentAvatarIrisColor}
          avatarEyeYPct={currentAvatarEyeYPct}
          onRestart={restartGame}
          onStartOver={startOver}
        />
      )}
    </div>
  );
}
