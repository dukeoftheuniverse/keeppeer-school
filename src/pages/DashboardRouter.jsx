import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import TeacherDashboard from '@/pages/TeacherDashboard';
import ParentDashboard from '@/pages/ParentDashboard';
import RoleSelect from '@/pages/RoleSelect';

const PERM_KEY = 'kp_role_permanent';
const SESSION_KEY = 'kp_selected_role';
const ROLES = ['admin', 'teacher', 'parent'];

// Clears both the permanent and session role choice — used by "Switch Role".
export function clearRoleChoice() {
  localStorage.removeItem(PERM_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export default function DashboardRouter() {
  const { isLoadingAuth } = useAuth();
  const [role, setRole] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isLoadingAuth) return;
    const perm = localStorage.getItem(PERM_KEY);
    if (perm && ROLES.includes(perm)) { setRole(perm); setChecking(false); return; }
    const sess = sessionStorage.getItem(SESSION_KEY);
    if (sess && ROLES.includes(sess)) setRole(sess);
    setChecking(false);
  }, [isLoadingAuth]);

  const handleSelect = (chosen, remember) => {
    if (remember) {
      localStorage.setItem(PERM_KEY, chosen);
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, chosen);
    }
    setRole(chosen);
  };

  if (isLoadingAuth || checking) {
    return <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  if (!role) return <RoleSelect onSelect={handleSelect} />;

  if (role === 'teacher') return <TeacherDashboard />;
  if (role === 'parent') return <ParentDashboard />;
  return <Navigate to="/admin" replace />;
}