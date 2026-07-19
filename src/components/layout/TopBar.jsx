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
      






































      
    </header>);

}