import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Search, ShoppingCart, Package, Bell, MessageCircle } from 'lucide-react';

export default function TopBar({ onMenuClick }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const initials = user?.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <header className="bg-white shadow-sm border-b border-gray-100 px-3 sm:px-4 py-2.5 flex items-center gap-3 sticky top-0 z-30 hidden">
      <button onClick={onMenuClick} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100">
        <svg className="w-5 h-5 text-[hsl(var(--kp-teal))]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 hidden sm:block">
        <ArrowLeft className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
      </button>

      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students, teachers, classes..."
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/20 focus:bg-white" />
        
      </div>

      <div className="flex items-center gap-1 sm:gap-2 ml-auto">
        <button className="p-2 rounded-lg hover:bg-gray-100 relative">
          <ShoppingCart className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
        </button>
        <button className="p-2 rounded-lg hover:bg-gray-100 relative">
          <Package className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
        </button>
        <button className="p-2 rounded-lg hover:bg-gray-100 relative">
          <Bell className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">55</span>
        </button>
        <button className="p-2 rounded-lg hover:bg-gray-100 relative">
          <MessageCircle className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">5</span>
        </button>
        <button className="w-9 h-9 rounded-full bg-[hsl(var(--kp-teal))] flex items-center justify-center text-white text-sm font-semibold ml-1">
          {initials}
        </button>
      </div>
    </header>);

}