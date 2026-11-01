import { ATTACHMENTS, COMPATIBLE, GUNSMITH, type AttachmentDef, type AttachmentEffects, type AttachmentId, type WeaponBuild } from '../data/attachments';
import type { WeaponDef, WeaponId } from '../data/weapons';

/** Drops attachments the weapon cannot take and any that sit in the wrong slot. */
export function validBuild(id: WeaponId, build: WeaponBuild | undefined): WeaponBuild {
  const allowed = COMPATIBLE[id] ?? [];
  const out: WeaponBuild = {};
  for (const [slot, att] of Object.entries(build ?? {}) as [keyof WeaponBuild, AttachmentId][]) {
    const def = ATTACHMENTS[att];
    if (def && def.slot === slot && allowed.includes(att)) out[slot] = att;
  }
  return out;
}

export function buildAttachments(build: WeaponBuild): AttachmentDef[] {
  return Object.values(build).map((id) => ATTACHMENTS[id!]);
}

const clamp = (v: number, [lo, hi]: readonly [number, number]): number => Math.min(hi, Math.max(lo, v));

/** Product of one effect over the build (1 when no part changes it). */
function product(parts: AttachmentDef[], key: Exclude<keyof AttachmentEffects, 'magazineAdd'>): number {
  return parts.reduce((k, p) => k * (p.effects[key] ?? 1), 1);
}

/** The weapon's stats with `build` applied (caps from `GUNSMITH.caps`). The id stays the same. */
export function fitWeapon(def: WeaponDef, build: WeaponBuild | undefined): WeaponDef {
  const b = validBuild(def.id, build);
  const parts = buildAttachments(b);
  const c = GUNSMITH.caps;
  const ads = clamp(product(parts, 'adsTime'), c.adsTime);
  const vRec = clamp(product(parts, 'verticalRecoil'), c.recoil);
  const hRec = clamp(product(parts, 'horizontalRecoil'), c.recoil);
  const hip = clamp(product(parts, 'hipSpread'), c.spread);
  const aim = clamp(product(parts, 'adsSpread'), c.spread);
  const move = clamp(product(parts, 'moveSpeed'), c.moveSpeed);
  const range = clamp(product(parts, 'range'), c.range);
  const reload = clamp(product(parts, 'reloadTime'), c.reloadTime);
  const extra = parts.reduce((n, p) => n + (p.effects.magazineAdd ?? 0), 0);
  return {
    ...def,
    build: b,
    suppressed: parts.some((p) => p.suppressed),
    magazine: def.magazine + extra,
    startingReserve: def.startingReserve + extra * 3,
    adsTime: def.adsTime * ads,
    moveSpeedModifier: Math.min(1, def.moveSpeedModifier * move),
    falloff: { start: def.falloff.start * range, end: def.falloff.end * range },
    reload: { tactical: def.reload.tactical * reload, empty: def.reload.empty * reload },
    spread: { hipDeg: def.spread.hipDeg * hip, adsDeg: def.spread.adsDeg * aim },
    recoil: { ...def.recoil, verticalDeg: def.recoil.verticalDeg * vRec, horizontalDeg: def.recoil.horizontalDeg * hRec },
  };
}

/** The optic in a build, if any. */
export function opticOf(build: WeaponBuild): AttachmentDef | null {
  return build.optic ? ATTACHMENTS[build.optic] : null;
}
