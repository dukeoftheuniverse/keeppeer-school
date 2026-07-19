import React from 'react';
import { Shield, GraduationCap, Users, ArrowRight, School } from 'lucide-react';

export default function RoleSelect({ onSelect }) {
  const roles = [
    { id: 'admin', title: 'Admin Dashboard', desc: 'Full school management — students, staff, attendance, IDs & reports.', icon: Shield, color: 'from-[#004D5A] to-[#2BB5C6]' },
    { id: 'teacher', title: 'Teacher Account', desc: 'Manage your classes, take attendance & post announcements.', icon: GraduationCap, color: 'from-[#00796B] to-[#26A69A]' },
    { id: 'parent', title: 'Parent Account', desc: 'Track your child’s attendance, schedule & school notices.', icon: Users, color: 'from-[#0277BD] to-[#4FC3F7]' },
  ];

  return (
    <div className="min-h-[calc(100vh-3rem)] flex items-center justify-center py-8">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[hsl(var(--kp-teal))] text-white mb-4 shadow-lg">
            <School className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--kp-teal))]">Welcome to KeepPeer School</h1>
          <p className="text-sm text-gray-500 mt-1.5 max-w-md mx-auto">Select your account type to continue to your dashboard.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {roles.map(r => {
            const Icon = r.icon;
            return (
              <button key={r.id} onClick={() => onSelect(r.id)}
                className="kp-panel rounded-2xl p-6 text-left group hover:scale-[1.02] hover:shadow-xl transition-all duration-200 flex flex-col">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${r.color} flex items-center justify-center mb-4 shadow-md`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-base font-bold text-[hsl(var(--kp-teal))] mb-1.5">{r.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed flex-1">{r.desc}</p>
                <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--kp-teal))] group-hover:gap-2.5 transition-all">
                  Continue <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}