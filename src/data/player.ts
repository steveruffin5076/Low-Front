/** Player profile rules (plan section 5.2). */
export const PROFILE = {
  nameMinLength: 3,
  nameMaxLength: 16,
  defaultName: 'Player',
  teamLabel: 'Blue Team',
  storageKey: 'lowfront.profile.v1',
} as const;
