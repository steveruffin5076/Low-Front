import * as THREE from 'three';
import { LIGHTING } from '../data/lighting';
import { RESUPPLY } from '../data/resupply';
import type { TeamId } from '../data/map/types';
import type { Crate } from '../game/Resupply';

const M = RESUPPLY.model;

/**
 * A resupply crate: olive box with a lid and a white cross, and a stripe around it in the
 * color of the team that may use it (grey while the flag is neutral).
 */
export class ResupplyCrate {
  readonly root = new THREE.Group();
  private readonly stripe: THREE.MeshStandardMaterial;
  private owner: TeamId | null | undefined;

  constructor(crate: Crate) {
    const [w, h, d] = M.size;
    this.root.position.copy(crate.position);
    // Long side toward the flag looks deliberate; any fixed turn would do.
    this.root.rotation.y = Math.atan2(crate.position.x, crate.position.z);
    const mat = (color: number) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), mat(M.body));
    const lid = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.08, d + 0.06).translate(0, h + 0.04, 0), mat(M.lid));
    const crossMat = mat(M.cross);
    const crossA = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.08).translate(0, h + 0.09, 0), crossMat);
    const crossB = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.26).translate(0, h + 0.09, 0), crossMat);
    this.stripe = mat(M.stripeNeutral);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.1, d + 0.02).translate(0, h * 0.55, 0), this.stripe);
    for (const m of [body, lid, stripe]) m.castShadow = true;
    this.root.add(body, lid, stripe, crossA, crossB);
  }

  /** Stripe in the owner's color. */
  setOwner(owner: TeamId | null): void {
    if (owner === this.owner) return;
    this.owner = owner;
    this.stripe.color.setHex(owner ? LIGHTING.flag[owner] : M.stripeNeutral);
  }
}
