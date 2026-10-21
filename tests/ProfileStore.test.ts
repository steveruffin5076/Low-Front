import { describe, expect, it } from 'vitest';
import { ProfileStore, defaultProfile, kdRatio, validateName, EMPTY_STATS } from '../src/save/ProfileStore';
import { MemoryStore } from '../src/save/Storage';

const KEY = 'test.profile';

function storeWith(raw: string | null): ProfileStore {
  const mem = new MemoryStore();
  if (raw !== null) mem.setItem(KEY, raw);
  return new ProfileStore(mem, KEY);
}

describe('validateName', () => {
  it('accepts 3 to 16 characters and trims spaces', () => {
    expect(validateName('Bob')).toEqual({ ok: true, value: 'Bob' });
    expect(validateName('  Sixteen_Chars_X  ')).toEqual({ ok: true, value: 'Sixteen_Chars_X' });
  });

  it('rejects names that are too short or too long', () => {
    expect(validateName('ab').ok).toBe(false);
    expect(validateName('   ab   ').ok).toBe(false);
    expect(validateName('a'.repeat(17)).ok).toBe(false);
  });
});

describe('kdRatio', () => {
  it('divides kills by deaths and treats 0 deaths as 1', () => {
    expect(kdRatio({ ...EMPTY_STATS, kills: 10, deaths: 4 })).toBe(2.5);
    expect(kdRatio({ ...EMPTY_STATS, kills: 7, deaths: 0 })).toBe(7);
  });
});

describe('ProfileStore', () => {
  it('returns defaults when nothing is saved', () => {
    expect(storeWith(null).load()).toEqual(defaultProfile());
  });

  it('returns defaults for corrupt JSON', () => {
    expect(storeWith('{not json').load()).toEqual(defaultProfile());
  });

  it('round-trips a saved profile', () => {
    const store = storeWith(null);
    const profile = defaultProfile();
    profile.name = 'Ghost';
    profile.loadout.primary = 'ak47';
    profile.stats.kills = 12;
    store.save(profile);
    expect(store.load()).toEqual(profile);
  });

  it('replaces invalid fields with defaults', () => {
    const raw = JSON.stringify({
      name: 'x',
      stats: { kills: -3, deaths: 2.5, wins: 4, headshots: 'many' },
      loadout: { primary: 'm1911', secondary: 'bazooka' },
    });
    const p = storeWith(raw).load();
    expect(p.name).toBe(defaultProfile().name);
    expect(p.stats).toEqual({ ...EMPTY_STATS, wins: 4 });
    expect(p.loadout).toEqual(defaultProfile().loadout);
  });
});
