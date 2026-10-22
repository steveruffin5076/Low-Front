import * as THREE from 'three';
import { CROWD, type CrowdAction } from '../data/crowd';
import type { MapData, SpawnDef, TeamId } from '../data/map/types';
import { Soldier } from '../entities/soldier/Soldier';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import type { NavGrid } from '../world/NavGrid';

/** Small deterministic random generator (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Walker {
  soldier: Soldier;
  gait: (typeof CROWD.gaits)[number];
  path: THREE.Vector3[];
  /** Index of the point being walked toward. */
  index: number;
}

interface Stander {
  soldier: Soldier;
  spot: THREE.Vector3;
  yaw: number;
  clock: number;
  offset: number;
  action: CrowdAction | null;
  fireClock: number;
  /** Strafing and backpedaling only where the ground allows. */
  canStrafe: boolean;
  canBackpedal: boolean;
}

const vel = new THREE.Vector3();

/**
 * Phase 6 performance test: 16 Blue and 16 Red soldiers on the map. Half walk, run, sprint or
 * crouch-walk along nav paths between flags; half stand at flag spawn points and cycle through
 * idle, fire, crouch, reload, strafe, backpedal, switch and jump. Shot soldiers die and respawn.
 */
export class SoldierCrowd {
  readonly soldiers: Soldier[] = [];
  private readonly walkers: Walker[] = [];
  private readonly standers: Stander[] = [];
  private readonly random = rng(CROWD.seed);
  private time = 0;

  constructor(
    physics: PhysicsWorld,
    scene: THREE.Scene,
    private readonly nav: NavGrid,
    private readonly map: MapData,
  ) {
    for (const team of ['blue', 'red'] as const) {
      const spots = this.teamSpots(team);
      for (let i = 0; i < CROWD.perTeam; i++) {
        const loadout = { primary: i % 2 ? 'ak47' : 'm4a1', secondary: 'm1911' } as const;
        const name = `${team === 'blue' ? 'Blue' : 'Red'} soldier ${i + 1}`;
        const soldier = new Soldier(physics, team, loadout, name);
        scene.add(soldier.model.root);
        this.soldiers.push(soldier);
        const spot = spots[i % spots.length];
        const at = new THREE.Vector3(spot.x, 0, spot.z);
        soldier.spawn(at, spot.yaw);
        if (i < CROWD.walkersPerTeam) {
          const w: Walker = { soldier, gait: CROWD.gaits[i % CROWD.gaits.length], path: [], index: 0 };
          this.newPath(w);
          this.walkers.push(w);
        } else {
          const right = new THREE.Vector3(Math.cos(spot.yaw), 0, -Math.sin(spot.yaw));
          const back = new THREE.Vector3(Math.sin(spot.yaw), 0, Math.cos(spot.yaw));
          this.standers.push({
            soldier,
            spot: at,
            yaw: spot.yaw,
            clock: 0,
            offset: i,
            action: null,
            fireClock: 0,
            canStrafe: this.clear(at, right) && this.clear(at, right.clone().negate()),
            canBackpedal: this.clear(at, back),
          });
        }
      }
    }
  }

  fixedUpdate(dt: number): void {
    for (const s of this.soldiers) s.fixedUpdate(dt);
  }

  update(dt: number, camera: THREE.Camera): void {
    this.time += dt;
    for (const w of this.walkers) this.updateWalker(w, dt);
    for (const s of this.standers) this.updateStander(s, dt);
    for (const s of this.soldiers) s.update(dt, camera.position);
  }

  dispose(): void {
    for (const s of this.soldiers) s.dispose();
  }

  /** Spawn points around the team's flags. */
  private teamSpots(team: TeamId): SpawnDef[] {
    const out: SpawnDef[] = [];
    for (const f of CROWD.flags[team]) out.push(...this.map.flagSpawns[f as keyof MapData['flagSpawns']]);
    return out;
  }

  /** True if the ground `stepRange` meters along `dir` is walkable at the same height. */
  private clear(at: THREE.Vector3, dir: THREE.Vector3): boolean {
    for (let d = 0.5; d <= CROWD.stepRange + 0.5; d += 0.5) {
      const p = at.clone().addScaledVector(dir, d);
      const n = this.nav.node(p.x, at.y, p.z);
      if (n === null || !this.nav.walkable(n)) return false;
    }
    return true;
  }

  private newPath(w: Walker): void {
    const flags = this.map.flags;
    const from = w.soldier.position;
    for (let tries = 0; tries < 5; tries++) {
      const f = flags[Math.floor(this.random() * flags.length)];
      const spawns = this.map.flagSpawns[f.id];
      const s = spawns[Math.floor(this.random() * spawns.length)];
      const to = new THREE.Vector3(s.x, 0, s.z);
      if (to.distanceTo(from) < 20) continue;
      const path = this.nav.findPath(from, to);
      if (path && path.length > 1) {
        w.path = this.nav.pathPoints(path);
        w.index = 1;
        return;
      }
    }
    w.path = [];
  }

