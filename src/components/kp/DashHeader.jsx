import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Clock, Settings, LogOut, RefreshCw } from 'lucide-react';

export default function DashHeader({ greeting, name }) {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [school, setSchool] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    base44.entities.School.list().then(r => setSchool(r[0])).catch(() => {});
  }, []);

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const switchRole = () => { sessionStorage.removeItem('kp_selected_role'); window.location.href = '/'; };
  const logout = async () => { await base44.auth.logout('/login'); };

  return (
    <header className="bg-[#E0F7FA] border-b border-[#B2EBF2] sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-full bg-[hsl(var(--kp-teal))] flex items-center justify-center text-white font-bold text-lg shrink-0 overflow-hidden shadow">
            {school?.logo_url ? <img src={school.logo_url} className="w-full h-full object-cover" alt="logo" /> : 'K'}
          </div>
          <div className="min-w-0">
            <div className="text-[hsl(var(--kp-teal))] font-bold text-sm sm:text-base leading-tight">School Keeppeer</div>
            <div className="text-[11px] sm:text-xs text-[#004D40] truncate leading-tight">{school?.school_name || 'Labangal Elementary School'}</div>
            <div className="text-[10px] text-[#546E7A] leading-tight">School Year {school?.academic_year || '2026-2027'}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold text-[#004D40] leading-tight">{greeting}, {name || user?.full_name || 'User'}</div>
            <div className="text-[11px] text-[#546E7A] flex items-center gap-1.5 justify-end">
              <Clock className="w-3 h-3" /> {timeStr}, {dateStr}
            </div>
          </div>
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="w-9 h-9 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-[#004D40] transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 overflow-hidden">
                  <button onClick={switchRole} className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Switch Role</button>
                  <button onClick={logout} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><LogOut className="w-4 h-4" /> Log out</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}