import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Building2, LayoutDashboard, Settings, Users, GraduationCap, Contact, ClipboardList, CreditCard, BookOpen, FileText, RefreshCw } from 'lucide-react';
import { clearRoleChoice } from '@/pages/DashboardRouter';

const navItems = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { label: 'School Profile', path: '/school-profile', icon: Building2 },
  { label: 'Account Settings', path: '/account-settings', icon: Settings },
  { label: 'User Accounts', path: '/user-accounts', icon: Users },
  { label: 'Employees', path: '/employees', icon: GraduationCap },
  { label: 'Students', path: '/students', icon: Contact },
  { label: 'Grade & Section', path: '/classes', icon: ClipboardList },
  { label: 'ID Maker', path: '/id-maker', icon: CreditCard },
  { label: 'Attendance', path: '/attendance', icon: BookOpen },
  { label: 'Reports', path: '/reports', icon: FileText },
];

export default function Sidebar({ onNavigate }) {
  const [school, setSchool] = useState(null);
  const [attendanceOpen, setAttendanceOpen] = useState(true);

  useEffect(() => {
    base44.entities.School.list().then(res => setSchool(res[0] || null)).catch(() => {});
  }, []);

  return (
    <div className="kp-panel h-full rounded-2xl flex flex-col p-4 shadow-lg overflow-hidden">
      <div className="flex items-center gap-2 px-1 py-2 mb-3">
        <div className="w-9 h-9 rounded-xl bg-[hsl(var(--kp-teal))] flex items-center justify-center shadow-md">
          <span className="text-white font-bold text-lg">K</span>
        </div>
        <div>
          <div className="text-[10px] text-[hsl(var(--kp-teal))] uppercase tracking-wider leading-none mb-0.5">School</div>
          <div className="text-[hsl(var(--kp-teal))] font-bold text-sm leading-none">Keeppeer</div>
        </div>
      </div>

      <div className="bg-[hsl(var(--kp-teal))] rounded-xl px-3 py-2.5 mb-4">
        <div className="text-white text-xs font-semibold truncate">{school?.school_name || 'Labangal Elementary School'}</div>
        <div className="text-white/70 text-[10px] mt-0.5">Academic Year {school?.academic_year || '2026-2027'}</div>
      </div>

      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1">
        <Building2 className="w-3 h-3" /> My School
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto kp-scroll-thin -mr-1 pr-1">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/admin'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[hsl(var(--kp-teal))] text-white shadow-sm'
                  : 'text-[hsl(var(--kp-teal))] hover:bg-[hsl(var(--accent))]'
              }`
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <button
        onClick={() => { clearRoleChoice(); window.location.href = '/'; }}
        className="mt-3 w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-[hsl(var(--kp-teal))] hover:bg-[hsl(var(--accent))] transition-all"
      >
        <RefreshCw className="w-4 h-4 shrink-0" />
        <span>Switch Role</span>
      </button>

      <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between px-1">
        <span className="text-sm font-medium text-[hsl(var(--kp-teal))]">Attendance</span>
        <button
          onClick={() => setAttendanceOpen(!attendanceOpen)}
          className={`relative w-11 h-6 rounded-full transition-colors ${attendanceOpen ? 'bg-[hsl(var(--kp-green))]' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${attendanceOpen ? 'translate-x-5' : ''}`} />
          <span className={`absolute top-0.5 text-[9px] font-semibold transition-all ${attendanceOpen ? 'left-1.5 text-[hsl(var(--kp-green))]' : 'left-5 text-gray-400'}`}>
            {attendanceOpen ? 'ON' : ''}
          </span>
        </button>
      </div>
    </div>
  );
}