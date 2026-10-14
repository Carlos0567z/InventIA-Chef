import { useState, useEffect } from 'react';

export function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('inventia_theme');
  if (saved === 'dark' || saved === 'light') return saved;
  // Por defecto, modo oscuro luxury, o preferencia del sistema
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('inventia_theme', theme);

    const handleThemeChange = (e) => {
      if (e.detail && (e.detail === 'dark' || e.detail === 'light')) {
        setTheme(e.detail);
      }
    };

    window.addEventListener('inventia-theme-change', handleThemeChange);
    return () => window.removeEventListener('inventia-theme-change', handleThemeChange);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('inventia_theme', next);
    window.dispatchEvent(new CustomEvent('inventia-theme-change', { detail: next }));
  };

  return { theme, toggleTheme, isDark: theme === 'dark' };
}
