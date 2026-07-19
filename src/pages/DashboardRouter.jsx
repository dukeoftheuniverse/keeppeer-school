import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Dashboard from '@/pages/Dashboard';
import TeacherDashboard from '@/pages/TeacherDashboard';
import ParentDashboard from '@/pages/ParentDashboard';
import RoleSelect from '@/pages/RoleSelect';

const STORAGE_KEY = 'kp_selected_role';

// Shows a role-selection landing screen on domain entry, then routes to the
// matching dashboard. The choice is kept for the browser session so navigation
// within the app doesn't re-prompt, but a fresh visit asks again.
export default function DashboardRouter() {
  const { user, isLoadingAuth } = useAuth();
  const [role, setRole] = useState(null); // admin | teacher | parent
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isLoadingAuth) return;
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved && ['admin', 'teacher', 'parent'].includes(saved)) {
      setRole(saved);
    }
    setChecking(false);
  }, [isLoadingAuth]);

  const handleSelect = (chosen) => {
    sessionStorage.setItem(STORAGE_KEY, chosen);
    setRole(chosen);
  };

  if (isLoadingAuth || checking) {
    return <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  // No selection yet (or explicitly cleared) → show the role picker
  if (!role) return <RoleSelect onSelect={handleSelect} />;

  if (role === 'teacher') return <TeacherDashboard />;
  if (role === 'parent') return <ParentDashboard />;
  return <Dashboard />;
}