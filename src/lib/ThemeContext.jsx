import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({ dark: false, toggle: () => {} });
const KEY = 'kp-theme';

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem(KEY);
    if (saved) return saved === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem(KEY, dark ? 'dark' : 'light');
  }, [dark]);

  const toggle = () => setDark((d) => !d);
  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);