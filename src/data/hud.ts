/** Match HUD layout and colors (plan section 11.1). Sizes in CSS pixels unless noted. */
export const HUD = {
  team: { blue: '#2f7de1', red: '#e5483b', neutral: '#d9dde2' },
  /** Top-down map image: pixels per meter, and its colors. */
  map: {
    pxPerMeter: 2,
    margin: 14,
    colors: {
      outside: '#20262d',
      ground: '#4a5159',
      asphalt: '#33383e',
      sidewalk: '#6b737c',
      plaza: '#7f7768',
      grass: '#4f6b45',
      dirt: '#6f5f4a',
      gravel: '#62605a',
      concrete: '#6a6e72',
      building: '#9aa3ab',
      enterable: '#c4b79a',
      edge: 'rgba(255,255,255,0.08)',
    },
  },
  minimap: {
    size: 190,
    /** Meters from the center to the edge. */
    range: 75,
    /** Enemies show when seen within this range, re-checked this often (s). */
    enemyRange: 90,
    enemyCheck: 0.25,
  },
  largeMap: { size: 620 },
  flagMarker: { radius: 9, font: 'bold 11px system-ui, sans-serif' },
  killFeed: { time: 6, max: 5 },
} as const;
