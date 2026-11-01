import { describe, expect, it } from 'vitest';
import { VERDAN } from '../src/data/map';
import { DEFAULT_SETUP, matchRules, validSetup } from '../src/data/matchSetup';
import { ConquestMatch } from '../src/game/ConquestMatch';
import { defaultProfile, ProfileStore } from '../src/save/ProfileStore';
import { MemoryStore } from '../src/save/Storage';

describe('match setup', () => {
  it('turns a setup into tickets and a time limit', () => {
    expect(matchRules({ ...DEFAULT_SETUP, teamSize: 4, timeLimit: 10 })).toEqual({ tickets: 150, timeLimit: 600 });
    expect(matchRules(DEFAULT_SETUP)).toEqual({ tickets: 400, timeLimit: 1500 });
  });

  it('keeps known choices and falls back to defaults for the rest', () => {
    expect(validSetup({ map: 'verdan', difficulty: 'hard', teamSize: 8, timeLimit: 15 })).toEqual({ map: 'verdan', difficulty: 'hard', teamSize: 8, timeLimit: 15 });
    expect(validSetup({ map: 'moon', difficulty: 'insane', teamSize: 64, timeLimit: 3 })).toEqual(DEFAULT_SETUP);
    expect(validSetup(undefined)).toEqual(DEFAULT_SETUP);
  });

  it('a match uses the chosen tickets and ends at the chosen time', () => {
    const m = new ConquestMatch(VERDAN, [], matchRules({ ...DEFAULT_SETUP, teamSize: 8, timeLimit: 10 }));
    expect(m.tickets.count).toEqual({ blue: 250, red: 250 });
    expect(m.timeLeft).toBe(600);
    for (let t = 0; t < 601 && !m.result; t += 1) m.update(1);
    expect(m.result?.reason).toBe('time');
  });

  it('is saved in the profile', () => {
    const store = new ProfileStore(new MemoryStore());
    const p = defaultProfile();
    p.setup = { map: 'verdan', difficulty: 'easy', teamSize: 4, timeLimit: 15 };
    store.save(p);
    expect(store.load().setup).toEqual(p.setup);
  });
});
