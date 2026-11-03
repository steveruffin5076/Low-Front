import type { GameContext } from '../../core/GameContext';
import type { State } from '../../core/StateMachine';
import { MAPS } from '../../data/map/maps';
import {
  SETUP_DIFFICULTIES,
  SETUP_MAPS,
  SETUP_TEAM_SIZES,
  SETUP_TIME_LIMITS,
  matchRules,
  type MapId,
  type MatchSetup,
} from '../../data/matchSetup';
import { MapImage } from '../hud/MapImage';
import { button, el } from '../dom';

/**
 * Match setup (Play vs Bots, before the team choice): the map and the match settings — bot skill,
 * team size and time limit. Choices are saved in the profile and offered again next time.
 */
export class MatchSetupScreen implements State {
  private root: HTMLElement | null = null;
  private setup!: MatchSetup;
  private readonly body = el('div', { class: 'setup-body' });

  constructor(private readonly ctx: GameContext) {}

  enter(): void {
    this.setup = { ...this.ctx.profiles.load().setup };
    this.root = el('div', { class: 'screen setup-screen' }, [
      el('h1', { class: 'team-title', text: 'Match setup' }),
      this.body,
      el('div', { class: 'bottom-bar' }, [
        button('Back', () => this.ctx.changeScreen('mainMenu')),
        button('Start', () => this.start(), 'btn btn-primary'),
      ]),
    ]);
    this.refresh();
    this.ctx.ui.append(this.root);
  }

  exit(): void {
    this.root?.remove();
    this.root = null;
  }

  update(dt: number): void {
    this.ctx.backdrop.update(dt);
  }

  render(): void {
    this.ctx.renderer.render(this.ctx.backdrop.scene, this.ctx.backdrop.camera);
  }

  private change(patch: Partial<MatchSetup>): void {
    this.setup = { ...this.setup, ...patch };
    const profile = this.ctx.profiles.load();
    profile.setup = this.setup;
    this.ctx.profiles.save(profile);
    this.refresh();
  }

  private start(): void {
    this.change({});
    this.ctx.changeScreen('team');
  }

  private refresh(): void {
    const s = this.setup;
    const choice = <T>(label: string, options: { value: T; name: string; hint?: string }[], current: T, pick: (v: T) => void): HTMLElement =>
      el('div', { class: 'setup-row' }, [
        el('div', { class: 'setup-label', text: label }),
        el(
          'div',
          { class: 'setup-choices' },
          options.map((o) =>
            el(
              'button',
              {
                class: `setup-choice${o.value === current ? ' selected' : ''}`,
                attrs: { type: 'button', 'aria-pressed': String(o.value === current) },
                on: { click: () => pick(o.value) },
              },
              [el('span', { class: 'setup-choice-name', text: o.name }), o.hint ? el('span', { class: 'setup-choice-hint', text: o.hint }) : null],
            ),
          ),
        ),
      ]);
    const maps = (Object.keys(SETUP_MAPS) as MapId[]).map((id) => {
      const m = SETUP_MAPS[id];
      const preview = new MapImage(MAPS[id]).canvas;
      preview.className = 'setup-map-image';
      return el(
        'button',
        { class: `setup-map${id === s.map ? ' selected' : ''}`, attrs: { type: 'button' }, on: { click: () => this.change({ map: id }) } },
        [preview, el('div', { class: 'setup-map-name', text: m.name }), el('div', { class: 'setup-map-blurb', text: m.blurb })],
      );
    });
    const rules = matchRules(s);
    this.body.replaceChildren(
      el('div', { class: 'panel setup-maps' }, [el('h2', { class: 'panel-title', text: 'Map' }), ...maps]),
      el('div', { class: 'panel setup-settings' }, [
        el('h2', { class: 'panel-title', text: 'Settings' }),
        choice('Mode', [{ value: 'conquest', name: 'Conquest', hint: 'Hold the flags, drain the enemy tickets' }], 'conquest', () => undefined),
        choice('Bot skill', SETUP_DIFFICULTIES.map((d) => ({ value: d.id, name: d.name, hint: d.blurb })), s.difficulty, (difficulty) => this.change({ difficulty })),
        choice('Team size', SETUP_TEAM_SIZES.map((t) => ({ value: t.size, name: t.name, hint: `${t.tickets} tickets` })), s.teamSize, (teamSize) => this.change({ teamSize })),
        choice('Time limit', SETUP_TIME_LIMITS.map((m) => ({ value: m as number, name: `${m} min` })), s.timeLimit, (timeLimit) => this.change({ timeLimit })),
        el('p', { class: 'setup-summary', text: `${s.teamSize} vs ${s.teamSize} (you + ${s.teamSize - 1} bots on your side) · ${rules.tickets} tickets each · ${s.timeLimit} minutes` }),
      ]),
    );
  }
}
