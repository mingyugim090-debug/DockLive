import { getThemePreset, THEME_STORAGE_KEY } from '@/data/themePresets';

export function applyTheme(themeId: string) {
  if (typeof document === 'undefined') return;
  const theme = getThemePreset(themeId);
  Object.entries(theme.vars).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
  document.documentElement.dataset.dockTheme = theme.id;
}

export function saveTheme(themeId: string) {
  applyTheme(themeId);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
  }
}

export function loadSavedTheme() {
  if (typeof window === 'undefined') return;
  applyTheme(window.localStorage.getItem(THEME_STORAGE_KEY) ?? 'calm');
}
