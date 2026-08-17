type Listener<T> = (payload: T) => void;

class EventBus<Events extends Record<string, unknown>> {
  private listeners: { [K in keyof Events]?: Set<Listener<Events[K]>> } = {};

  on<K extends keyof Events>(event: K, fn: Listener<Events[K]>) {
    (this.listeners[event] ??= new Set()).add(fn);
    return () => this.off(event, fn);
  }

  off<K extends keyof Events>(event: K, fn: Listener<Events[K]>) {
    this.listeners[event]?.delete(fn);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]) {
    this.listeners[event]?.forEach((fn) => fn(payload));
  }
}

export type GameEvents = {
  "state-change": { state: "start" | "playing" | "gameover" };
  "score-change": { score: number };
  "lives-change": { lives: number };
  "candy-change": { count: number };
  "speed-stage": { stage: number };
  "catch-good": { x: number; y: number; points: number; label: string };
  "catch-bad": { x: number; y: number; points: number; label: string };
  "mini-bonus": { count: number };
  /** The avatar sprite's current on-screen rect, as percentages of the viewport --
   * recomputed whenever its anchors update (avatar swap, resize). Lets DOM overlays (the
   * Preparing screen's shimmer placeholder) line up with exactly where the real avatar
   * will appear, instead of an approximated fixed position. */
  "avatar-rect": { xPct: number; yPct: number; widthPct: number; heightPct: number };
  /** Fires once a "setAvatar" command has actually finished applying -- for a generated
   * avatar this means its textures (loaded async via addBase64) are in and
   * applyAvatarProfile has run, not just that the command was emitted. "setAvatar" ->
   * "revealAvatar" being emitted back-to-back only guarantees ORDER, not that the first
   * has finished by the time the second runs (a real gap for the async generated path,
   * a non-issue for the synchronous preloaded path) -- callers that need the avatar to
   * actually be showing before revealing the character should await this instead of
   * assuming emission order alone is enough. */
  "avatar-ready": undefined;
};

export const gameEvents = new EventBus<GameEvents>();

export type ControlMode = "drag" | "tilt";

export type AvatarSource =
  | { kind: "preloaded"; id: string }
  | {
      kind: "generated";
      id: string;
      geometry: import("../data/avatarGeometry").AvatarGeometry;
      smileDataUrl: string;
      frownDataUrl: string;
    };

export type GameCommands = {
  restart: { controlMode: ControlMode };
  tilt: { gamma: number };
  resetToStart: undefined;
  /** Loads the given avatar's geometry/textures into the scene -- must be emitted before
   * "revealAvatar"/"restart" if a specific (non-default) avatar should be used for that
   * game. */
  setAvatar: AvatarSource;
  /** Shows the character + suitcase, flips HUD chrome on, and applies the given control
   * mode -- but does NOT start item spawning. Used for every fresh game start; React
   * follows up with beginSpawning either immediately or after the one-time tilt tip is
   * dismissed. "restart" (after a game over) calls prepareCharacter+beginSpawning together
   * instead, since the tip only ever applies to a session's first play. */
  revealAvatar: { controlMode: ControlMode };
  /** Starts item spawning on an already-revealed character. */
  beginSpawning: undefined;
};

export const gameCommands = new EventBus<GameCommands>();
