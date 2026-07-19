import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { PagePanel, PageTitle, StatusBadge, Avatar } from '@/components/kp/ui';
import { Users, UserCheck, UserX, Clock, TrendingUp, CloudSun, Shield, Calendar, LogIn, LogOut, Megaphone, Plus } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import WeatherMonitor from '@/components/kp/WeatherMonitor';
import AnnouncementList from '@/components/kp/AnnouncementList';
import AnnouncementModal from '@/components/kp/AnnouncementModal';

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="kp-panel rounded-xl p-4 shadow-sm flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-[hsl(var(--kp-teal))] leading-none">{value}</div>
        <div className="text-xs text-gray-500 mt-0.5 truncate">{label}</div>
        {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function InOutCard({ title, inside, outside, total }) {
  return (
    <div className="kp-panel rounded-xl p-4 shadow-sm">
      <div className="text-sm font-semibold text-[hsl(var(--kp-teal))] mb-3">{title}</div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-xs text-gray-400">Inside</div>
          <div className="text-xl font-bold text-[hsl(var(--kp-green))]">{inside}</div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-400">Outside</div>
          <div className="text-xl font-bold text-gray-400">{outside}</div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-400">Total</div>
          <div className="text-xl font-bold text-[hsl(var(--kp-teal))]">{total}</div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, totalStudents: 0, studentsIn: 0, studentsOut: 0, teachersIn: 0, teachersOut: 0 });
  const [announcements, setAnnouncements] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [showAnnModal, setShowAnnModal] = useState(false);

  const loadAnnouncements = () => {
    base44.entities.Announcement.list('-created_date', 10).then(setAnnouncements).catch(() => {});
  };

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const today = new Date().toLocaleDateString('en-CA');
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    Promise.all([
      base44.entities.Attendance.filter({ date: today }).catch(() => []),
      base44.entities.Student.list().catch(() => []),
      base44.entities.Employee.list().catch(() => []),
      base44.entities.Announcement.list('-created_date', 5).catch(() => []),
      base44.entities.Attendance.list('-created_date', 8).catch(() => []),
      base44.entities.Schedule.filter({ day: dayName }).catch(() => []),
    ]).then(([att, students, employees, anns, recent, sched]) => {
      const present = att.filter(a => a.status === 'present').length;
      const absent = att.filter(a => a.status === 'absent').length;
      const late = att.filter(a => a.status === 'late').length;
      const studentIns = att.filter(a => a.person_type === 'student' && a.scan_type === 'time_in').length;
      const teacherIns = att.filter(a => a.person_type === 'employee' && a.scan_type === 'time_in').length;
      setStats({
        present, absent, late,
        totalStudents: students.length,
        studentsIn: studentIns, studentsOut: students.length - studentIns,
        teachersIn: teacherIns, teachersOut: employees.length - teacherIns,
      });
      setAnnouncements(anns);
      setCheckins(recent);
      setSchedule(sched);
    }).finally(() => setLoading(false));
  }, []);

  const reloadAnnouncements = () => { loadAnnouncements(); };

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const chartColors = ['#004D5A', '#2BB5C6', '#009624', '#F29339', '#7c3aed', '#CC2424'];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageTitle subtitle={dateStr}>Dashboard</PageTitle>
        <div className="kp-panel rounded-xl px-4 py-2.5 shadow-sm flex items-center gap-3">
          <Clock className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
          <div>
            <div className="text-lg font-bold text-[hsl(var(--kp-teal))] tabular-nums leading-none">{timeStr}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Philippine Standard Time</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={UserCheck} label="Present Today" value={stats.present} color="bg-[hsl(var(--kp-green))]" />
        <StatCard icon={UserX} label="Absent Today" value={stats.absent} color="bg-[hsl(var(--kp-red))]" />
        <StatCard icon={Clock} label="Late Today" value={stats.late} color="bg-[hsl(var(--kp-orange))]" />
        <StatCard icon={Users} label="Total Students" value={stats.totalStudents} color="bg-[hsl(var(--kp-teal))]" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InOutCard title="Students" inside={stats.studentsIn} outside={stats.studentsOut} total={stats.totalStudents} />
        <InOutCard title="Teachers & Staff" inside={stats.teachersIn} outside={stats.teachersOut} total={stats.teachersIn + stats.teachersOut} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PagePanel className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[hsl(var(--kp-teal))]" />
            <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">Attendance Overview</h3>
          </div>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading chart...</div>
          ) : (stats.present + stats.absent + stats.late === 0) ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No attendance data yet today</div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative w-56 h-56 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[
                      { name: 'Present', value: stats.present, color: '#009624' },
                      { name: 'Absent', value: stats.absent, color: '#CC2424' },
                      { name: 'Late', value: stats.late, color: '#F29339' },
                    ].filter(d => d.value > 0)} dataKey="value" innerRadius={62} outerRadius={92} paddingAngle={3} startAngle={90} endAngle={-270} stroke="none">
                      {[
                        { name: 'Present', color: '#009624' },
                        { name: 'Absent', color: '#CC2424' },
                        { name: 'Late', color: '#F29339' },
                      ].filter(d => stats[d.name.toLowerCase()] > 0).map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-3xl font-bold text-[hsl(var(--kp-teal))] leading-none">{stats.present + stats.absent + stats.late}</div>
                  <div className="text-xs text-gray-400 mt-1">Total Scans</div>
                </div>
              </div>
              <div className="flex-1 space-y-3 w-full">
                {[
                  { label: 'Present', value: stats.present, color: '#009624', icon: UserCheck },
                  { label: 'Absent', value: stats.absent, color: '#CC2424', icon: UserX },
                  { label: 'Late', value: stats.late, color: '#F29339', icon: Clock },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${r.color}18` }}>
                      <r.icon className="w-4 h-4" style={{ color: r.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{r.label}</span>
                        <span className="font-semibold text-gray-700">{r.value}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1">
                        <div className="h-full rounded-full" style={{ width: `${(stats.present + stats.absent + stats.late) ? (r.value / (stats.present + stats.absent + stats.late)) * 100 : 0}%`, background: r.color }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </PagePanel>

        <PagePanel>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[hsl(var(--kp-teal))]" />
              <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">Announcements</h3>
            </div>
            <button onClick={() => setShowAnnModal(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[hsl(var(--kp-green))] text-white text-xs font-medium hover:bg-[hsl(var(--kp-green-dark))]">
              <Plus className="w-3.5 h-3.5" /> Record
            </button>
          </div>
          <AnnouncementList announcements={announcements} maxHeight="260px" />
          <AnnouncementModal open={showAnnModal} onClose={() => setShowAnnModal(false)} onCreated={reloadAnnouncements} user={user} />
        </PagePanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PagePanel className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-[hsl(var(--kp-teal))]" />
            <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">Today's Schedule</h3>
          </div>
          {schedule.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No scheduled classes today</p>
          ) : (
            <div className="space-y-2">
              {schedule.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50">
                  <div className="text-xs font-medium text-[hsl(var(--kp-teal))] w-24 shrink-0">{s.start_time} - {s.end_time}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-700 truncate">{s.subject_name}</div>
                    <div className="text-xs text-gray-400">{s.teacher_name} • Room {s.room}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PagePanel>

        <PagePanel>
          <div className="flex items-center gap-2 mb-4">
            <CloudSun className="w-4 h-4 text-[hsl(var(--kp-teal))]" />
            <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">Weather & Safety</h3>
          </div>
          <WeatherMonitor />
        </PagePanel>
      </div>

      <PagePanel>
        <div className="flex items-center gap-2 mb-4">
          <LogIn className="w-4 h-4 text-[hsl(var(--kp-teal))]" />
          <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">Recent Check-ins</h3>
        </div>
        {checkins.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No recent check-ins</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400">
                  <th className="text-left py-2 px-2 font-medium">Name</th>
                  <th className="text-left py-2 px-2 font-medium">Type</th>
                  <th className="text-left py-2 px-2 font-medium">Status</th>
                  <th className="text-left py-2 px-2 font-medium">Method</th>
                  <th className="text-right py-2 px-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {checkins.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <Avatar name={c.person_name} size="w-7 h-7" />
                        <span className="font-medium text-gray-700">{c.person_name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-gray-500 capitalize">{c.person_type}</td>
                    <td className="py-2 px-2"><StatusBadge status={c.status} /></td>
                    <td className="py-2 px-2 text-gray-500 capitalize">{c.method}</td>
                    <td className="py-2 px-2 text-right text-gray-500">{c.time || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PagePanel>
    </div>
  );
}