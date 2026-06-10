export type Theme = 'light' | 'dark';

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return (document.documentElement.dataset.theme as Theme) || 'light';
}

export function setTheme(theme: Theme) {
  if (typeof window === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('xp-theme', theme);
  window.dispatchEvent(new CustomEvent('xp-theme-change', { detail: theme }));
}

export function toggleTheme() {
  const current = getTheme();
  setTheme(current === 'light' ? 'dark' : 'light');
}
