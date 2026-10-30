import { HUD } from '../../data/hud';
import type { TeamId } from '../../data/map/types';
import type { CaptureZone } from '../../game/CaptureZone';
import type { ConquestMatch, KillFeedEntry } from '../../game/ConquestMatch';
import { el } from '../dom';
import type { PlayerHud, PlayerReadout } from '../PlayerHud';
import { CaptureBanner } from './CaptureBanner';
import { CombatFeedback } from './CombatFeedback';
import { KillFeed } from './KillFeed';
import { LargeMap } from './LargeMap';
import type { MapImage } from './MapImage';
import type { FlagMarker, MapMarker } from './mapMarkers';
import { Minimap } from './Minimap';
import { Scoreboard } from './Scoreboard';
import { TopBar } from './TopBar';
import './hud.css';

/** What the match HUD shows besides the player's own readout. */
export interface MatchView {
  match: ConquestMatch;
  team: TeamId;
  /** The zone the player stands in while alive. */
  zone: CaptureZone | null;
  player: { x: number; z: number; yaw: number };
  markers: readonly MapMarker[];
  /** Seconds left in the enemy HQ, or null. */
  hqWarning: number | null;
  showScoreboard: boolean;
  showLargeMap: boolean;
}

/**
 * The match HUD (plan section 11.1): tickets, timer and flag strip (top center), minimap (top
 * left), weapon and ammo (bottom right), health (bottom left), crosshair, hit marker and damage
 * indicator (center), kill feed (right), capture banner, warnings; Tab scoreboard and M map.
 */
export class MatchHud implements PlayerHud {
  readonly element: HTMLElement;
  private readonly feedback = new CombatFeedback();
  private readonly topBar: TopBar;
  private readonly capture = new CaptureBanner();
  private readonly killFeed = new KillFeed();
  private readonly minimap: Minimap;
  private readonly largeMap: LargeMap;
  private readonly scoreboard = new Scoreboard();
  private readonly weaponName = el('div', { class: 'wp-name' });
  private readonly ammo = el('div', { class: 'wp-ammo' });
  private readonly fireMode = el('div', { class: 'wp-mode' });
  private readonly weaponPanel: HTMLElement;
  private readonly lockHint = el('div', { class: 'lock-hint', text: 'Click to play' });
  /** Short notices such as "Resupplied", and how long the current one has left. */
  private readonly notice = el('div', { class: 'hud-notice' });
  private noticeTime = 0;
  private boundsSeconds: number | null = null;
  private hqSeconds: number | null = null;
  private scoreboardClock = 0;

  constructor(match: ConquestMatch, image: MapImage) {
    this.topBar = new TopBar(match);
    this.minimap = new Minimap(image);
    this.largeMap = new LargeMap(image);
    this.weaponPanel = el('div', { class: 'weapon-panel' }, [this.weaponName, this.ammo, this.fireMode]);
    this.largeMap.element.hidden = true;
    this.scoreboard.element.hidden = true;
    // Under everything else in the HUD: only the 3D view gets the vignette.
    const vignette = el('div', { class: 'vignette' });
    vignette.style.setProperty('--vignette-strength', String(HUD.vignette.strength));
    vignette.style.setProperty('--vignette-start', `${HUD.vignette.start * 100}%`);
    this.element = el('div', { class: 'match-hud' }, [
      vignette,
      ...this.feedback.parts,
      this.topBar.element,
      this.minimap.element,
      this.weaponPanel,
      this.killFeed.element,
      this.capture.element,
      this.largeMap.element,
      this.scoreboard.element,
      this.lockHint,
      this.notice,
    ]);
    this.notice.hidden = true;
  }

  addKill(k: KillFeedEntry): void {
    this.killFeed.add(k);
  }

  hitFlash(): void {
    this.feedback.hitFlash();
  }

  showHitMarker(kill: boolean): void {
    this.feedback.showHitMarker(kill);
  }

  showDamageFrom(angle: number): void {
    this.feedback.showDamageFrom(angle);
  }

  setBoundsWarning(seconds: number | null): void {
    this.boundsSeconds = seconds;
  }

  /** Per-frame player readout (called by the play session). */
  update(dt: number, r: PlayerReadout, dead: boolean, locked: boolean): void {
    this.feedback.update(dt, r, dead);
    this.weaponName.textContent = r.weapon;
    this.ammo.textContent = `${r.mag} / ${r.reserve}`;
    this.fireMode.textContent = r.fireMode.toUpperCase();
    this.weaponPanel.hidden = dead;
    this.minimap.element.hidden = dead;
    this.feedback.healthBar.hidden = dead;
    this.lockHint.hidden = locked || dead;
    this.killFeed.update(dt);
  }

  /** Per-frame match state (called by the Conquest session). */
  /** Shows `text` under the crosshair for `seconds`. */
  showNotice(text: string, seconds: number): void {
    this.notice.textContent = text;
    this.notice.hidden = false;
    this.noticeTime = seconds;
  }

  updateMatch(dt: number, v: MatchView): void {
    if (this.noticeTime > 0 && (this.noticeTime -= dt) <= 0) this.notice.hidden = true;
    this.topBar.update(v.match);
    this.capture.update(v.zone, v.team);
    this.hqSeconds = v.hqWarning;
    this.feedback.setWarning(
      this.hqSeconds !== null
        ? `Leave the enemy HQ: ${Math.ceil(this.hqSeconds)}`
        : this.boundsSeconds !== null
          ? `Return to the battlefield: ${Math.ceil(this.boundsSeconds)}`
          : null,
    );
    const flags: FlagMarker[] = v.match.zones.map((z) => ({ id: z.flag.id, x: z.flag.x, z: z.flag.z, owner: z.owner }));
    this.minimap.draw(v.player.x, v.player.z, v.player.yaw, flags, v.markers);
    this.largeMap.element.hidden = !v.showLargeMap;
    if (v.showLargeMap) this.largeMap.draw(flags, v.markers, v.player);
    this.scoreboard.element.hidden = !v.showScoreboard;
    // The kill feed would show through the scoreboard and large map panels.
    this.killFeed.element.hidden = v.showScoreboard || v.showLargeMap;
    // The scoreboard is DOM work: refresh it a few times a second while open.
    if (v.showScoreboard && (this.scoreboardClock -= dt) <= 0) {
      this.scoreboardClock = 0.25;
      this.scoreboard.render(v.match);
    } else if (!v.showScoreboard) {
      this.scoreboardClock = 0;
    }
  }
}
