import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { PagePanel, PageTitle, StatusBadge, Avatar } from '@/components/kp/ui';
import { Users, UserCheck, UserX, Clock, TrendingUp, CloudSun, Shield, Calendar, LogIn, LogOut, Megaphone } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, totalStudents: 0, studentsIn: 0, studentsOut: 0, teachersIn: 0, teachersOut: 0 });
  const [enrollment, setEnrollment] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [schedule, setSchedule] = useState([]);

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
      const byGrade = {};
      students.forEach(s => { const g = s.grade || 'Unassigned'; byGrade[g] = (byGrade[g] || 0) + 1; });
      setEnrollment(Object.entries(byGrade).map(([grade, count]) => ({ grade, count })));
      setAnnouncements(anns);
      setCheckins(recent);
      setSchedule(sched);
    }).finally(() => setLoading(false));
  }, []);

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
            <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">Enrollment by Grade</h3>
          </div>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading chart...</div>
          ) : enrollment.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No enrollment data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={enrollment}>
                <XAxis dataKey="grade" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Students">
                  {enrollment.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </PagePanel>

        <PagePanel>
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className="w-4 h-4 text-[hsl(var(--kp-teal))]" />
            <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">Announcements</h3>
          </div>
          <div className="space-y-3 max-h-[260px] overflow-y-auto kp-scroll-thin">
            {announcements.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No announcements</p>
            ) : announcements.map(a => (
              <div key={a.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${a.priority === 'urgent' ? 'bg-red-500' : a.priority === 'high' ? 'bg-orange-500' : 'bg-green-500'}`} />
                  <span className="text-sm font-medium text-[hsl(var(--kp-teal))]">{a.title}</span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{a.content}</p>
              </div>
            ))}
          </div>
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
          <div className="text-center py-3">
            <CloudSun className="w-12 h-12 text-[hsl(var(--kp-orange))] mx-auto mb-2" />
            <div className="text-2xl font-bold text-[hsl(var(--kp-teal))]">31°C</div>
            <div className="text-sm text-gray-500">Partly Cloudy</div>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-100 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[hsl(var(--kp-green))]" />
            <span className="text-xs font-medium text-[hsl(var(--kp-green))]">All systems safe</span>
          </div>
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