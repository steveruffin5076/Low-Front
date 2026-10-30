import { describe, expect, it } from 'vitest';
import { DEFAULT_GRAPHICS } from '../src/data/graphics';
import { SETTINGS } from '../src/data/settings';
import { SettingsStore, defaultSettings } from '../src/save/SettingsStore';
import { MemoryStore } from '../src/save/Storage';

describe('settings store', () => {
  it('starts with defaults and saves changes', () => {
    const mem = new MemoryStore();
    const store = new SettingsStore(mem);
    expect(store.load()).toEqual(defaultSettings());
    store.save({ sensitivity: 1.5, fov: 90, volume: 0.3, graphics: 'low' });
    expect(new SettingsStore(mem).load()).toEqual({ sensitivity: 1.5, fov: 90, volume: 0.3, graphics: 'low' });
  });

  it('clamps out-of-range values and ignores broken data', () => {
    const mem = new MemoryStore();
    mem.setItem(SETTINGS.storageKey, JSON.stringify({ sensitivity: 99, fov: 20, volume: 'loud' }));
    expect(new SettingsStore(mem).load()).toEqual({ sensitivity: SETTINGS.sensitivity.max, fov: SETTINGS.fov.min, volume: SETTINGS.volume.default, graphics: DEFAULT_GRAPHICS });
    mem.setItem(SETTINGS.storageKey, '{not json');
    expect(new SettingsStore(mem).load()).toEqual(defaultSettings());
  });

  it('keeps a pre-Phase-10 save and gives it the default graphics preset; rejects unknown presets', () => {
    const mem = new MemoryStore();
    mem.setItem(SETTINGS.storageKey, JSON.stringify({ sensitivity: 1.2, fov: 85, volume: 0.5 }));
    expect(new SettingsStore(mem).load()).toEqual({ sensitivity: 1.2, fov: 85, volume: 0.5, graphics: DEFAULT_GRAPHICS });
    mem.setItem(SETTINGS.storageKey, JSON.stringify({ graphics: 'ultra' }));
    expect(new SettingsStore(mem).load().graphics).toBe(DEFAULT_GRAPHICS);
  });
});
