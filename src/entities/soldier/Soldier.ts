import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { IDLE_INPUT, SoldierAnimator, type SoldierInput } from '../../anim/SoldierAnimator';
import { SOLDIER_BODY, SOLDIER_HITBOXES, SOLDIER_LOD, type Team } from '../../data/soldier';
import { WEAPONS, type Loadout } from '../../data/weapons';
import { COLLISION, type Hittable, type ZoneHit } from '../../physics/collision';
import type { PhysicsWorld } from '../../physics/PhysicsWorld';
import { Health } from '../Health';
import { Hitboxes } from '../Hitboxes';
import { SoldierModel } from './SoldierModel';
import { SoldierRig } from './SoldierRig';

const tmpM = new THREE.Matrix4();
const tmpP = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const offset = new THREE.Matrix4();

/**
 * A third-person soldier in the world: model, animator and rig, health, hitboxes that follow the
 * bones, and optionally a body that blocks the player. Whoever drives it (a bot, the viewers)
 * sets `position`, `yaw` and `input` each frame.
 */
export class Soldier implements Hittable {
  readonly model: SoldierModel;
  readonly anim = new SoldierAnimator();
  readonly health = new Health();
  readonly position = new THREE.Vector3();
  yaw = 0;
  input: SoldierInput = { ...IDLE_INPUT };
  lastHit: ZoneHit | null = null;
  private readonly rig: SoldierRig;
  private readonly hitboxes: Hitboxes;
  /** Match id when a bot drives this soldier (for kill reports). */
  combatantId?: string;
  private readonly body: RAPIER.Collider | null;
  private farClock = 0;

  constructor(
    private readonly physics: PhysicsWorld,
    team: Team,
    loadout: Loadout,
    readonly label: string,
    /** False when a character controller already blocks movement (bots). */
    blockingBody = true,
  ) {
    this.model = new SoldierModel(team, loadout);
    this.rig = new SoldierRig(this.model);
    this.hitboxes = new Hitboxes(physics, this, SOLDIER_HITBOXES, new THREE.Vector3());
    const { rapier, world } = physics;
    this.body = !blockingBody ? null : world.createCollider(
      rapier.ColliderDesc.capsule(SOLDIER_BODY.halfHeight, SOLDIER_BODY.radius).setCollisionGroups(COLLISION.body),
    );
  }

  get team(): Team {
    return this.model.team;
  }

  get dead(): boolean {
    return this.health.dead;
  }

  /** Gone: died and faded out; ready to respawn. */
  get gone(): boolean {
    return this.anim.gone;
  }

  /** Puts the soldier at `pos` (feet), alive, idle and facing `yaw`. */
  spawn(pos: THREE.Vector3, yaw: number): void {
    this.position.copy(pos);
    this.yaw = yaw;
    this.input = { ...IDLE_INPUT };
    this.health.reset();
    this.anim.reset();
    this.lastHit = null;
    this.hitboxes.setEnabled(true);
    this.body?.setEnabled(true);
    this.model.setOpacity(1);
    this.model.root.visible = true;
    this.pose(0);
    this.syncPhysics();
  }

  fire(): void {
    this.anim.fire();
  }

  reload(): void {
    const def = WEAPONS[this.model.loadout[this.anim.active]];
    this.anim.reload(def.reload.tactical);
  }

  switchWeapon(): void {
    this.anim.switchWeapon();
  }

  applyHit(hit: ZoneHit): void {
    if (this.health.dead) return;
    hit.killed = this.health.damage(hit.damage);
    hit.remainingHp = this.health.hp;
    this.lastHit = hit;
    if (!hit.killed) return;
    // Fall the way the bullet travelled, in the soldier's frame (forward is −Z turned by yaw).
    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    const forward = -hit.direction.x * s - hit.direction.z * c;
    const right = hit.direction.x * c - hit.direction.z * s;
    this.anim.die(Math.atan2(right, forward));
    this.hitboxes.setEnabled(false);
    this.body?.setEnabled(false);
  }

  /** Fixed step: health regeneration and the physics shapes follow the last pose. */
  fixedUpdate(dt: number): void {
    this.health.update(dt);
    if (!this.dead) this.syncPhysics();
  }

  /** Frame update: level of detail by distance to the camera, animation, fade. */
  update(dt: number, cameraPos: THREE.Vector3): void {
    const far = this.position.distanceTo(cameraPos) > SOLDIER_LOD.distance;
    if (far !== (this.model.lod === 'far')) this.model.setLod(far ? 'far' : 'near');
    if (far) {
      // Far soldiers animate at a lower rate; the clock keeps time exact.
      this.farClock += dt;
      if (this.farClock < 1 / SOLDIER_LOD.farUpdateRate) return;
      dt = this.farClock;
    }
    this.farClock = 0;
    this.pose(dt);
  }

  dispose(): void {
    this.hitboxes.dispose();
    if (this.body) this.physics.world.removeCollider(this.body, false);
    this.model.dispose();
  }

  private pose(dt: number): void {
    const root = this.model.root;
    root.position.copy(this.position);
    root.rotation.y = this.yaw;
    root.updateWorldMatrix(true, false);
    this.rig.apply(this.anim.update(dt, this.input));
    this.model.setOpacity(this.anim.pose.opacity);
    if (this.anim.gone) root.visible = false;
  }

  private syncPhysics(): void {
    const bones = this.model.bones;
    SOLDIER_HITBOXES.forEach((h, i) => {
      offset.makeTranslation(h.pos[0], h.pos[1], h.pos[2]);
      tmpM.multiplyMatrices(bones[h.bone].matrixWorld, offset).decompose(tmpP, tmpQ, tmpS);
      this.hitboxes.place(i, tmpP, tmpQ);
    });
    this.body?.setTranslation({ x: this.position.x, y: this.position.y + SOLDIER_BODY.centerY, z: this.position.z });
  }
}
