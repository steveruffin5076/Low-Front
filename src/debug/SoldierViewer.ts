import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { IDLE_INPUT, SoldierAnimator, type SoldierInput } from '../anim/SoldierAnimator';
import { GameLoop } from '../core/GameLoop';
import { GAIT, type Team } from '../data/soldier';
import { MOVEMENT } from '../data/player';
import { DEFAULT_LOADOUT, WEAPON_IDS, WEAPONS, type WeaponId } from '../data/weapons';
import { SoldierModel, type SoldierLod } from '../entities/soldier/SoldierModel';
import { SoldierRig } from '../entities/soldier/SoldierRig';
import { Lighting } from '../render/Lighting';
import { Renderer } from '../render/Renderer';
import { button, el } from '../ui/dom';
import './viewer.css';

const VIEWER = {
  background: 0x9fb7c9,
  ground: 0x7d8a76,
  gridColor: 0x56614f,
  fov: 35,
  target: new THREE.Vector3(0, 0.95, 0),
  distance: 4.6,
  slowMotion: 0.25,
  /** Seconds per jump loop, and take-off speed (m/s). */
  jumpPeriod: 1.1,
  jumpSpeed: 3.3,
  fireInterval: 0.1,
} as const;

type Motion = 'Idle' | 'Walk' | 'Run' | 'Sprint' | 'Crouch' | 'Crouch walk' | 'Strafe left' | 'Strafe right' | 'Backpedal' | 'Jump' | 'Fire';
const MOTIONS: Record<Motion, Partial<SoldierInput>> = {
  Idle: {},
  Walk: { moveForward: GAIT.walkSpeed },
  Run: { moveForward: MOVEMENT.walkSpeed },
  Sprint: { moveForward: MOVEMENT.sprintSpeed, sprinting: true },
  Crouch: { crouched: true },
  'Crouch walk': { crouched: true, moveForward: MOVEMENT.crouchSpeed },
  'Strafe left': { moveRight: -GAIT.walkSpeed },
  'Strafe right': { moveRight: GAIT.walkSpeed },
  Backpedal: { moveForward: -GAIT.walkSpeed },
  Jump: {},
  Fire: {},
};

type ViewName = 'Front' | 'Side' | 'Back' | 'Free';
const VIEW_DIRS: Record<Exclude<ViewName, 'Free'>, THREE.Vector3> = {
  // The soldier faces −Z.
  Front: new THREE.Vector3(0, 0.15, -1),
  Side: new THREE.Vector3(1, 0.15, 0),
  Back: new THREE.Vector3(0, 0.15, 1),
};

