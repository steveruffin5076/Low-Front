import { EASE, type EaseName } from './Easing';

/**
 * Small keyframe system. A clip has tracks of number arrays (a channel such as "weapon.pos")
 * and named events (such as "magSeated"). Easing on a key shapes the curve that arrives at it.
 */
export interface Key {
  t: number;
  v: readonly number[];
  ease?: EaseName;
}

export interface Track {
  channel: string;
  keys: readonly Key[];
}

export interface ClipEvent {
  t: number;
  name: string;
}

export interface Clip {
  name: string;
  duration: number;
  tracks: readonly Track[];
  events: readonly ClipEvent[];
}

/** Value of a track at time `t`. Before the first key it holds the first value, after the last the last value. */
export function sampleTrack(track: Track, t: number, out: number[] = []): number[] {
  const keys = track.keys;
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (t <= first.t) return copyInto(out, first.v);
  if (t >= last.t) return copyInto(out, last.v);
  let i = 1;
  while (keys[i].t < t) i++;
  const a = keys[i - 1];
  const b = keys[i];
  const span = b.t - a.t;
  const k = EASE[b.ease ?? 'inOut'](span > 0 ? (t - a.t) / span : 1);
  out.length = a.v.length;
  for (let j = 0; j < a.v.length; j++) out[j] = a.v[j] + (b.v[j] - a.v[j]) * k;
  return out;
}

function copyInto(out: number[], v: readonly number[]): number[] {
  out.length = v.length;
  for (let j = 0; j < v.length; j++) out[j] = v[j];
  return out;
}

/** Plays one clip: advances time, reports events crossed, samples all channels. */
export class ClipPlayer {
  time = 0;
  /** 0–1 weight; the animator uses it to blend a clip in and out. */
  weight = 1;

  constructor(
    readonly clip: Clip,
    /** Speeds the clip up or down so it matches a duration set by game logic. */
    readonly speed = 1,
  ) {}

  get done(): boolean {
    return this.time >= this.clip.duration;
  }

  /** Advances time and calls `onEvent` for every event in (previous, new] time. */
  update(dt: number, onEvent?: (name: string) => void): void {
    const before = this.time;
    this.time = Math.min(this.clip.duration, this.time + dt * this.speed);
    if (!onEvent) return;
    for (const e of this.clip.events) if (e.t > before && e.t <= this.time) onEvent(e.name);
  }

  /** Writes every channel's value into `out`. */
  sample(out: Map<string, number[]>): void {
    for (const track of this.clip.tracks) out.set(track.channel, sampleTrack(track, this.time, out.get(track.channel) ?? []));
  }
}

/** Builder for readable clip definitions. */
export class ClipBuilder {
  private tracks = new Map<string, Key[]>();
  private events: ClipEvent[] = [];

  constructor(
    private readonly name: string,
    private readonly duration: number,
  ) {}

  key(channel: string, t: number, v: readonly number[], ease?: EaseName): this {
    let keys = this.tracks.get(channel);
    if (!keys) {
      keys = [];
      this.tracks.set(channel, keys);
    }
    keys.push({ t, v, ease });
    return this;
  }

  event(t: number, name: string): this {
    this.events.push({ t, name });
    return this;
  }

  build(): Clip {
    const tracks: Track[] = [];
    for (const [channel, keys] of this.tracks) tracks.push({ channel, keys: [...keys].sort((a, b) => a.t - b.t) });
    return { name: this.name, duration: this.duration, tracks, events: [...this.events].sort((a, b) => a.t - b.t) };
  }
}