  private updateWalker(w: Walker, dt: number): void {
    const s = w.soldier;
    if (s.dead) {
      s.input.moveForward = s.input.moveRight = 0;
      if (s.gone) {
        const spots = this.teamSpots(s.team);
        const spot = spots[Math.floor(this.random() * spots.length)];
        s.spawn(new THREE.Vector3(spot.x, 0, spot.z), spot.yaw);
        this.newPath(w);
      }
      return;
    }
    if (w.index >= w.path.length) this.newPath(w);
    const target = w.path[w.index];
    if (!target) return;
    vel.subVectors(target, s.position);
    const dist = Math.hypot(vel.x, vel.z);
    const stepLen = w.gait.speed * dt;
    if (dist <= stepLen) {
      s.position.copy(target);
      w.index++;
    } else {
      s.position.x += (vel.x / dist) * stepLen;
      s.position.z += (vel.z / dist) * stepLen;
      s.position.y += (vel.y * stepLen) / dist;
    }
    // Turn toward the path; the local velocity drives the gait (strafing while turning).
    if (dist > 0.01) {
      const heading = Math.atan2(-vel.x, -vel.z);
      const diff = THREE.MathUtils.euclideanModulo(heading - s.yaw + Math.PI, Math.PI * 2) - Math.PI;
      s.yaw += THREE.MathUtils.clamp(diff, -CROWD.turnRate * dt, CROWD.turnRate * dt);
      this.setLocalVelocity(s, (vel.x / dist) * w.gait.speed, (vel.z / dist) * w.gait.speed);
    }
    s.input.sprinting = w.gait.sprint;
    s.input.crouched = w.gait.crouch;
    s.input.pitch = 0;
  }

  private updateStander(st: Stander, dt: number): void {
    const s = st.soldier;
    if (s.dead) {
      if (s.gone) {
        s.spawn(st.spot, st.yaw);
        st.clock = 0;
        st.action = null;
      }
      return;
    }
    st.clock += dt;
    const T = CROWD.actionTime;
    const n = CROWD.actions.length;
    let action: CrowdAction = CROWD.actions[(st.offset + Math.floor(st.clock / T)) % n];
    if ((action === 'strafeLeft' || action === 'strafeRight') && !st.canStrafe) action = 'idle';
    if (action === 'backpedal' && !st.canBackpedal) action = 'idle';
    const t = st.clock % T;
    if (action !== st.action) {
      st.action = action;
      s.position.copy(st.spot);
      if (action === 'reload') s.reload();
      if (action === 'switch') s.switchWeapon();
    }
    const input = s.input;
    input.moveForward = input.moveRight = 0;
    input.crouched = action === 'crouch' || action === 'crouchFire';
    input.sprinting = false;
    input.grounded = true;
    input.verticalSpeed = 0;
    input.pitch = Math.sin(this.time * 0.7 + st.offset) * CROWD.pitchAmplitude;
    s.yaw = st.yaw;
    if (action === 'fire' || action === 'crouchFire') {
      if ((st.fireClock += dt) >= CROWD.fireInterval) {
        st.fireClock = 0;
        s.fire();
      }
    }
    // Strafe and backpedal: out and back along one axis (speed follows the motion).
    if (action === 'strafeLeft' || action === 'strafeRight' || action === 'backpedal') {
      const w = (Math.PI * 2) / T;
      const sign = action === 'strafeLeft' ? -1 : 1;
      const offset = sign * CROWD.stepRange * Math.sin(w * t);
      const speed = sign * CROWD.stepRange * w * Math.cos(w * t);
      const sin = Math.sin(st.yaw);
      const cos = Math.cos(st.yaw);
      if (action === 'backpedal') {
        // Backward is +Z turned by yaw; moveForward is negative while moving back.
        s.position.set(st.spot.x + sin * offset, st.spot.y, st.spot.z + cos * offset);
        input.moveForward = -speed;
      } else {
        s.position.set(st.spot.x + cos * offset, st.spot.y, st.spot.z - sin * offset);
        input.moveRight = speed;
      }
    }
    if (action === 'jump') {
      const { speed, gravity } = CROWD.jump;
      const air = (2 * speed) / gravity;
      const jt = t % (T / 2);
      input.grounded = jt > air;
      input.verticalSpeed = input.grounded ? 0 : speed - gravity * jt;
      s.position.y = st.spot.y + (input.grounded ? 0 : speed * jt - 0.5 * gravity * jt * jt);
    }
  }

  /** Sets the soldier's input velocity from a world velocity. */
  private setLocalVelocity(s: Soldier, vx: number, vz: number): void {
    const sin = Math.sin(s.yaw);
    const cos = Math.cos(s.yaw);
    s.input.moveForward = -vx * sin - vz * cos;
    s.input.moveRight = vx * cos - vz * sin;
  }
}
