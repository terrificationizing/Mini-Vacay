/** Looping background track. Starting playback requires a user gesture (browser autoplay policy) — call start() from a click handler. */

const MAIN_TRACK_SRC = "/audio/golden-hour-drums.mp3";
const ENDCARD_TRACK_SRC = "/audio/endcard.mp3";
const VOLUME = 0.55;

class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private currentSrc: string | null = null;
  private muted = false;
  private playbackRate = 1;

  private play(src: string) {
    if (this.audio && this.currentSrc === src) {
      this.audio.play().catch(() => {});
      return;
    }
    this.audio?.pause();
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = VOLUME;
    audio.muted = this.muted;
    audio.playbackRate = this.playbackRate;
    audio.play().catch(() => {});
    this.audio = audio;
    this.currentSrc = src;
  }

  /** Main gameplay/title track. */
  start() {
    this.play(MAIN_TRACK_SRC);
  }

  /** Swaps to the end-card track -- used for every screen after the play screen ends. */
  startEndcard() {
    this.play(ENDCARD_TRACK_SRC);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.audio) this.audio.muted = muted;
  }

  isMuted() {
    return this.muted;
  }

  /** Speeds the track up (or back down) without pitch-shifting it (browsers preserve pitch by default). */
  setPlaybackRate(rate: number) {
    this.playbackRate = rate;
    if (this.audio) this.audio.playbackRate = rate;
  }

  destroy() {
    this.audio?.pause();
    this.audio = null;
  }
}

export const musicEngine = new MusicPlayer();
