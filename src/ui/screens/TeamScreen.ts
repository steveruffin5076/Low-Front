import type { GameContext } from '../../core/GameContext';
import type { State } from '../../core/StateMachine';
import type { TeamId } from '../../data/map/types';
import { button, el } from '../dom';

const TEAM_NAME: Record<TeamId, string> = { blue: 'Blue', red: 'Red' };

/**
 * "Join a team" (after the Match setup, before the profile and loadout): Blue or Red. The player takes the place of one
 * bot on that side; the choice is saved and offered first next time.
 */
export class TeamScreen implements State {
  private root: HTMLElement | null = null;

  constructor(private readonly ctx: GameContext) {}

  enter(): void {
    const profile = this.ctx.profiles.load();
    const last = profile.team;
    const size = profile.setup.teamSize;
    const card = (team: TeamId): HTMLElement =>
      el('div', { class: `team-card team-${team}${team === last ? ' team-last' : ''}` }, [
        el('h2', { class: 'team-name', text: `${TEAM_NAME[team]} Team` }),
        el('p', { class: 'team-count', text: `${size} soldiers` }),
        el('p', { class: 'team-note', text: `You + ${size - 1} bots` }),
        team === last ? el('p', { class: 'team-tag', text: 'Last played' }) : null,
        button(`Join ${TEAM_NAME[team]}`, () => this.join(team), `btn btn-primary team-join team-join-${team}`),
      ]);
    this.root = el('div', { class: 'screen team-screen' }, [
      el('h1', { class: 'team-title', text: 'Join a team' }),
      el('div', { class: 'team-cards' }, [card('blue'), card('red')]),
      el('div', { class: 'bottom-bar' }, [button('Back', () => this.ctx.changeScreen('setup'))]),
    ]);
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

  private join(team: TeamId): void {
    const profile = this.ctx.profiles.load();
    profile.team = team;
    this.ctx.profiles.save(profile);
    this.ctx.changeScreen('profile');
  }
}
