import { el } from '../dom';
import './scope.css';

/** The sniper scope view: black surround, a round lens with fine crosshairs and a mil-dot style post. */
export class ScopeOverlay {
  readonly element = el('div', { class: 'scope-overlay' }, [
    el('div', { class: 'scope-lens' }, [el('div', { class: 'scope-h' }), el('div', { class: 'scope-v' }), el('div', { class: 'scope-dot' })]),
  ]);

  set visible(v: boolean) {
    this.element.classList.toggle('shown', v);
  }
}
