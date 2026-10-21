/**
 * All game sounds go through here so they can be replaced by real files later (plan section 13).
 * Phase 3 has the mechanical clicks only; gunshots and the rest arrive in Phase 4.
 */
export type SoundName = 'dryFire' | 'selector' | 'magOut' | 'magIn' | 'boltClose';

const CLICKS: Record<SoundName, { freq: number; length: number; gain: number }> = {
  dryFire: { freq: 2400, length: 0.03, gain: 0.35 },
  selector: { freq: 3200, length: 0.02, gain: 0.25 },
  magOut: { freq: 900, length: 0.05, gain: 0.3 },
  magIn: { freq: 1300, length: 0.05, gain: 0.4 },
  boltClose: { freq: 700, length: 0.07, gain: 0.45 },
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  volume = 0.8;

  play(name: SoundName): void {
    const ctx = this.context();
    if (!ctx || !this.master) return;
    const c = CLICKS[name];
    // A short filtered noise burst reads as a metallic click.
    const frames = Math.ceil(ctx.sampleRate * c.length);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 3;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = c.freq;
    filter.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.value = c.gain;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
  }

  /** Created lazily: browsers only allow audio after a user gesture. */
  private context(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }
}
