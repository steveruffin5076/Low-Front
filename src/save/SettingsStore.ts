import { DEFAULT_GRAPHICS, GRAPHICS_PRESETS, type GraphicsPreset } from '../data/graphics';
import { SETTINGS } from '../data/settings';
import type { KeyValueStore } from './Storage';

export interface Settings {
  sensitivity: number;
  fov: number;
  volume: number;
  /** Graphics quality preset. Saves from before Phase 10 have none and get the default. */
  graphics: GraphicsPreset;
}

export function defaultSettings(): Settings {
  return { sensitivity: SETTINGS.sensitivity.default, fov: SETTINGS.fov.default, volume: SETTINGS.volume.default, graphics: DEFAULT_GRAPHICS };
}

/** Clamps every value into its allowed range; missing or broken values fall back to defaults. */
export function sanitizeSettings(raw: unknown): Settings {
  const out = defaultSettings();
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;
  for (const key of ['sensitivity', 'fov', 'volume'] as const) {
    const v = r[key];
    const range = SETTINGS[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = Math.min(range.max, Math.max(range.min, v));
  }
  if (GRAPHICS_PRESETS.includes(r.graphics as GraphicsPreset)) out.graphics = r.graphics as GraphicsPreset;
  return out;
}

/** Loads and saves the settings as JSON. */
export class SettingsStore {
  constructor(
    private readonly store: KeyValueStore,
    private readonly key: string = SETTINGS.storageKey,
  ) {}

  load(): Settings {
    try {
      return sanitizeSettings(JSON.parse(this.store.getItem(this.key) ?? 'null'));
    } catch {
      return defaultSettings();
    }
  }

  save(s: Settings): void {
    this.store.setItem(this.key, JSON.stringify(sanitizeSettings(s)));
  }
}
