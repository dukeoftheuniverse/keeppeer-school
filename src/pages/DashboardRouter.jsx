import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import Dashboard from '@/pages/Dashboard';
import TeacherDashboard from '@/pages/TeacherDashboard';
import ParentDashboard from '@/pages/ParentDashboard';

// Routes the "/" path to the right dashboard based on the logged-in user's role.
export default function DashboardRouter() {
  const { user, isLoadingAuth } = useAuth();
  const [role, setRole] = useState(null); // admin | teacher | parent
  const [checking, setChecking] = useState(true);

  const detect = useCallback(async () => {
    if (!user) { setChecking(false); return; }
    // Admins (platform role) get the full admin dashboard
    if (user.role === 'admin') { setRole('admin'); setChecking(false); return; }
    try {
      // Is this user a teacher/employee?
      const employees = await base44.entities.Employee.list().catch(() => []);
      const me = employees.find(e => e.email === user.email || e.user_id === user.id);
      if (me && (me.access_level === 'teacher' || me.access_level === 'staff' || me.access_level === 'admin')) {
        setRole('teacher'); setChecking(false); return;
      }
      // Is this user a parent? (email matches a student's parent_email)
      const students = await base44.entities.Student.list().catch(() => []);
      const isParent = students.some(s => s.parent_email && s.parent_email.toLowerCase() === user.email?.toLowerCase());
      if (isParent) { setRole('parent'); setChecking(false); return; }
      // Fallback: admin dashboard for any other authenticated user
      setRole('admin');
    } catch (e) {
      setRole('admin');
    } finally {
      setChecking(false);
    }
  }, [user]);

  useEffect(() => { detect(); }, [detect]);

  if (isLoadingAuth || checking) {
    return <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }
  if (role === 'teacher') return <TeacherDashboard />;
  if (role === 'parent') return <ParentDashboard />;
  return <Dashboard />;
}