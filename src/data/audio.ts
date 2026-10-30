import type { WeaponId } from './weapons';
import type { Surface } from '../physics/collision';

/** Procedural placeholder sounds (plan section 13). Frequencies in Hz, times in s, gains 0–1. */
export interface ShotSound {
  /** Bright noise crack. */
  crackFreq: number;
  crackLength: number;
  /** Low sine thump that drops in pitch. */
  bodyFreq: number;
  bodyLength: number;
  gain: number;
}

export const AUDIO = {
  /** Flag cues: notes (Hz) played one after another. */
  flagCues: {
    captured: [523, 659, 784],
    lost: [659, 523, 392],
    neutralized: [587, 440],
    noteLength: 0.14,
    noteGap: 0.11,
    gain: 0.26,
  },
  /** Resupply pickup: two quick rising notes. */
  resupplyCue: { notes: [660, 990], noteLength: 0.09, noteGap: 0.07, gain: 0.22 },
  masterVolume: 0.8,
  /**
   * Mix (plan section 13): other soldiers' shots and steps sit under your own, so your gun
   * stays the loudest sound and nearby enemies are still easy to place.
   */
  mix: { otherShots: 0.7, otherSteps: 0.85 },
  /** Master limiter: keeps a 31-bot firefight from clipping. Threshold and knee in dB, times in s. */
  limiter: { threshold: -12, knee: 8, ratio: 8, attack: 0.003, release: 0.2 },
  /** Positional sounds: full volume within `refDistance`, then fades. */
  refDistance: 3,
  maxDistance: 120,
  /** Other soldiers' sounds are dropped while this many sound sources play (a gunshot uses 2). */
  maxVoices: 48,
  rolloff: 1.2,
  /** Shots farther than this use the filtered distant version. */
  distantShotDistance: 40,
  distantLowpass: 900,
  shots: {
    m4a1: { crackFreq: 2600, crackLength: 0.16, bodyFreq: 150, bodyLength: 0.2, gain: 0.85 },
    ak47: { crackFreq: 1800, crackLength: 0.2, bodyFreq: 105, bodyLength: 0.28, gain: 1.0 },
    sr9: { crackFreq: 2200, crackLength: 0.11, bodyFreq: 170, bodyLength: 0.14, gain: 0.7 },
    br12: { crackFreq: 1100, crackLength: 0.26, bodyFreq: 70, bodyLength: 0.34, gain: 1.0 },
    m1911: { crackFreq: 1400, crackLength: 0.14, bodyFreq: 90, bodyLength: 0.2, gain: 0.85 },
  } as Record<WeaponId, ShotSound>,
  impacts: {
    metal: { freq: 3800, length: 0.12, gain: 0.35, ping: 2200 },
    concrete: { freq: 1800, length: 0.07, gain: 0.35, ping: 0 },
    dirt: { freq: 600, length: 0.09, gain: 0.35, ping: 0 },
    wood: { freq: 1100, length: 0.08, gain: 0.4, ping: 0 },
    flesh: { freq: 380, length: 0.08, gain: 0.5, ping: 0 },
  } as Record<Surface | 'flesh', { freq: number; length: number; gain: number; ping: number }>,
  footsteps: {
    concrete: { freq: 900, gain: 0.22 },
    dirt: { freq: 420, gain: 0.25 },
    metal: { freq: 1500, gain: 0.22 },
    wood: { freq: 700, gain: 0.24 },
  } as Record<Surface, { freq: number; gain: number }>,
  footstepLength: 0.07,
  /** Footstep volume while crouched / sprinting. */
  crouchStepScale: 0.4,
  sprintStepScale: 1.3,
  land: { freq: 70, length: 0.16, gain: 0.5 },
  hitTick: { freq: 1900, length: 0.04, gain: 0.3 },
  killTick: { freq: 1250, length: 0.09, gain: 0.35 },
} as const;
