import { Game } from './core/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;

const hint = document.createElement('div');
hint.className = 'hint';
hint.textContent = 'Phase 0 test scene — press F3 for the debug overlay';
ui.appendChild(hint);

const game = new Game(canvas, ui);
game.start().catch((err: unknown) => {
  console.error('Failed to start game', err);
});
