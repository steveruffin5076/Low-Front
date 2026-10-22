import { ClipBuilder, type Clip } from './Timeline';

/**
 * Third-person reload, normalized to 1 s (played at 1 / reload time). Channels:
 * `toMag` moves the left hand from the support grip to the magazine, `toPouch` from there to a
 * vest pouch. Events: `magOut` (the magazine leaves with the hand), `magIn` (the new one is seated).
 */
export const SOLDIER_RELOAD: Clip = new ClipBuilder('soldierReload', 1)
  .key('toMag', 0, [0])
  .key('toMag', 0.15, [1], 'out')
  .key('toMag', 0.85, [1])
  .key('toMag', 0.98, [0], 'inOut')
  .key('toPouch', 0, [0])
  .key('toPouch', 0.2, [0])
  .key('toPouch', 0.42, [1], 'inOut')
  .key('toPouch', 0.55, [1])
  .key('toPouch', 0.75, [0], 'inOut')
  .event(0.17, 'magOut')
  .event(0.78, 'magIn')
  .build();
