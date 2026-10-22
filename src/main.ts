import { Game } from './core/Game';
import { debugFlag, debugMode } from './core/debugFlags';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;

if (debugFlag('weapons')) {
  void import('./debug/WeaponViewer').then(({ WeaponViewer }) => new WeaponViewer(canvas, ui).start());
} else if (debugFlag('soldier')) {
  void import('./debug/SoldierViewer').then(({ SoldierViewer }) => new SoldierViewer(canvas, ui).start());
} else if (debugFlag('map')) {
  void import('./debug/MapViewer').then(({ MapViewer }) => new MapViewer(canvas, ui).start());
} else {
  const game = new Game(canvas, ui);
  // Dev only: expose the game for automated checks.
  if (debugMode()) (window as unknown as { __game: Game }).__game = game;
  game.start();
}
