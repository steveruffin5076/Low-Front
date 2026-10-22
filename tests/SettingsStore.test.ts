import { describe, expect, it } from 'vitest';
import { SETTINGS } from '../src/data/settings';
import { SettingsStore, defaultSettings } from '../src/save/SettingsStore';
import { MemoryStore } from '../src/save/Storage';

describe('settings store', () => {
  it('starts with defaults and saves changes', () => {
    const mem = new MemoryStore();
    const store = new SettingsStore(mem);
    expect(store.load()).toEqual(defaultSettings());
    store.save({ sensitivity: 1.5, fov: 90, volume: 0.3 });
    expect(new SettingsStore(mem).load()).toEqual({ sensitivity: 1.5, fov: 90, volume: 0.3 });
  });

  it('clamps out-of-range values and ignores broken data', () => {
    const mem = new MemoryStore();
    mem.setItem(SETTINGS.storageKey, JSON.stringify({ sensitivity: 99, fov: 20, volume: 'loud' }));
    expect(new SettingsStore(mem).load()).toEqual({ sensitivity: SETTINGS.sensitivity.max, fov: SETTINGS.fov.min, volume: SETTINGS.volume.default });
    mem.setItem(SETTINGS.storageKey, '{not json');
    expect(new SettingsStore(mem).load()).toEqual(defaultSettings());
  });
});
