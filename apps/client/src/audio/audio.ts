import { SOUND_SLOTS, type SoundSlot } from "./slots.ts";

/** Where the listener is: the local player's position and the camera's facing. */
export interface Listener {
  x: number;
  z: number;
  /** Camera yaw: 0 looks north (-z), growing clockwise. */
  yaw: number;
}

/** Sounds this far away are silent; nearer ones fade in. Metres. */
const HEARING = 30;

/**
 * All game audio, built from noise and oscillators with the Web Audio API so the
 * game ships with sound and no files. Recorded files placed in the sound slots
 * replace the generated versions one by one.
 */
export class DesertAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private files = new Map<string, AudioBuffer[]>();
  private listener: Listener = { x: 0, z: 0, yaw: 0 };
  private nextGust = 0;
  private volume = 0.8;
  private muted = false;

  constructor() {
    try {
      this.volume = Number(localStorage.getItem("desert:volume") ?? "0.8");
      this.muted = localStorage.getItem("desert:muted") === "1";
    } catch {
      /* storage unavailable */
    }
  }

  /** Must be called from a user gesture (the Play button) so browsers allow sound. */
  async unlock(): Promise<void> {
    if (this.ctx) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.applyVolume();
    this.noise = this.makeNoise(4);
    void this.ctx.resume();
    await this.loadFiles();
    this.startWind();
  }

  get isMuted(): boolean {
    return this.muted;
  }
  get level(): number {
    return this.volume;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.save();
    this.applyVolume();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.save();
    this.applyVolume();
  }

  setListener(l: Listener): void {
    this.listener = l;
  }

  /** Call every frame: schedules wind gusts. */
  update(): void {
    const c = this.ctx;
    if (!c) return;
    if (c.currentTime >= this.nextGust) {
      this.nextGust = c.currentTime + 5 + Math.random() * 10;
      this.gust();
    }
  }

  // ---------- one-shots, placed in the world ----------

  /** A comic slap at (x, z). */
  slap(x: number, z: number): void {
    this.play("slap", x, z, (out, t, c) => {
      this.noiseBurst(out, t, 0.06, { type: "highpass", freq: 1800 }, 0.9);
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(320, t);
      o.frequency.exponentialRampToValueAtTime(90, t + 0.12);
      this.envelope(o, out, t, 0.005, 0.14, 0.7);
      // The comic "boing".
      const b = c.createOscillator();
      b.type = "sine";
      b.frequency.setValueAtTime(220, t + 0.05);
      b.frequency.exponentialRampToValueAtTime(640, t + 0.35);
      this.envelope(b, out, t + 0.05, 0.02, 0.32, 0.25);
    });
  }

  /** Skeleton bones clattering. */
  clatter(x: number, z: number): void {
    this.play("clatter", x, z, (out, t) => {
      for (let i = 0; i < 9; i++) {
        const at = t + i * 0.045 + Math.random() * 0.04;
        this.noiseBurst(out, at, 0.03, { type: "bandpass", freq: 1500 + Math.random() * 2200, q: 12 }, 1.4 - i * 0.12);
      }
    });
  }

  /** The exaggerated final death groan. */
  groan(x: number, z: number): void {
    this.play("groan", x, z, (out, t, c) => {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(190, t);
      o.frequency.exponentialRampToValueAtTime(140, t + 0.5);
      o.frequency.exponentialRampToValueAtTime(55, t + 2.2);
      const vib = c.createOscillator();
      const vibGain = c.createGain();
      vib.frequency.value = 6;
      vibGain.gain.value = 7;
      vib.connect(vibGain).connect(o.frequency);
      // A rough "aah" vowel.
      const f1 = c.createBiquadFilter();
      f1.type = "bandpass";
      f1.frequency.value = 700;
      f1.Q.value = 3;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(1800, t);
      lp.frequency.linearRampToValueAtTime(500, t + 2.2);
      o.connect(f1).connect(lp);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.8, t + 0.15);
      g.gain.setValueAtTime(0.8, t + 1.2);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
      lp.connect(g).connect(out);
      o.start(t);
      vib.start(t);
      o.stop(t + 2.5);
      vib.stop(t + 2.5);
      this.noiseBurst(out, t, 2.2, { type: "bandpass", freq: 900, q: 1 }, 0.12);
    });
  }

  /** The soul's ascending sparkle. */
  sparkle(x: number, z: number): void {
    this.play("sparkle", x, z, (out, t, c) => {
      const notes = [1046.5, 1318.5, 1568, 2093, 2637, 3136];
      notes.forEach((f, i) => {
        const o = c.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        this.envelope(o, out, t + i * 0.11, 0.01, 0.6, 0.12);
      });
    });
  }

  /** Gulping at a well. */
  drink(x: number, z: number): void {
    this.play("drink", x, z, (out, t, c) => {
      this.noiseBurst(out, t, 0.35, { type: "lowpass", freq: 1200 }, 0.3);
      for (let i = 0; i < 4; i++) {
        const at = t + 0.15 + i * 0.32;
        const o = c.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(260, at);
        o.frequency.exponentialRampToValueAtTime(110, at + 0.12);
        this.envelope(o, out, at, 0.01, 0.14, 0.6);
      }
    });
  }

  /** A scorpion sting. */
  sting(x: number, z: number): void {
    this.play("sting", x, z, (out, t, c) => {
      const o = c.createOscillator();
      o.type = "square";
      o.frequency.setValueAtTime(1400, t);
      o.frequency.exponentialRampToValueAtTime(260, t + 0.18);
      this.envelope(o, out, t, 0.003, 0.2, 0.22);
      // The yelp.
      const y = c.createOscillator();
      y.type = "sawtooth";
      y.frequency.setValueAtTime(500, t + 0.12);
      y.frequency.exponentialRampToValueAtTime(900, t + 0.22);
      y.frequency.exponentialRampToValueAtTime(400, t + 0.45);
      const f = c.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 1100;
      f.Q.value = 2;
      y.connect(f);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t + 0.12);
      g.gain.linearRampToValueAtTime(0.5, t + 0.16);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
      f.connect(g).connect(out);
      y.start(t + 0.12);
      y.stop(t + 0.5);
    });
  }

  /** One breath half: inhale or exhale. strength 0-1 (dying breaths are weak). */
  breath(x: number, z: number, inhale: boolean, strength: number, length: number): void {
    this.play(inhale ? "breath_in" : "breath_out", x, z, (out, t) => {
      this.noiseBurst(out, t, length, { type: "bandpass", freq: inhale ? 1500 : 800, q: inhale ? 1.5 : 0.9 }, 0.35 * strength, true);
    });
  }

  gasp(x: number, z: number): void {
    this.play("gasp", x, z, (out, t) => {
      this.noiseBurst(out, t, 0.25, { type: "bandpass", freq: 2000, q: 2.5 }, 0.6, true);
    });
  }

  /** A hand or knee dragging through sand. */
  sand(x: number, z: number, strength = 1): void {
    this.play("sand", x, z, (out, t) => {
      this.noiseBurst(out, t, 0.18, { type: "highpass", freq: 2500 }, 0.25 * strength, true);
    });
  }

  /** A laboured footstep. */
  footstep(x: number, z: number): void {
    this.play("footstep", x, z, (out, t, c) => {
      this.noiseBurst(out, t, 0.12, { type: "lowpass", freq: 700 }, 0.5);
      const o = c.createOscillator();
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
      this.envelope(o, out, t, 0.005, 0.1, 0.3);
    });
  }

  // ---------- plumbing ----------

  /**
   * Plays a slot at a world position: the recorded file if there is one,
   * otherwise the generated version. Quiet with distance, panned by direction.
   */
  private play(slot: SoundSlot, x: number, z: number, generate: (out: AudioNode, t: number, c: AudioContext) => void): void {
    const c = this.ctx;
    if (!c || this.muted) return;
    const dx = x - this.listener.x;
    const dz = z - this.listener.z;
    const d = Math.hypot(dx, dz);
    if (d > HEARING) return;
    const g = c.createGain();
    g.gain.value = Math.min(1, 1.6 / (1 + d * 0.25)) * (1 - d / HEARING);
    const pan = c.createStereoPanner();
    if (d > 0.5) {
      // Camera right vector for yaw y is (cos y, sin y) in (x, z).
      pan.pan.value = Math.max(-1, Math.min(1, ((dx * Math.cos(this.listener.yaw) + dz * Math.sin(this.listener.yaw)) / d) * 0.8));
    }
    g.connect(pan).connect(this.master);
    const t = c.currentTime + 0.01;
    const files = this.files.get(slot);
    if (files?.length) {
      const src = c.createBufferSource();
      src.buffer = files[Math.floor(Math.random() * files.length)]!;
      src.connect(g);
      src.start(t);
    } else {
      generate(g, t, c);
    }
    // Let the graph be collected once the sound is over.
    setTimeout(() => pan.disconnect(), 4000);
  }

  private noiseBurst(
    out: AudioNode,
    t: number,
    length: number,
    filter: { type: BiquadFilterType; freq: number; q?: number },
    level: number,
    soft = false,
  ): void {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = filter.type;
    f.frequency.value = filter.freq;
    if (filter.q) f.Q.value = filter.q;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + (soft ? length * 0.4 : 0.004));
    g.gain.exponentialRampToValueAtTime(0.001, t + length);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 3, length + 0.05);
  }

  private envelope(o: OscillatorNode, out: AudioNode, t: number, attack: number, length: number, level: number): void {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + length);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + length + 0.05);
  }

  private makeNoise(seconds: number): AudioBuffer {
    const c = this.ctx!;
    const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  private startWind(): void {
    const c = this.ctx!;
    this.windGain = c.createGain();
    this.windGain.gain.value = 0.18;
    this.windGain.connect(this.master);
    const recorded = this.files.get("wind");
    const src = c.createBufferSource();
    src.loop = true;
    if (recorded?.length) {
      src.buffer = recorded[0]!;
      src.connect(this.windGain);
    } else {
      // Brown-ish noise through a slowly wandering low-pass: a steady desert wind.
      src.buffer = this.makeBrown(8);
      this.windFilter = c.createBiquadFilter();
      this.windFilter.type = "lowpass";
      this.windFilter.frequency.value = 500;
      this.windFilter.Q.value = 0.7;
      const lfo = c.createOscillator();
      const lfoGain = c.createGain();
      lfo.frequency.value = 0.07;
      lfoGain.gain.value = 250;
      lfo.connect(lfoGain).connect(this.windFilter.frequency);
      lfo.start();
      src.connect(this.windFilter).connect(this.windGain);
    }
    src.start();
  }

  private gust(): void {
    const c = this.ctx!;
    if (this.muted) return;
    const t = c.currentTime;
    const recorded = this.files.get("gust");
    const g = c.createGain();
    g.connect(this.master);
    if (recorded?.length) {
      const src = c.createBufferSource();
      src.buffer = recorded[Math.floor(Math.random() * recorded.length)]!;
      g.gain.value = 0.5;
      src.connect(g);
      src.start(t);
      return;
    }
    const len = 2.5 + Math.random() * 3;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t);
    f.frequency.linearRampToValueAtTime(900 + Math.random() * 700, t + len * 0.45);
    f.frequency.linearRampToValueAtTime(350, t + len);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12 + Math.random() * 0.1, t + len * 0.45);
    g.gain.linearRampToValueAtTime(0, t + len);
    const pan = c.createStereoPanner();
    pan.pan.value = Math.random() * 1.4 - 0.7;
    src.connect(f).connect(pan).connect(g);
    src.start(t);
    src.stop(t + len + 0.1);
  }

  private makeBrown(seconds: number): AudioBuffer {
    const c = this.ctx!;
    const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    // Cross-fade the ends so the loop has no click.
    const fade = Math.floor(c.sampleRate * 0.5);
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      d[d.length - fade + i] = d[d.length - fade + i]! * (1 - k) + d[i]! * k;
    }
    return buf;
  }

  private applyVolume(): void {
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
  }

  private save(): void {
    try {
      localStorage.setItem("desert:volume", String(this.volume));
      localStorage.setItem("desert:muted", this.muted ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  /** Loads any recorded sounds listed in assets/sounds/index.json (see vite.config.ts). */
  private async loadFiles(): Promise<void> {
    const c = this.ctx!;
    let files: string[] = [];
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}assets/sounds/index.json`);
      if (r.ok) files = await r.json();
    } catch {
      return;
    }
    await Promise.all(
      files.map(async (file) => {
        const slot = file.replace(/\.(ogg|mp3|wav)$/i, "").replace(/_\d+$/, "");
        if (!(slot in SOUND_SLOTS)) return;
        try {
          const data = await (await fetch(`${import.meta.env.BASE_URL}assets/sounds/${file}`)).arrayBuffer();
          const buf = await c.decodeAudioData(data);
          this.files.set(slot, [...(this.files.get(slot) ?? []), buf]);
        } catch (err) {
          console.warn(`[sound] could not load ${file}, using the generated sound`, err);
        }
      }),
    );
  }
}

/**
 * Breathing and body sounds for one character, driven by what it is doing.
 * Heavy and constant while alive, faster when walking or low on health,
 * weak and slow while dying, silent when dead.
 */
export class BodySounds {
  private t = Math.random();
  private inhale = true;
  private stepT = 0;

  update(audio: DesertAudio, dt: number, x: number, z: number, phase: string, posture: string, health: number, speed: number): void {
    if (phase === "dead") return;
    const dying = phase === "terminal";
    const walking = posture === "walk";
    const moving = speed > 0.05 && !dying;
    // Seconds per breath half.
    const half = dying ? 1.5 : walking ? 0.42 : moving ? 0.55 : health < 30 ? 0.5 : 0.8;
    this.t -= dt;
    if (this.t <= 0) {
      this.t = half * (0.9 + Math.random() * 0.2);
      const strength = dying ? 0.25 + Math.max(0, health) / 40 : walking ? 1 : moving ? 0.85 : 0.6;
      audio.breath(x, z, this.inhale, strength, half * 0.85);
      if (!dying && this.inhale && health < 25 && Math.random() < 0.12) audio.gasp(x, z);
      this.inhale = !this.inhale;
    }
    if (moving) {
      this.stepT -= dt;
      if (this.stepT <= 0) {
        if (walking) {
          this.stepT = 0.75;
          audio.footstep(x, z);
        } else {
          this.stepT = 0.38;
          audio.sand(x, z);
        }
      }
    } else if (dying && Math.random() < dt * 0.15) {
      audio.sand(x, z, 0.3); // tiny movement noises
    }
  }
}