/** `/?debug=soldier`: one soldier on a treadmill grid to review every third-person animation. */
export class SoldierViewer {
  private readonly renderer: Renderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(VIEWER.fov, 1, 0.05, 100);
  private readonly controls: OrbitControls;
  private readonly loop: GameLoop;
  private readonly panel: HTMLElement;
  private readonly grid = new THREE.GridHelper(20, 20, VIEWER.gridColor, VIEWER.gridColor);
  private model!: SoldierModel;
  private rig!: SoldierRig;
  private readonly anim = new SoldierAnimator();
  private team: Team = 'blue';
  private primary: WeaponId = DEFAULT_LOADOUT.primary;
  private lod: SoldierLod = 'near';
  private motion: Motion = 'Idle';
  private pitch = 0;
  private slow = false;
  private clock = 0;
  private fireClock = 0;
  private stats = { drawCalls: 0, triangles: 0 };
  private readonly info = el('p', { class: 'viewer-info' });

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.renderer = new Renderer(canvas);
    this.scene.background = new THREE.Color(VIEWER.background);
    const lighting = new Lighting(this.scene, false);
    lighting.follow(new THREE.Vector3());
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: VIEWER.ground }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.grid.position.y = 0.002;
    this.scene.add(ground, this.grid);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.panel = el('div', { class: 'viewer-panel' });
    ui.append(this.panel);
    this.loop = new GameLoop({
      fixedUpdate: () => {},
      update: (dt) => this.update(dt),
      render: () => {
        this.renderer.render(this.scene, this.camera);
        this.stats = this.renderer.takeStats();
      },
    });
    // Dev only: lets automated checks drive the viewer.
    (window as unknown as { __viewer: SoldierViewer }).__viewer = this;
  }

  start(): void {
    this.build();
    this.setView('Free');
    this.loop.start();
    window.setInterval(() => this.refreshInfo(), 500);
  }

  setMotion(m: Motion): void {
    this.motion = m;
    this.clock = 0;
    this.renderPanel();
  }

  setView(view: ViewName): void {
    const dir = view === 'Free' ? new THREE.Vector3(-0.8, 0.3, -1).normalize() : VIEW_DIRS[view].clone().normalize();
    this.controls.target.copy(VIEWER.target);
    this.camera.position.copy(VIEWER.target).addScaledVector(dir, VIEWER.distance);
    this.controls.update();
  }

  /** Test hooks. */
  setTeam(t: Team): void {
    this.team = t;
    this.build();
  }

  setPrimary(id: WeaponId): void {
    this.primary = id;
    this.build();
  }

  setLod(l: SoldierLod): void {
    this.lod = l;
    this.model.setLod(l);
    this.renderPanel();
  }

  setPitch(p: number): void {
    this.pitch = p;
  }

  action(name: 'reload' | 'switch' | 'dieFront' | 'dieBack' | 'dieLeft' | 'dieRight' | 'reset'): void {
    const a = this.anim;
    const def = WEAPONS[a.active === 'primary' ? this.primary : DEFAULT_LOADOUT.secondary];
    if (name === 'reload') a.reload(def.reload.tactical);
    else if (name === 'switch') a.switchWeapon();
    else if (name === 'reset') a.reset();
    // Shot from the front falls backward, and so on.
    else a.die({ dieFront: Math.PI, dieBack: 0, dieLeft: Math.PI / 2, dieRight: -Math.PI / 2 }[name]);
    this.renderPanel();
  }

  private build(): void {
    if (this.model) this.model.dispose();
    this.model = new SoldierModel(this.team, { primary: this.primary, secondary: DEFAULT_LOADOUT.secondary });
    this.model.setLod(this.lod);
    this.rig = new SoldierRig(this.model);
    this.anim.reset();
    this.scene.add(this.model.root);
    this.renderPanel();
  }

  private update(realDt: number): void {
    const dt = Math.min(realDt, 0.1) * (this.slow ? VIEWER.slowMotion : 1);
    this.clock += dt;
    const input: SoldierInput = { ...IDLE_INPUT, ...MOTIONS[this.motion], pitch: this.pitch };
    if (this.motion === 'Jump') {
      // A jump arc on a loop: rising, then falling, then a short landing.
      const t = this.clock % VIEWER.jumpPeriod;
      const air = (2 * VIEWER.jumpSpeed) / MOVEMENT.gravity;
      input.grounded = t > air;
      input.verticalSpeed = input.grounded ? 0 : VIEWER.jumpSpeed - MOVEMENT.gravity * t;
      this.model.root.position.y = input.grounded ? 0 : VIEWER.jumpSpeed * t - 0.5 * MOVEMENT.gravity * t * t;
    } else {
      this.model.root.position.y = 0;
    }
    if (this.motion === 'Fire' && (this.fireClock += dt) >= VIEWER.fireInterval) {
      this.fireClock = 0;
      this.anim.fire();
    }
    this.rig.apply(this.anim.update(dt, input));
    this.model.setOpacity(this.anim.pose.opacity);
    // Treadmill: the grid slides under the feet, so foot slide shows.
    this.grid.position.z = (this.grid.position.z - input.moveForward * dt + 1) % 1;
    this.grid.position.x = (this.grid.position.x + input.moveRight * dt + 1) % 1;
    this.controls.update();
  }

  private renderPanel(): void {
    const choice = <T>(label: string, value: T, current: T, set: (v: T) => void): HTMLButtonElement => {
      const b = button(label, () => set(value));
      if (value === current) b.classList.add('active');
      return b;
    };
    const slider = el('input', { attrs: { type: 'range', min: '-60', max: '60', value: String(Math.round(THREE.MathUtils.radToDeg(this.pitch))) } });
    slider.addEventListener('input', () => (this.pitch = THREE.MathUtils.degToRad(Number(slider.value))));
    this.panel.replaceChildren(
      el('h1', { text: 'Soldier Viewer' }),
      el('h2', { text: 'Motion' }),
      el('div', { class: 'viewer-row' }, (Object.keys(MOTIONS) as Motion[]).map((m) => choice(m, m, this.motion, (v) => this.setMotion(v)))),
      el('h2', { text: 'Actions' }),
      el('div', { class: 'viewer-row' }, [
        button('Reload', () => this.action('reload')),
        button('Switch weapon', () => this.action('switch')),
        button('Shot from front', () => this.action('dieFront')),
        button('Shot from back', () => this.action('dieBack')),
        button('Shot from left', () => this.action('dieLeft')),
        button('Shot from right', () => this.action('dieRight')),
        button('Reset', () => this.action('reset')),
      ]),
      el('h2', { text: 'Aim pitch' }),
      slider,
      el('h2', { text: 'Soldier' }),
      el('div', { class: 'viewer-row' }, [
        choice('Blue', 'blue' as Team, this.team, (v) => this.setTeam(v)),
        choice('Red', 'red' as Team, this.team, (v) => this.setTeam(v)),
        ...WEAPON_IDS.filter((id) => WEAPONS[id].slot === 'primary').map((id) => choice(WEAPONS[id].name, id, this.primary, (v) => this.setPrimary(v))),
        choice('Near model', 'near' as SoldierLod, this.lod, (v) => this.setLod(v)),
        choice('Far model', 'far' as SoldierLod, this.lod, (v) => this.setLod(v)),
      ]),
      el('h2', { text: 'Camera' }),
      el('div', { class: 'viewer-row' }, [
        ...(['Front', 'Side', 'Back', 'Free'] as ViewName[]).map((v) => button(v, () => this.setView(v))),
        choice('Slow motion', true, this.slow, () => {
          this.slow = !this.slow;
          this.renderPanel();
        }),
      ]),
      el('h2', { text: 'Info' }),
      this.info,
    );
    this.refreshInfo();
  }

  private refreshInfo(): void {
    const tris = (this.lod === 'near' ? this.model.near : this.model.far).geometry.getAttribute('position').count / 3;
    const a = this.anim;
    this.info.textContent = [
      `Triangles   ${tris}`,
      `Draw calls  ${this.stats.drawCalls}`,
      `Weapon      ${a.active === 'primary' ? WEAPONS[this.primary].name : WEAPONS[DEFAULT_LOADOUT.secondary].name}`,
      `State       ${a.dead ? 'dead' : a.reloading ? 'reloading' : a.switching ? 'switching' : this.motion.toLowerCase()}`,
    ].join('\n');
  }
}
