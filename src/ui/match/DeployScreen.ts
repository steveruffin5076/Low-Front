import type { Rect } from '../../data/map/types';
import type { Loadout } from '../../data/weapons';
import { spawnLabel, type SpawnChoice } from '../../game/SpawnSystem';
import type { PreviewRenderer } from '../../render/PreviewRenderer';
import type { ConquestSession } from '../../scenes/ConquestSession';
import { button, el } from '../dom';
import './match.css';
import { LargeMap } from '../hud/LargeMap';
import { LoadoutPanel } from '../profile/LoadoutPanel';

const CAUSE: Record<string, string> = {
  fall: 'You fell to your death',
  bounds: 'You left the battlefield',
  hq: 'You entered the enemy HQ',
  suicide: 'You died',
};
const MAP_SIZE = 460;

/**
 * Deploy Screen (plan section 11.3): who killed the player, the battlefield map with the spawn
 * choices (HQ and Blue flags), a 10 s countdown before "Deploy" unlocks, and the loadout panel
 * (applied on the next spawn).
 */
export class DeployScreen {
  readonly element: HTMLElement;
  private readonly map: LargeMap;
  private readonly loadoutPanel: LoadoutPanel;
  private readonly choices = el('div', { class: 'ds-choices' });
  private readonly deployButton: HTMLButtonElement;
  private choice: SpawnChoice = { kind: 'hq' };
  private loadout: Loadout;
  private optionsKey = '';

  constructor(
    private readonly conquest: ConquestSession,
    loadout: Loadout,
    onLoadout: (l: Loadout) => void,
    private readonly onDeploy: (choice: SpawnChoice, loadout: Loadout) => void,
  ) {
    this.loadout = { ...loadout };
    this.map = new LargeMap(conquest.mapImage, MAP_SIZE, 'ds-map');
    this.map.canvas.addEventListener('click', this.onMapClick);
    this.loadoutPanel = new LoadoutPanel(loadout, (l) => {
      this.loadout = l;
      onLoadout(l);
    });
    this.deployButton = button('Deploy', () => this.deploy(), 'btn btn-primary ds-deploy');
    const d = conquest.lastDeath;
    const title = d?.killer
      ? `Killed by ${d.killer.name}`
      : CAUSE[d?.cause ?? 'suicide'];
    const detail = d?.killer ? `${d.weapon} · ${d.distance.toFixed(0)} m${d.headshot ? ' · headshot' : ''}` : '';
    this.element = el('div', { class: 'deploy-screen' }, [
      el('div', { class: 'ds-head' }, [el('h2', { class: 'ds-title', text: title }), el('p', { class: 'ds-detail', text: detail })]),
      el('div', { class: 'ds-body' }, [
        el('div', { class: 'panel ds-spawn' }, [
          el('h2', { class: 'panel-title', text: 'Choose a spawn' }),
          this.map.element,
          this.choices,
        ]),
        this.loadoutPanel.element,
      ]),
      el('div', { class: 'ds-bottom' }, [this.deployButton]),
    ]);
  }

  update(dt: number): void {
    this.loadoutPanel.update(dt);
    const options = this.conquest.spawnOptions();
    const key = options.map(spawnLabel).join(',');
    if (key !== this.optionsKey) {
      this.optionsKey = key;
      // A flag lost while waiting falls back to HQ.
      if (!options.some((o) => spawnLabel(o) === spawnLabel(this.choice))) this.choice = { kind: 'hq' };
      this.renderChoices(options);
    }
    const wait = this.conquest.respawnWait;
    this.deployButton.disabled = wait > 0;
    this.deployButton.textContent = wait > 0 ? `Deploy in ${Math.ceil(wait)}` : `Deploy at ${spawnLabel(this.choice)}`;
    const m = this.conquest.match;
    this.map.draw(m.zones.map((z) => ({ id: z.flag.id, x: z.flag.x, z: z.flag.z, owner: z.owner })), [], null, this.choice.kind === 'flag' ? this.choice.flag : undefined);
    this.drawHq();
  }

  draw(preview: PreviewRenderer): void {
    this.loadoutPanel.draw(preview);
  }

  dispose(): void {
    this.loadoutPanel.dispose();
    this.element.remove();
  }

  private deploy(): void {
    if (this.conquest.respawnWait > 0) return;
    this.onDeploy(this.choice, { ...this.loadout });
  }

  private renderChoices(options: SpawnChoice[]): void {
    this.choices.replaceChildren(
      ...options.map((o) => {
        const label = o.kind === 'hq' ? 'HQ' : `Flag ${o.flag}`;
        const b = button(label, () => {
          this.choice = o;
          this.renderChoices(options);
        }, `btn ds-choice${spawnLabel(o) === spawnLabel(this.choice) ? ' active' : ''}`);
        return b;
      }),
    );
  }

  /** Outlines Blue HQ on the map, highlighted when it is the choice. */
  private drawHq(): void {
    const g = this.map.canvas.getContext('2d');
    if (!g) return;
    const hq = this.hqRect();
    const [x0, y0] = this.map.toCanvas(hq.x0, hq.z0);
    const [x1, y1] = this.map.toCanvas(hq.x1, hq.z1);
    g.strokeStyle = this.choice.kind === 'hq' ? '#ffe066' : 'rgba(255,255,255,0.5)';
    g.lineWidth = this.choice.kind === 'hq' ? 3 : 1.5;
    g.strokeRect(x0, y0, x1 - x0, y1 - y0);
    g.fillStyle = '#fff';
    g.font = 'bold 12px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('HQ', (x0 + x1) / 2, (y0 + y1) / 2 + 4);
  }

  private hqRect(): Rect {
    return this.conquest.mapImage.map.hqs.find((h) => h.team === 'blue')!.rect;
  }

  /** Clicking a Blue flag or the HQ on the map picks it. */
  private onMapClick = (e: MouseEvent): void => {
    const rect = this.map.canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * this.map.canvas.width;
    const sy = ((e.clientY - rect.top) / rect.height) * this.map.canvas.height;
    const options = this.conquest.spawnOptions();
    let best: SpawnChoice | null = null;
    let bestD = 30;
    for (const o of options) {
      let px: number;
      let py: number;
      if (o.kind === 'hq') {
        const r = this.hqRect();
        [px, py] = this.map.toCanvas((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2);
      } else {
        const f = this.conquest.match.zones.find((z) => z.flag.id === o.flag)!.flag;
        [px, py] = this.map.toCanvas(f.x, f.z);
      }
      const d = Math.hypot(px - sx, py - sy);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    if (best) {
      this.choice = best;
      this.renderChoices(options);
    }
  };
}

