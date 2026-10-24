/**
 * Dev-only URL flags: `?debug=freemouse,range` turns on each listed flag. Pages such as
 * `?debug=weapons` use the first one. Safe to call outside a browser (tests): no flags.
 */
let parsed: string[] | null = null;

function flags(): string[] {
  if (!parsed) {
    const raw = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('debug');
    parsed = raw === null ? [] : raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (raw !== null && parsed.length === 0) parsed = [''];
  }
  return parsed;
}

export function debugFlag(name: string): boolean {
  return flags().includes(name);
}

/** True when any `?debug=` is present. */
export function debugMode(): boolean {
  return flags().length > 0;
}
