import * as THREE from 'three';
import { PALETTE } from '../../data/palette';
import type { WeaponId } from '../../data/weapons';

/**
 * Simple box weapons used until the real models arrive in Phase 2.
 * Sizes in meters; the barrel points along +Z, origin at the pistol grip.
 */
interface PlaceholderSpec {
  receiver: [number, number, number];
  barrelLength: number;
  barrelRadius: number;
  stockLength: number;
  magazine: [number, number, number];
  magazineTilt: number;
  grip: [number, number, number];
  body: number;
  furniture: number;
}

const SPECS: Record<WeaponId, PlaceholderSpec> = {
  m4a1: {
    receiver: [0.05, 0.09, 0.42],
    barrelLength: 0.3,
    barrelRadius: 0.012,
    stockLength: 0.22,
    magazine: [0.03, 0.2, 0.07],
    magazineTilt: 0.12,
    grip: [0.03, 0.1, 0.04],
    body: PALETTE.polymerBlack,
    furniture: PALETTE.polymerBlack,
  },
  ak47: {
    receiver: [0.05, 0.09, 0.46],
    barrelLength: 0.32,
    barrelRadius: 0.012,
    stockLength: 0.24,
    magazine: [0.03, 0.22, 0.07],
    magazineTilt: 0.35,
    grip: [0.03, 0.1, 0.04],
    body: PALETTE.gunMetal,
    furniture: PALETTE.akWood,
  },
  m1911: {
    receiver: [0.03, 0.035, 0.21],
    barrelLength: 0,
    barrelRadius: 0,
    stockLength: 0,
    magazine: [0, 0, 0],
    magazineTilt: 0,
    grip: [0.032, 0.11, 0.05],
    body: PALETTE.gunMetal,
    furniture: PALETTE.m1911GripWood,
  },
};

export function buildPlaceholderWeapon(id: WeaponId): THREE.Group {
  const s = SPECS[id];
  const body = new THREE.MeshStandardMaterial({ color: s.body, flatShading: true, roughness: 0.6, metalness: 0.3 });
  const furniture = new THREE.MeshStandardMaterial({ color: s.furniture, flatShading: true, roughness: 0.8 });
  const group = new THREE.Group();
  group.name = `placeholder-${id}`;

  const box = (size: [number, number, number], mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  const [, rh, rl] = s.receiver;
  const receiverY = rh / 2 + s.grip[1] * 0.2;
  box(s.receiver, body, 0, receiverY, rl * 0.3);
  // Grip angles back like a real pistol grip.
  box(s.grip, furniture, 0, 0, 0).rotation.x = -0.25;

  if (s.barrelLength > 0) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(s.barrelRadius, s.barrelRadius, s.barrelLength, 8), body);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, receiverY + rh * 0.15, rl * 0.8 + s.barrelLength / 2);
    group.add(barrel);
    box([s.receiver[0] * 0.9, rh * 0.9, s.stockLength], furniture, 0, receiverY - rh * 0.1, -rl * 0.2 - s.stockLength / 2);
    box(s.magazine, body, 0, receiverY - rh / 2 - s.magazine[1] / 2, rl * 0.45).rotation.x = s.magazineTilt;
  }
  return group;
}
