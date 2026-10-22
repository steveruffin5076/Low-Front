/** Key bindings (KeyboardEvent.code) from plan section 9. */
export const CONTROLS = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  sprint: 'ShiftLeft',
  crouch: 'KeyC',
  jump: 'Space',
  leanLeft: 'KeyQ',
  leanRight: 'KeyE',
  reload: 'KeyR',
  primary: 'Digit1',
  secondary: 'Digit2',
  fireMode: 'KeyB',
  inspect: 'KeyI',
  /** Hold to show. */
  scoreboard: 'Tab',
  largeMap: 'KeyM',
  /** Debug keys for the test range until damage exists (Phase 4). */
  debugHit: 'KeyH',
  debugDeath: 'KeyK',
  navDebug: 'F4',
} as const;

export const MOUSE = { fire: 0, ads: 2 } as const;
