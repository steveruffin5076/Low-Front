import { button, el } from './dom';

/** Modal "Are you sure?" dialog. Removes itself after Yes or No. */
export function showConfirm(parent: HTMLElement, message: string, onYes: () => void, onNo: () => void = () => {}): void {
  const close = (fn: () => void) => () => {
    overlay.remove();
    fn();
  };
  const overlay = el('div', { class: 'modal-overlay' }, [
    el('div', { class: 'modal', attrs: { role: 'dialog', 'aria-modal': 'true' } }, [
      el('p', { class: 'modal-text', text: message }),
      el('div', { class: 'modal-buttons' }, [
        button('Yes', close(onYes), 'btn btn-primary'),
        button('No', close(onNo), 'btn'),
      ]),
    ]),
  ]);
  parent.append(overlay);
}
