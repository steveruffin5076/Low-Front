import { Game } from './core/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;

const debug = new URLSearchParams(window.location.search).get('debug');
if (debug === 'weapons') {
  void import('./debug/WeaponViewer').then(({ WeaponViewer }) => new WeaponViewer(canvas, ui).start());
} else if (debug === 'soldier') {
  void import('./debug/SoldierViewer').then(({ SoldierViewer }) => new SoldierViewer(canvas, ui).start());
} else if (debug === 'map') {
  void import('./debug/MapViewer').then(({ MapViewer }) => new MapViewer(canvas, ui).start());
} else {
  const game = new Game(canvas, ui);
  // Dev only: expose the game for automated checks.
  if (debug !== null) (window as unknown as { __game: Game }).__game = game;
  game.start();
}
