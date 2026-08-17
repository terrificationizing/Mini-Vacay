/** One-shot sound effects, synthesized live via the Web Audio API (no asset files). */

type AudioContextCtor = typeof AudioContext;

class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;

  private ensureContext() {
    if (this.ctx) return;
    const Ctor: AudioContextCtor | undefined =
      window.AudioContext || (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
    this.noiseBuffer = this.buildNoiseBuffer(this.ctx);
  }

  private buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const duration = 0.15;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.8, this.ctx.currentTime + 0.05);
    }
  }

  /** Cartoon "punch" — a fast pitch-dropping thump plus a short noise smack. */
  playPunch() {
    this.ensureContext();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.noiseBuffer) return;
    if (ctx.state === "suspended") ctx.resume();

    const t = ctx.currentTime;

    const thump = ctx.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(190, t);
    thump.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.9, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    thump.connect(thumpGain).connect(master);
    thump.start(t);
    thump.stop(t + 0.2);

    const smack = ctx.createBufferSource();
    smack.buffer = this.noiseBuffer;
    const smackFilter = ctx.createBiquadFilter();
    smackFilter.type = "bandpass";
    smackFilter.frequency.value = 1400;
    smackFilter.Q.value = 0.7;
    const smackGain = ctx.createGain();
    smackGain.gain.setValueAtTime(0.7, t);
    smackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    smack.connect(smackFilter).connect(smackGain).connect(master);
    smack.start(t);
    smack.stop(t + 0.07);
  }

  /** Short ascending harp-like glissando for a good catch. */
  playHarpFlourish() {
    this.ensureContext();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    if (ctx.state === "suspended") ctx.resume();

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5 E5 G5 C6 E6
    const start = ctx.currentTime + 0.005;

    notes.forEach((freq, i) => {
      const t = start + i * 0.045;
      const dur = 0.5;

      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;

      const shimmer = ctx.createOscillator();
      shimmer.type = "sine";
      shimmer.frequency.value = freq * 2.005;
      const shimmerGain = ctx.createGain();
      shimmerGain.gain.value = 0.25;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = freq * 1.4;
      filter.Q.value = 1.4;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.32, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      osc.connect(filter);
      shimmer.connect(shimmerGain).connect(filter);
      filter.connect(gain).connect(master);

      osc.start(t);
      shimmer.start(t);
      osc.stop(t + dur + 0.05);
      shimmer.stop(t + dur + 0.05);
    });
  }

  /** Bigger celebratory flourish for the Mini Bonus milestone — a wider ascending
   * arpeggio than the regular catch harp, plus a landing chord, so it reads as a
   * distinct event rather than an extra-loud regular catch. */
  playBonusFanfare() {
    this.ensureContext();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    if (ctx.state === "suspended") ctx.resume();

    // C5 E5 G5 C6 E6 G6 C7 E7 G7, then back down to C7 -- a full rising run with a
    // little cascading tumble at the top, so it reads as "grand" rather than a quick blip.
    const notes = [
      523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0, 2637.02, 3135.96, 2093.0,
    ];
    const start = ctx.currentTime + 0.005;

    notes.forEach((freq, i) => {
      const t = start + i * 0.075;
      const dur = 0.85;

      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;

      const shimmer = ctx.createOscillator();
      shimmer.type = "sine";
      shimmer.frequency.value = freq * 2.005;
      const shimmerGain = ctx.createGain();
      shimmerGain.gain.value = 0.28;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = freq * 1.4;
      filter.Q.value = 1.4;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      osc.connect(filter);
      shimmer.connect(shimmerGain).connect(filter);
      filter.connect(gain).connect(master);

      osc.start(t);
      shimmer.start(t);
      osc.stop(t + dur + 0.05);
      shimmer.stop(t + dur + 0.05);
    });

    // Landing chord under the top note, so the run resolves instead of just stopping.
    const chordAt = start + notes.length * 0.075 + 0.08;
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, chordAt);
      gain.gain.linearRampToValueAtTime(0.2, chordAt + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, chordAt + 1.3);
      osc.connect(gain).connect(master);
      osc.start(chordAt);
      osc.stop(chordAt + 1.35);
    });
  }

  /** Grand flourish for the avatar reveal moment ("It's about time for some YOU time.") --
   * a warm rising triad run followed by a full landing chord, distinct from the bonus
   * fanfare's brighter/faster run so this reads as a one-time "ta-da" rather than an
   * in-game scoring event. */
  playFlourishFanfare() {
    this.ensureContext();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    if (ctx.state === "suspended") ctx.resume();

    // F5 A5 C6 F6 A6 C7 F7 -- a warmer major triad run (vs. the bonus fanfare's brighter
    // straight scale), landing on the octave instead of tumbling back down.
    const notes = [698.46, 880.0, 1046.5, 1396.91, 1760.0, 2093.0, 2793.83];
    const start = ctx.currentTime + 0.005;

    notes.forEach((freq, i) => {
      const t = start + i * 0.09;
      const dur = 0.9;

      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;

      const shimmer = ctx.createOscillator();
      shimmer.type = "sine";
      shimmer.frequency.value = freq * 2.005;
      const shimmerGain = ctx.createGain();
      shimmerGain.gain.value = 0.3;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = freq * 1.3;
      filter.Q.value = 1.2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.42, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      osc.connect(filter);
      shimmer.connect(shimmerGain).connect(filter);
      filter.connect(gain).connect(master);

      osc.start(t);
      shimmer.start(t);
      osc.stop(t + dur + 0.05);
      shimmer.stop(t + dur + 0.05);
    });

    // Full landing chord (root, third, fifth, octave) under the top note.
    const chordAt = start + notes.length * 0.09 + 0.1;
    [698.46, 880.0, 1046.5, 1396.91, 1760.0].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, chordAt);
      gain.gain.linearRampToValueAtTime(0.24, chordAt + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, chordAt + 1.6);
      osc.connect(gain).connect(master);
      osc.start(chordAt);
      osc.stop(chordAt + 1.65);
    });
  }

  destroy() {
    this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
  }
}

export const sfxEngine = new SfxEngine();
