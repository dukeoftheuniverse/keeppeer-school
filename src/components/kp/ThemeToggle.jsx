import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { dark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle dark mode"
      className={`w-9 h-9 rounded-full bg-white/70 hover:bg-white text-[hsl(var(--kp-teal))] dark:bg-white/10 dark:text-[#8EE5F0] dark:hover:bg-white/20 flex items-center justify-center transition-colors ${className}`}
    >
      {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}