/**
 * Graphics quality presets (Phase 10). High is the look the game was built for; Medium and
 * Low trade sharpness and shadows for frame rate on weaker GPUs. Anti-aliasing stays on: it
 * is fixed when the WebGL context is created.
 */
export type GraphicsPreset = 'low' | 'medium' | 'high';

export interface GraphicsDef {
  label: string;
  /** Fraction of the screen's resolution the 3D view renders at (the HUD stays sharp). */
  renderScale: number;
  /** Sun shadows on, and the shadow map size in texels. */
  shadows: boolean;
  shadowMapSize: number;
}

export const GRAPHICS_PRESETS: readonly GraphicsPreset[] = ['low', 'medium', 'high'];

export const GRAPHICS: Record<GraphicsPreset, GraphicsDef> = {
  low: { label: 'Low', renderScale: 0.7, shadows: false, shadowMapSize: 1024 },
  medium: { label: 'Medium', renderScale: 0.85, shadows: true, shadowMapSize: 1024 },
  high: { label: 'High', renderScale: 1, shadows: true, shadowMapSize: 2048 },
};

export const DEFAULT_GRAPHICS: GraphicsPreset = 'high';
