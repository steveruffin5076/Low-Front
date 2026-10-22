import type { Input } from './Input';
import type { Renderer } from '../render/Renderer';
import type { PreviewRenderer } from '../render/PreviewRenderer';
import type { MatchSummary } from '../game/MatchSummary';
import type { ProfileStore } from '../save/ProfileStore';
import type { SettingsStore } from '../save/SettingsStore';
import type { MenuBackdrop } from '../scenes/MenuBackdrop';

export type ScreenName = 'mainMenu' | 'profile' | 'loading' | 'match' | 'end' | 'quit';

/** Shared systems handed to each screen. */
export interface GameContext {
  /** Root element for HTML screens. */
  ui: HTMLElement;
  renderer: Renderer;
  preview: PreviewRenderer;
  input: Input;
  profiles: ProfileStore;
  settings: SettingsStore;
  /** The last finished match, for the End Screen. */
  lastMatch: MatchSummary | null;
  backdrop: MenuBackdrop;
  changeScreen(screen: ScreenName): void;
}
