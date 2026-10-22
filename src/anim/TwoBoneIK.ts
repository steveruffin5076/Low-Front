import * as THREE from 'three';

const dir = new THREE.Vector3();
const toPole = new THREE.Vector3();
const bend = new THREE.Vector3();

/**
 * Solves a two-bone chain (shoulder → elbow → hand) so the hand reaches `target`.
 * `pole` is a point the elbow bends toward. Returns the elbow position in `outElbow`
 * and the reachable hand position in `outHand` (the target, pulled in if out of reach).
 */
export function solveTwoBone(
  root: THREE.Vector3,
  target: THREE.Vector3,
  pole: THREE.Vector3,
  upperLength: number,
  lowerLength: number,
  outElbow: THREE.Vector3,
  outHand: THREE.Vector3,
): void {
  dir.subVectors(target, root);
  const reach = upperLength + lowerLength;
  const minReach = Math.abs(upperLength - lowerLength) + 1e-4;
  const dist = THREE.MathUtils.clamp(dir.length(), minReach, reach - 1e-4);
  if (dir.lengthSq() < 1e-12) dir.set(0, 0, -1);
  dir.normalize();

  // Law of cosines: angle at the root between the root→target line and the upper bone.
  const cosA = (upperLength * upperLength + dist * dist - lowerLength * lowerLength) / (2 * upperLength * dist);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));

  // Bend direction: the part of root→pole that is perpendicular to root→target.
  toPole.subVectors(pole, root);
  bend.copy(toPole).addScaledVector(dir, -toPole.dot(dir));
  if (bend.lengthSq() < 1e-10) bend.set(0, -1, 0).addScaledVector(dir, -dir.y);
  bend.normalize();

  outElbow.copy(root).addScaledVector(dir, upperLength * cosA).addScaledVector(bend, upperLength * sinA);
  outHand.copy(root).addScaledVector(dir, dist);
}
