import * as THREE from 'three';
import { AUDIO } from '../data/audio';
import type { WeaponId } from '../data/weapons';
import type { Surface } from '../physics/collision';

/**
 * All game sounds go through here so they can be replaced by real files later (plan section 13).
 * Sounds are procedural: filtered noise bursts and short tones. Positional sounds use a
 * PannerNode relative to the listener (the camera).
 */
export type ClickName = 'dryFire' | 'selector' | 'magOut' | 'magIn' | 'boltClose';

const CLICKS: Record<ClickName, { freq: number; length: number; gain: number }> = {
  dryFire: { freq: 2400, length: 0.03, gain: 0.35 },
  selector: { freq: 3200, length: 0.02, gain: 0.25 },
  magOut: { freq: 900, length: 0.05, gain: 0.3 },
  magIn: { freq: 1300, length: 0.05, gain: 0.4 },
  boltClose: { freq: 700, length: 0.07, gain: 0.45 },
};

const fwd = new THREE.Vector3();
const up = new THREE.Vector3();

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly listenerPos = new THREE.Vector3();
  volume: number = AUDIO.masterVolume;
  /** Sound sources playing now. */
  voices = 0;

  /** Distance from the listener (the camera) to `at`. */
  listenerDistance(at: THREE.Vector3): number {
    return this.listenerPos.distanceTo(at);
  }

  /** Call once per frame with the camera. */
  setListener(camera: THREE.Camera): void {
    this.listenerPos.setFromMatrixPosition(camera.matrixWorld);
    const ctx = this.ctx;
    if (!ctx) return;
    const l = ctx.listener;
    camera.getWorldDirection(fwd);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    if (l.positionX) {
      l.positionX.value = this.listenerPos.x;
      l.positionY.value = this.listenerPos.y;
      l.positionZ.value = this.listenerPos.z;
      l.forwardX.value = fwd.x;
      l.forwardY.value = fwd.y;
      l.forwardZ.value = fwd.z;
      l.upX.value = up.x;
      l.upY.value = up.y;
      l.upZ.value = up.z;
    }
  }

  play(name: ClickName): void {
    const c = CLICKS[name];
    this.burst({ freq: c.freq, q: 2, length: c.length, gain: c.gain, type: 'bandpass' });
  }

  /** The player's own shot (`at` omitted) or another soldier's shot at a position. */
  gunshot(id: WeaponId, at?: THREE.Vector3): void {
    const s = AUDIO.shots[id];
    const distant = at !== undefined && at.distanceTo(this.listenerPos) > AUDIO.distantShotDistance;
    const out = this.output(at);
    if (!out) return;
    const lowpass = distant ? AUDIO.distantLowpass : 12000;
    const gain = at ? s.gain * AUDIO.mix.otherShots : s.gain;
    this.burst({ freq: s.crackFreq, q: 0.7, length: s.crackLength * (distant ? 1.8 : 1), gain, type: 'bandpass', lowpass }, out);
    this.tone({ freq: s.bodyFreq, endFreq: s.bodyFreq * 0.45, length: s.bodyLength, gain: gain * 0.9 }, out);
  }

  impact(surface: Surface | 'flesh', at: THREE.Vector3): void {
    const s = AUDIO.impacts[surface];
    const out = this.output(at);
    if (!out) return;
    this.burst({ freq: s.freq, q: 1.5, length: s.length, gain: s.gain, type: 'bandpass' }, out);
    if (s.ping) this.tone({ freq: s.ping, endFreq: s.ping * 0.9, length: s.length * 1.5, gain: s.gain * 0.4 }, out);
  }

  /** A footstep; `at` makes it positional (other soldiers). */
  footstep(surface: Surface, scale = 1, at?: THREE.Vector3): void {
    const f = AUDIO.footsteps[surface];
    const out = this.output(at);
    if (!out) return;
    const gain = f.gain * scale * (at ? AUDIO.mix.otherSteps : 1);
    this.burst({ freq: f.freq, q: 1, length: AUDIO.footstepLength, gain, type: 'lowpass' }, out);
  }

  land(): void {
    const l = AUDIO.land;
    this.tone({ freq: l.freq, endFreq: l.freq * 0.6, length: l.length, gain: l.gain });
    this.burst({ freq: 500, q: 1, length: l.length * 0.6, gain: l.gain * 0.6, type: 'lowpass' });
  }

  hitMarker(kill: boolean): void {
    const t = kill ? AUDIO.killTick : AUDIO.hitTick;
    this.tone({ freq: t.freq, endFreq: t.freq, length: t.length, gain: t.gain });
  }

  /** Flag captured by our team, lost by our team, or neutralized. */
  flagCue(kind: 'captured' | 'lost' | 'neutralized'): void {
    const c = AUDIO.flagCues;
    c[kind].forEach((freq, i) => this.tone({ freq, endFreq: freq, length: c.noteLength, gain: c.gain, delay: i * c.noteGap }));
  }

  /** Master volume, 0–1 (the player's setting). */
  setVolume(volume: number): void {
    this.volume = volume;
    if (this.master) this.master.gain.value = volume;
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
  }

  /**
   * Positional output (panner) when `at` is given, otherwise the master bus. Other soldiers'
   * sounds out of hearing range, or over the voice limit, are dropped (null): a 31-bot
   * firefight would otherwise build hundreds of audio nodes a second.
   */
  private output(at?: THREE.Vector3): AudioNode | null {
    const ctx = this.context();
    if (!ctx || !this.master) return null;
    if (!at) return this.master;
    if (this.voices >= AUDIO.maxVoices || at.distanceToSquared(this.listenerPos) > AUDIO.maxDistance * AUDIO.maxDistance) return null;
    const p = ctx.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = AUDIO.refDistance;
    p.maxDistance = AUDIO.maxDistance;
    p.rolloffFactor = AUDIO.rolloff;
    p.positionX.value = at.x;
    p.positionY.value = at.y;
    p.positionZ.value = at.z;
    p.connect(this.master);
    return p;
  }

  private burst(
    o: { freq: number; q: number; length: number; gain: number; type: BiquadFilterType; lowpass?: number },
    out: AudioNode | null = this.output(),
  ): void {
    const ctx = this.ctx;
    if (!ctx || !out || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = o.type;
    filter.frequency.value = o.freq;
    filter.Q.value = o.q;
    let node: AudioNode = src.connect(filter);
    if (o.lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = o.lowpass;
      node = node.connect(lp);
    }
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(o.gain, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + o.length);
    node.connect(gain).connect(out);
    this.track(src);
    src.start(t, Math.random() * 0.5, o.length);
  }

  private tone(o: { freq: number; endFreq: number; length: number; gain: number; delay?: number }, out: AudioNode | null = this.output()): void {
    const ctx = this.ctx;
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    const t = ctx.currentTime + (o.delay ?? 0);
    osc.frequency.setValueAtTime(o.freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.endFreq), t + o.length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(o.gain, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + o.length);
    osc.connect(gain).connect(out);
    this.track(osc);
    osc.start(t);
    osc.stop(t + o.length);
  }

  private track(src: AudioScheduledSourceNode): void {
    this.voices++;
    src.onended = () => this.voices--;
  }

  /** Created lazily: browsers only allow audio after a user gesture. */
  private context(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        const l = AUDIO.limiter;
        const limiter = this.ctx.createDynamicsCompressor();
        limiter.threshold.value = l.threshold;
        limiter.knee.value = l.knee;
        limiter.ratio.value = l.ratio;
        limiter.attack.value = l.attack;
        limiter.release.value = l.release;
        this.master.connect(limiter).connect(this.ctx.destination);
        // One second of white noise, reused by every burst.
        this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }
}
