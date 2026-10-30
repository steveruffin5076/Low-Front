import type { GameContext } from '../../core/GameContext';
import type { State } from '../../core/StateMachine';
import { BOTS } from '../../data/bots';
import type { TeamId } from '../../data/map/types';
import { button, el } from '../dom';

const TEAM_NAME: Record<TeamId, string> = { blue: 'Blue', red: 'Red' };
/** Soldiers per side in a match (the player takes one bot's place). */
const SIDE_SIZE = BOTS.playerSide + 1;

/**
 * "Join a team" (after Deploy on the profile screen): Blue or Red. The player takes the place of one
 * bot on that side; the choice is saved and offered first next time.
 */
export class TeamScreen implements State {
  private root: HTMLElement | null = null;

  constructor(private readonly ctx: GameContext) {}

  enter(): void {
    const last = this.ctx.profiles.load().team;
    const card = (team: TeamId): HTMLElement =>
      el('div', { class: `team-card team-${team}${team === last ? ' team-last' : ''}` }, [
        el('h2', { class: 'team-name', text: `${TEAM_NAME[team]} Team` }),
        el('p', { class: 'team-count', text: `${SIDE_SIZE} soldiers` }),
        el('p', { class: 'team-note', text: `You + ${SIDE_SIZE - 1} bots` }),
        team === last ? el('p', { class: 'team-tag', text: 'Last played' }) : null,
        button(`Join ${TEAM_NAME[team]}`, () => this.join(team), `btn btn-primary team-join team-join-${team}`),
      ]);
    this.root = el('div', { class: 'screen team-screen' }, [
      el('h1', { class: 'team-title', text: 'Join a team' }),
      el('div', { class: 'team-cards' }, [card('blue'), card('red')]),
      el('div', { class: 'bottom-bar' }, [button('Back', () => this.ctx.changeScreen('profile'))]),
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
    this.ctx.changeScreen('loading');
  }
}
