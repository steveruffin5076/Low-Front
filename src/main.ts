import { Game } from './core/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;

if (new URLSearchParams(window.location.search).get('debug') === 'weapons') {
  void import('./debug/WeaponViewer').then(({ WeaponViewer }) => new WeaponViewer(canvas, ui).start());
} else {
  new Game(canvas, ui).start();
}
