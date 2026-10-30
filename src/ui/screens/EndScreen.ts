import type { State } from '../../core/StateMachine';
import type { GameContext } from '../../core/GameContext';
import type { TeamId } from '../../data/map/types';
import type { CombatantStats } from '../../game/Scoring';
import { button, el } from '../dom';
import '../match/match.css';

const RESULT_TEXT = { blue: 'BLUE WINS', red: 'RED WINS', draw: 'DRAW' } as const;
const REASON_TEXT = { tickets: 'Out of tickets', time: 'Time limit reached' } as const;

/** Victory or defeat from the player's side. */
function outcome(winner: TeamId | null, team: TeamId): string {
  const side = team === 'blue' ? 'Blue' : 'Red';
  if (winner === null) return `You fought for ${side}`;
  return `${winner === team ? 'Victory' : 'Defeat'}: you fought for ${side}`;
}

/**
 * End Screen (plan section 11.5): the result, final tickets, the top 3 per team and the
 * player's own stats. The profile was updated when the match ended.
 */
export class EndScreen implements State {
  private root: HTMLElement | null = null;

  constructor(private readonly ctx: GameContext) {}

  enter(): void {
    const s = this.ctx.lastMatch;
    if (!s) {
      this.ctx.changeScreen('mainMenu');
      return;
    }
    const result = s.result.winner ?? 'draw';
    const top = (team: TeamId): HTMLElement =>
      el('div', { class: `es-team es-${team}` }, [
        el('div', { class: 'es-team-head' }, [
          el('span', { text: team === 'blue' ? 'Blue Team' : 'Red Team' }),
          el('span', { class: 'es-tickets', text: `${s.tickets[team]} tickets` }),
        ]),
        el(
          'ol',
          { class: 'es-top' },
          s.top[team].length
            ? s.top[team].map((r: CombatantStats) => el('li', { class: r.isPlayer ? 'es-me' : '' }, [el('span', { text: r.name }), el('span', { text: `${r.score}` })]))
            : [el('li', { class: 'es-none', text: 'No soldiers' })],
        ),
      ]);
    const p = s.player;
    const stat = (label: string, value: number): HTMLElement =>
      el('div', { class: 'es-stat' }, [el('span', { class: 'es-stat-value', text: String(value) }), el('span', { class: 'es-stat-label', text: label })]);
    this.root = el('div', { class: 'screen end-screen' }, [
      el('div', { class: 'end-panel' }, [
        el('h1', { class: `es-result es-result-${result}`, text: RESULT_TEXT[result] }),
        el('p', { class: `es-outcome es-${p.team}`, text: outcome(s.result.winner, p.team) }),
        el('p', { class: 'es-reason', text: REASON_TEXT[s.result.reason] }),
        el('div', { class: 'es-teams' }, [top('blue'), top('red')]),
        el('h2', { class: 'es-subtitle', text: 'Your match' }),
        el('div', { class: 'es-stats' }, [
          stat('Score', p.score),
          stat('Kills', p.kills),
          stat('Deaths', p.deaths),
          stat('Headshots', p.headshots),
          stat('Captures', p.captures),
        ]),
        button('Main Menu', () => this.ctx.changeScreen('mainMenu'), 'btn btn-primary es-menu'),
      ]),
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
}
