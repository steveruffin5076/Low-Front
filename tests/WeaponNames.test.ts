import { describe, expect, it } from 'vitest';
import { WEAPONS, WEAPON_IDS } from '../src/data/weapons';

/** Real firearm designations that must never be shown to the player. */
const REAL = /\b(M4A1|M4|M16|AK-?47|AKM|AKS|M1911|1911|MP5|M870|870|M24|M249|Mk ?14|G17|Glock|Remington|Colt|Kalashnikov)\b/i;

describe('weapon names', () => {
  it('uses fictional names only, each one unique', () => {
    const names = WEAPON_IDS.map((id) => WEAPONS[id].name);
    for (const n of names) expect(n, n).not.toMatch(REAL);
    expect(new Set(names).size).toBe(names.length);
  });
});
