import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Menu, Search, Bell, MessageCircle } from 'lucide-react';
import ThemeToggle from '@/components/kp/ThemeToggle';

export default function TopBar({ onMenuClick }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const initials = user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <header className="kp-panel sticky top-0 z-30 m-2 sm:m-3 rounded-2xl">
      <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onMenuClick} className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-[hsl(var(--kp-teal))] hover:bg-[hsl(var(--accent))] transition-colors shrink-0" aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </button>
          <div className="text-sm font-bold text-[hsl(var(--kp-teal))] truncate hidden sm:block">
            {user?.full_name ? `Welcome, ${user.full_name}` : 'KeepPeer School'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button className="w-9 h-9 rounded-lg flex items-center justify-center text-[hsl(var(--kp-teal))] hover:bg-[hsl(var(--accent))] transition-colors" aria-label="Notifications">
            <Bell className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-full bg-[hsl(var(--kp-teal))] flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}