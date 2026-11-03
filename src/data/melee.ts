/** Quick knife and thrown smoke (enhancement-1 §4.1). Times in s, distances in m. */
export const KNIFE = {
  name: 'Knife',
  /** Reach from the eye. */
  reach: 1.8,
  damage: 55,
  /** From behind (the victim facing away): doubled, a kill from full health. */
  backMultiplier: 2,
  /** Facing within this of the attack direction counts as from behind (cosine). */
  backCos: 0.5,
  duration: 0.55,
  strikeAt: 0.16,
  /** Extra rays this far (rad) left, right and down of the aim, so a near miss still lands. */
  spread: 0.22,
  /** Bots stab instead of shooting when an enemy is this close. */
  botRange: 1.6,
} as const;

export const SMOKE = {
  /** Grenades per life, refilled at a resupply crate. */
  perLife: 2,
  throwSpeed: 15,
  /** Thrown this much above the aim (rad). */
  throwLift: 0.18,
  gravity: 9.81,
  /** Bounce: speed kept after hitting something. */
  bounce: 0.35,
  /** The cloud starts this long after the throw, grows to full size over `bloom`, lasts `life`, then thins over `fade`. */
  fuse: 1.4,
  bloom: 1.2,
  life: 12,
  fade: 2.5,
  radius: 8,
  /** Throw animation: total length and when the grenade leaves the hand. */
  throwTime: 0.75,
  releaseAt: 0.38,
  /** Bots throw one when retreating from a visible enemy, at most this often. */
  botCooldown: 35,
} as const;
