/** What the session shows about the player each frame. */
export interface PlayerReadout {
  weapon: string;
  mag: number;
  reserve: number;
  fireMode: string;
  action: string;
  stance: string;
  speed: number;
  stamina: number;
  ads: number;
  hp: number;
  maxHp: number;
  /** Spread cone in degrees and the camera FOV, to size the crosshair. */
  spreadDeg: number;
  fov: number;
  lastHit: string;
}

/** The player's on-screen feedback: the test range overlay or the match HUD. */
export interface PlayerHud {
  readonly element: HTMLElement;
  hitFlash(): void;
  showHitMarker(kill: boolean): void;
  showDamageFrom(angle: number): void;
  /** Out-of-bounds countdown in seconds, or null to hide it. */
  setBoundsWarning(seconds: number | null): void;
  update(dt: number, r: PlayerReadout, dead: boolean, locked: boolean): void;
}
