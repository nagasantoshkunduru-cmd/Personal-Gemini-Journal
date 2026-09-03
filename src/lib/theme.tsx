import React, { createContext, useContext, useEffect, useLayoutEffect, useState, useCallback } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'gemini_journal_theme';

/**
 * Safe local storage reader that catches browser DOMExceptions
 * in sandboxed iframes, partitioned storage, or private browsing modes.
 * Enforces strict 'dark' | 'light' validation.
 */
function safeGetStorage(key: string): Theme | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = localStorage.getItem(key);
      if (val === 'dark' || val === 'light') {
        return val;
      }
    }
  } catch (e) {
    console.warn('[Theme] LocalStorage read not permitted by browser sandbox:', e);
  }
  return null;
}

/**
 * Safe local storage writer that catches browser quota or sandbox exceptions.
 */
function safeSetStorage(key: string, value: Theme): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Only set if changed to avoid unnecessary storage emissions
      const current = localStorage.getItem(key);
      if (current !== value) {
        localStorage.setItem(key, value);
      }
    }
  } catch (e) {
    console.warn('[Theme] LocalStorage write not permitted by browser sandbox:', e);
  }
}

/**
 * Synchronously mutates DOM attributes, class lists, and colorScheme.
 */
export function applyThemeToDOM(theme: Theme): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const body = document.body;

  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  root.classList.remove('dark', 'light');
  root.classList.add(theme);

  if (body) {
    body.setAttribute('data-theme', theme);
    body.classList.remove('dark', 'light');
    body.classList.add(theme);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // 1. Check saved local storage preference safely
    const saved = safeGetStorage(THEME_STORAGE_KEY);
    if (saved) {
      // Immediately apply to DOM during initial evaluation
      applyThemeToDOM(saved);
      return saved;
    }
    // 2. Check system preference
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      applyThemeToDOM('light');
      return 'light';
    }
    applyThemeToDOM('dark');
    return 'dark';
  });

  // Guarantee synchronous synchronization before paint
  useLayoutEffect(() => {
    applyThemeToDOM(theme);
    safeSetStorage(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Listen for storage events from other browser tabs or windows without loops
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        const nextTheme = e.newValue as Theme;
        setThemeState((prev) => {
          // If state is already matching, bail out immediately to prevent re-renders
          if (prev === nextTheme) return prev;
          applyThemeToDOM(nextTheme);
          return nextTheme;
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Synchronous toggle handler: Mutates DOM instantly during click event before paint
  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      // Synchronous DOM mutation for zero-flicker instant transition
      applyThemeToDOM(next);
      safeSetStorage(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  // Synchronous set handler: Mutates DOM instantly
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState((prev) => {
      if (prev === newTheme) return prev;
      applyThemeToDOM(newTheme);
      safeSetStorage(THEME_STORAGE_KEY, newTheme);
      return newTheme;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

