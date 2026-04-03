export const THEME_IDS = ['ocean', 'light', 'midnight', 'slate'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = 'ocean';

export const THEME_STORAGE_KEY = 'finwise-theme';

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value);
}

/** Hex for `<meta name="theme-color">` and PWA chrome UI */
export function getThemeMetaColor(theme: ThemeId): string {
  const map: Record<ThemeId, string> = {
    ocean: '#0b1220',
    light: '#f4f6f8',
    midnight: '#000000',
    slate: '#0f0f12',
  };
  return map[theme];
}

export const THEME_LABELS: Record<ThemeId, string> = {
  ocean: 'Ocean',
  light: 'Paper',
  midnight: 'Midnight',
  slate: 'Slate',
};
