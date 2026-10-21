import { PROFILE } from '../../data/player';
import { kdRatio, validateName, type PlayerStats } from '../../save/ProfileStore';
import { el } from '../dom';

/** Left panel: editable player name, team, local stats. */
export class ProfilePanel {
  readonly element: HTMLElement;

  constructor(name: string, stats: PlayerStats, onName: (name: string | null) => void) {
    const error = el('p', { class: 'field-error', attrs: { 'aria-live': 'polite' } });
    const input = el('input', {
      class: 'name-input',
      attrs: {
        type: 'text',
        id: 'player-name',
        maxlength: String(PROFILE.nameMaxLength),
        autocomplete: 'off',
        spellcheck: 'false',
      },
    });
    input.value = name;
    input.addEventListener('input', () => {
      const check = validateName(input.value);
      error.textContent = check.ok ? '' : check.error;
      input.classList.toggle('invalid', !check.ok);
      onName(check.ok ? check.value : null);
    });
    // Keep keys typed into the field away from game shortcuts such as F3.
    input.addEventListener('keydown', (e) => e.stopPropagation());

    const rows: [string, string][] = [
      ['Matches played', String(stats.matchesPlayed)],
      ['Wins', String(stats.wins)],
      ['Losses', String(stats.losses)],
      ['Kills', String(stats.kills)],
      ['Deaths', String(stats.deaths)],
      ['K/D ratio', kdRatio(stats).toFixed(2)],
      ['Headshots', String(stats.headshots)],
    ];

    this.element = el('div', { class: 'panel profile-panel' }, [
      el('h2', { class: 'panel-title', text: 'Player Profile' }),
      el('label', { class: 'field-label', text: 'Player name', attrs: { for: 'player-name' } }),
      input,
      el('p', { class: 'field-hint', text: `${PROFILE.nameMinLength}–${PROFILE.nameMaxLength} characters` }),
      error,
      el('div', { class: 'team-row' }, [el('span', { class: 'team-chip' }), el('span', { text: PROFILE.teamLabel })]),
      el('h3', { class: 'panel-subtitle', text: 'Stats' }),
      el(
        'dl',
        { class: 'stats-list' },
        rows.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]),
      ),
    ]);
  }
}
