/**
 * All game audio is synthesised with the Web Audio API — no audio files.
 *
 * Browsers block audio until a user gesture, so the AudioContext is created
 * lazily and resumed on the first pointer/key event (see `installUnlock`).
 */
const PREFS_KEY = 'othello.sound';

class SoundManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    const prefs = this.#loadPrefs();
    this.volume = prefs.volume;
    this.muted = prefs.muted;
    this.listeners = new Set();
  }

  /* ----------------------------- prefs ------------------------------ */

  #loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY));
      return {
        volume: typeof p?.volume === 'number' ? Math.min(1, Math.max(0, p.volume)) : 0.6,
        muted: Boolean(p?.muted),
      };
    } catch {
      return { volume: 0.6, muted: false };
    }
  }

  #savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ volume: this.volume, muted: this.muted }));
    } catch {
      /* ignore */
    }
    this.listeners.forEach((fn) => fn(this.getPrefs()));
  }

  getPrefs() {
    return { volume: this.volume, muted: this.muted };
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.volume > 0 && this.muted) this.muted = false;
    this.#applyGain();
    this.#savePrefs();
  }

  setMuted(m) {
    this.muted = m;
    this.#applyGain();
    this.#savePrefs();
  }

  #applyGain() {
    if (!this.master) return;
    const target = this.muted ? 0 : this.volume;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
  }

  /* ---------------------------- context ----------------------------- */

  #ensureContext() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    this.ctx = new Ctx();
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.ratio.value = 6;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(compressor).connect(this.ctx.destination);

    const len = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return this.ctx;
  }

  unlock() {
    const ctx = this.#ensureContext();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  installUnlock() {
    const handler = () => {
      this.unlock();
      if (this.ctx?.state === 'running') {
        window.removeEventListener('pointerdown', handler, true);
        window.removeEventListener('keydown', handler, true);
        window.removeEventListener('touchstart', handler, true);
      }
    };
    window.addEventListener('pointerdown', handler, true);
    window.addEventListener('keydown', handler, true);
    window.addEventListener('touchstart', handler, true);
  }

  /** Returns the audio context only if it can actually make sound right now. */
  #live() {
    if (this.muted || this.volume === 0) return null;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return null;
    return ctx;
  }

  /* --------------------------- primitives --------------------------- */

  #tone({ freq, freqEnd, type = 'sine', at = 0, duration = 0.2, gain = 0.3, attack = 0.005 }) {
    const ctx = this.#live();
    if (!ctx) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  #noise({ at = 0, duration = 0.08, gain = 0.2, filter = 'bandpass', freq = 1800, q = 1, freqEnd }) {
    const ctx = this.#live();
    if (!ctx) return;
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t0);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + duration + 0.05);
  }

  /* ----------------------------- sounds ----------------------------- */

  /** Short wooden thud: pitched-down sine body plus a filtered click. */
  place(at = 0) {
    this.#tone({ freq: 210, freqEnd: 70, type: 'sine', at, duration: 0.16, gain: 0.55 });
    this.#tone({ freq: 420, freqEnd: 180, type: 'triangle', at, duration: 0.06, gain: 0.15 });
    this.#noise({ at, duration: 0.035, gain: 0.25, filter: 'bandpass', freq: 2400, q: 0.8 });
  }

  /** Soft whoosh + tick for a single flip; `i` nudges the pitch up along a ripple. */
  flip(i = 0, at = 0) {
    this.#noise({ at, duration: 0.09, gain: 0.08, filter: 'bandpass', freq: 900, freqEnd: 3200, q: 0.7 });
    this.#tone({ freq: 760 + i * 45, type: 'triangle', at: at + 0.07, duration: 0.05, gain: 0.12 });
  }

  flipSequence(count, startDelay = 0.12, stagger = 0.07) {
    for (let i = 0; i < count; i++) this.flip(i, startDelay + i * stagger);
  }

  yourTurn(at = 0) {
    this.#tone({ freq: 880, type: 'sine', at, duration: 0.18, gain: 0.18 });
    this.#tone({ freq: 1320, type: 'sine', at: at + 0.09, duration: 0.26, gain: 0.14 });
  }

  invalid() {
    this.#tone({ freq: 150, type: 'square', duration: 0.09, gain: 0.08 });
    this.#tone({ freq: 120, type: 'square', at: 0.11, duration: 0.12, gain: 0.08 });
  }

  joined() {
    [523.25, 659.25, 783.99].forEach((f, i) =>
      this.#tone({ freq: f, type: 'triangle', at: i * 0.09, duration: 0.45, gain: 0.16 }),
    );
  }

  win(at = 0) {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) =>
      this.#tone({ freq: f, type: 'triangle', at: at + i * 0.12, duration: i === 3 ? 0.9 : 0.22, gain: 0.2 }),
    );
    this.#tone({ freq: 1318.5, type: 'sine', at: at + 0.36, duration: 0.8, gain: 0.08 });
  }

  lose(at = 0) {
    [392, 329.63, 261.63].forEach((f, i) =>
      this.#tone({ freq: f, type: 'sine', at: at + i * 0.2, duration: 0.45, gain: 0.18 }),
    );
  }

  draw(at = 0) {
    this.#tone({ freq: 440, type: 'sine', at, duration: 0.35, gain: 0.16 });
    this.#tone({ freq: 440, type: 'sine', at: at + 0.3, duration: 0.5, gain: 0.14 });
  }

  disconnect() {
    this.#tone({ freq: 620, freqEnd: 280, type: 'sine', duration: 0.35, gain: 0.16 });
  }

  reconnect() {
    this.#tone({ freq: 300, freqEnd: 640, type: 'sine', duration: 0.3, gain: 0.16 });
  }

  notify() {
    this.#tone({ freq: 988, type: 'sine', duration: 0.16, gain: 0.12 });
  }
}

export const soundManager = new SoundManager();
