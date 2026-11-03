import type { MapId } from '../matchSetup';
import { HARBOR } from './harbor';
import { VERDAN } from './index';
import type { MapData } from './types';

/** Every playable map by id (the Match setup screen picks one). */
export const MAPS: Record<MapId, MapData> = { verdan: VERDAN, harbor: HARBOR };
