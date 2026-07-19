import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Menu, Search, Bell, LogOut, RefreshCw, ChevronDown } from 'lucide-react';
import { clearRoleChoice } from '@/pages/DashboardRouter';
import ThemeToggle from '@/components/kp/ThemeToggle';

export default function TopBar({ onMenuClick }) {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const initials = user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const switchRole = () => {clearRoleChoice();window.location.href = '/';};
  const logout = async () => {await base44.auth.logout('/login');};

  return (
    <header className="sticky top-0 z-30 bg-[hsl(var(--card))] border-b border-gray-200">
      <div className="px-3 sm:px-4 lg:px-5 h-14 flex items-center gap-3 hidden">
        <button onClick={onMenuClick} className="lg:hidden w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-[hsl(var(--kp-teal))]" aria-label="Open menu">
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
        </div>

        <div className="flex-1 sm:hidden" />

        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          <ThemeToggle />
          <button className="hidden sm:flex w-9 h-9 rounded-lg hover:bg-gray-100 items-center justify-center text-gray-500 relative" aria-label="Notifications">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-[hsl(var(--kp-orange))] rounded-full" />
          </button>

          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 rounded-lg pl-1.5 pr-1.5 sm:pr-2 py-1 hover:bg-gray-100">
              <div className="w-8 h-8 rounded-full bg-[hsl(var(--kp-teal))] text-white flex items-center justify-center text-xs font-bold shrink-0">{initials}</div>
              <span className="hidden md:block text-sm font-medium text-[hsl(var(--kp-teal))] max-w-[140px] truncate">{user?.full_name || 'User'}</span>
              <ChevronDown className="hidden md:block w-4 h-4 text-gray-400" />
            </button>
            {menuOpen &&
            <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 overflow-hidden">
                  <button onClick={switchRole} className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Switch Role</button>
                  <button onClick={logout} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><LogOut className="w-4 h-4" /> Log out</button>
                </div>
              </>
            }
          </div>
        </div>
      </div>
    </header>);

}