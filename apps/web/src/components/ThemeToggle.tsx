'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export type Theme = 'light' | 'dark';
export const THEME_KEY = 'codeatlas.theme';

// "light" = day mode (bright moonlight), "dark" = night mode (dim moonlight).
// Only the moon changes; the interface itself always stays dark.
export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.moon === 'bright' ? 'light' : 'dark';
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.moon = theme === 'light' ? 'bright' : 'dim';
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* storage blocked */ }
  window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}

// Sun / moon switch for the moonlight.
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setLocal] = useState<Theme>('dark');

  useEffect(() => {
    setLocal(getTheme());
    const onChange = (e: Event) => setLocal((e as CustomEvent<Theme>).detail);
    window.addEventListener('themechange', onChange);
    return () => window.removeEventListener('themechange', onChange);
  }, []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      onClick={() => setTheme(next)}
      className={`relative w-9 h-9 rounded-full flex items-center justify-center border transition-colors
        border-white/20 bg-white/10 text-amber-100 hover:bg-white/20 backdrop-blur ${className}`}
      aria-label={next === 'light' ? 'Brighter moonlight' : 'Dimmer moonlight'}
      title={next === 'light' ? 'Day mode: brighter moonlight' : 'Night mode: dimmer moonlight'}
    >
      <Sun size={17} className={`absolute transition-all duration-500 ${theme === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`} />
      <Moon size={17} className={`absolute transition-all duration-500 ${theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'}`} />
    </button>
  );
}
