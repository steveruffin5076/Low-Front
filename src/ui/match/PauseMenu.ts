import { SETTINGS } from '../../data/settings';
import type { Settings } from '../../save/SettingsStore';
import { showConfirm } from '../ConfirmDialog';
import { button, el } from '../dom';
import './match.css';

/**
 * Pause Menu (Esc, plan section 11.4): Resume, mouse sensitivity, field of view, master volume,
 * Quit to Main Menu (with confirm). Changes apply live and are saved by `onChange`.
 */
export class PauseMenu {
  readonly element: HTMLElement;

  constructor(
    settings: Settings,
    onChange: (s: Settings) => void,
    onResume: () => void,
    onQuit: () => void,
  ) {
    const current = { ...settings };
    const slider = (label: string, key: keyof Settings, format: (v: number) => string): HTMLElement => {
      const range = SETTINGS[key];
      const value = el('span', { class: 'pm-value', text: format(current[key]) });
      const input = el('input', {
        attrs: { type: 'range', min: String(range.min), max: String(range.max), step: String(range.step), value: String(current[key]), id: `pm-${key}` },
      });
      input.addEventListener('input', () => {
        current[key] = Number(input.value);
        value.textContent = format(current[key]);
        onChange({ ...current });
      });
      return el('label', { class: 'pm-row', attrs: { for: `pm-${key}` } }, [el('span', { class: 'pm-label', text: label }), input, value]);
    };
    const panel = el('div', { class: 'pause-panel', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Paused' } }, [
      el('h2', { class: 'pm-title', text: 'Paused' }),
      button('Resume', onResume, 'btn btn-primary pm-resume'),
      slider('Mouse sensitivity', 'sensitivity', (v) => `${v.toFixed(2)}×`),
      slider('Field of view', 'fov', (v) => `${Math.round(v)}°`),
      slider('Master volume', 'volume', (v) => `${Math.round(v * 100)}%`),
      button('Quit to Main Menu', () => showConfirm(this.element, 'Quit the match?', onQuit), 'btn pm-quit'),
    ]);
    this.element = el('div', { class: 'pause-menu' }, [panel]);
  }
}
