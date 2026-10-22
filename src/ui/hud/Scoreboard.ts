import type { TeamId } from '../../data/map/types';
import type { ConquestMatch } from '../../game/ConquestMatch';
import { ranked } from '../../game/Scoring';
import { el } from '../dom';

const TEAM_NAME: Record<TeamId, string> = { blue: 'Blue', red: 'Red' };

/** Scoreboard (hold Tab, plan section 11.2): one column per team; the player's row stands out. */
export class Scoreboard {
  readonly element = el('div', { class: 'scoreboard' });

  render(match: ConquestMatch): void {
    const column = (team: TeamId): HTMLElement => {
      const rows = ranked(match.rows(team));
      return el('div', { class: `sb-team sb-${team}` }, [
        el('div', { class: 'sb-head' }, [
          el('span', { class: 'sb-title', text: `${TEAM_NAME[team]} Team` }),
          el('span', { class: 'sb-tickets', text: `${match.tickets.count[team]} tickets` }),
        ]),
        el('table', { class: 'sb-table' }, [
          el('thead', {}, [el('tr', {}, ['Name', 'Score', 'Kills', 'Deaths'].map((h) => el('th', { text: h })))]),
          el(
            'tbody',
            {},
            rows.length
              ? rows.map((r) =>
                  el('tr', { class: r.isPlayer ? 'sb-player' : '' }, [
                    el('td', { text: r.name }),
                    el('td', { text: String(r.score) }),
                    el('td', { text: String(r.kills) }),
                    el('td', { text: String(r.deaths) }),
                  ]),
                )
              : [el('tr', {}, [el('td', { class: 'sb-empty', text: 'No soldiers yet (bots arrive in Phase 8)', attrs: { colspan: '4' } })])],
          ),
        ]),
      ]);
    };
    this.element.replaceChildren(column('blue'), column('red'));
  }
}
