import { Game } from './core/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;

if (new URLSearchParams(window.location.search).get('debug') === 'weapons') {
  void import('./debug/WeaponViewer').then(({ WeaponViewer }) => new WeaponViewer(canvas, ui).start());
} else {
  const game = new Game(canvas, ui);
  // Dev only: expose the game for automated checks.
  if (new URLSearchParams(window.location.search).has('debug')) (window as unknown as { __game: Game }).__game = game;
  game.start();
}
