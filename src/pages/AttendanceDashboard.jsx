import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { PagePanel, PageTitle, StatusBadge } from '@/components/kp/ui';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  UserCheck, UserX, Clock, CalendarCheck, LogIn, LogOut, ShieldAlert, ShieldX,
  Video, VideoOff, TrendingUp, Activity, Users, Filter
} from 'lucide-react';

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div className="kp-panel rounded-xl p-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}><Icon className="w-4 h-4 text-white" /></div>
      <div><div className="text-xl font-bold text-[hsl(var(--kp-teal))] leading-none">{value}</div><div className="text-xs text-gray-400 mt-0.5">{label}</div></div>
    </div>
  );
}

export default function AttendanceDashboard() {
  const [att, setAtt] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [liveness, setLiveness] = useState([]);
  const [devices, setDevices] = useState([]);
  const [students, setStudents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');

  const load = () => {
    Promise.all([
      base44.entities.Attendance.list('-created_date', 500).catch(() => []),
      base44.entities.SecurityAlert.list('-created_date', 100).catch(() => []),
      base44.entities.LivenessResult.list('-created_date', 100).catch(() => []),
      base44.entities.ScannerDevice.list().catch(() => []),
      base44.entities.Student.list().catch(() => []),
      base44.entities.Employee.list().catch(() => []),
    ]).then(([a, al, lv, dev, st, em]) => {
      setAtt(a); setAlerts(al); setLiveness(lv); setDevices(dev); setStudents(st); setEmployees(em);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    const unsub = base44.entities.Attendance.subscribe(() => load());
    return () => { clearInterval(id); unsub && unsub(); };
  }, []);

  const today = new Date().toLocaleDateString('en-CA');
  const todays = useMemo(() => att.filter((a) => a.date === today && (typeFilter === 'all' || a.person_type === typeFilter)), [att, today, typeFilter]);
  const todayAlerts = useMemo(() => alerts.filter((a) => (a.timestamp || '').slice(0, 10) === today), [alerts, today]);
  const todayLiveness = useMemo(() => liveness.filter((l) => (l.timestamp || '').slice(0, 10) === today), [liveness, today]);

  const present = todays.filter((a) => a.status === 'present').length;
  const late = todays.filter((a) => a.status === 'late').length;
  const absent = todays.filter((a) => a.status === 'absent').length;
  const excused = todays.filter((a) => a.status === 'excused').length;
  const halfDay = todays.filter((a) => a.status === 'half_day').length;
  const checkedIn = todays.filter((a) => a.scan_type === 'time_in').length;
  const checkedOut = todays.filter((a) => a.scan_type === 'time_out').length;
  const unknownDetections = todayAlerts.filter((a) => a.alertType === 'Unregistered Face Repeated').length;
  const failedLiveness = todayLiveness.filter((l) => l.passed === false).length + todayAlerts.filter((a) => a.alertType === 'Spoofing Attempt').length;
  const activeCameras = devices.filter((d) => d.status === 'Online').length;
  const offlineCameras = devices.filter((d) => d.status !== 'Online').length;
  const enrolled = students.filter((s) => s.enrollment_status === 'enrolled').length + employees.filter((e) => e.status === 'active').length;
  const attPct = enrolled ? Math.round((todays.filter((a) => a.scan_type === 'time_in' && (a.status === 'present' || a.status === 'late')).length / enrolled) * 100) : 0;

  // 7-day trend
  const trend = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toLocaleDateString('en-CA');
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      days.push({ label, Present: att.filter((a) => a.date === ds && a.status === 'present').length, Late: att.filter((a) => a.date === ds && a.status === 'late').length });
    }
    return days;
  }, [att]);

  // Peak hours (arrival vs departure)
  const peak = useMemo(() => {
    const hours = [];
    for (let h = 6; h <= 19; h++) {
      const hh = String(h).padStart(2, '0');
      hours.push({
        label: hh,
        'Time In': todays.filter((a) => a.scan_type === 'time_in' && (a.time || '').startsWith(hh)).length,
        'Time Out': todays.filter((a) => a.scan_type === 'time_out' && (a.time || '').startsWith(hh)).length,
      });
    }
    return hours;
  }, [todays]);

  // By grade (students)
  const byGrade = useMemo(() => {
    const map = {};
    todays.filter((a) => a.person_type === 'student').forEach((a) => { const g = a.grade || 'Unknown'; map[g] = (map[g] || 0) + 1; });
    return Object.entries(map).map(([grade, count]) => ({ grade, count })).sort((a, b) => a.grade.localeCompare(b.grade));
  }, [todays]);

  const pieData = [
    { name: 'Present', value: present, color: '#009624' },
    { name: 'Late', value: late, color: '#F29339' },
    { name: 'Absent', value: absent, color: '#CC2424' },
    { name: 'Excused', value: excused, color: '#2563eb' },
    { name: 'Half-Day', value: halfDay, color: '#7c3aed' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageTitle subtitle="Real-time AI facial recognition attendance overview">AI Attendance Dashboard</PageTitle>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
            <option value="all">All People</option><option value="student">Students</option><option value="employee">Employees</option>
          </select>
          <span className="text-xs flex items-center gap-1 text-green-600"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat icon={UserCheck} label="Present Today" value={present} color="bg-[hsl(var(--kp-green))]" />
        <Stat icon={Clock} label="Late Today" value={late} color="bg-[hsl(var(--kp-orange))]" />
        <Stat icon={UserX} label="Absent Today" value={absent} color="bg-[hsl(var(--kp-red))]" />
        <Stat icon={CalendarCheck} label="Excused" value={excused} color="bg-blue-500" />
        <Stat icon={LogIn} label="Checked In" value={checkedIn} color="bg-[hsl(var(--kp-teal))]" />
        <Stat icon={LogOut} label="Checked Out" value={checkedOut} color="bg-[hsl(var(--kp-teal-light))]" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={ShieldAlert} label="Unknown Faces" value={unknownDetections} color="bg-[hsl(var(--kp-red))]" />
        <Stat icon={ShieldX} label="Failed Liveness" value={failedLiveness} color="bg-[hsl(var(--kp-orange))]" />
        <Stat icon={Video} label="Active Cameras" value={activeCameras} color="bg-[hsl(var(--kp-green))]" />
        <Stat icon={VideoOff} label="Offline Cameras" value={offlineCameras} color="bg-[hsl(var(--kp-red))]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PagePanel className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-[hsl(var(--kp-teal))]" /><h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">7-Day Attendance Trend</h3></div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <Tooltip />
              <Bar dataKey="Present" fill="#009624" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Late" fill="#F29339" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </PagePanel>

        <PagePanel>
          <div className="flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-[hsl(var(--kp-teal))]" /><h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">Attendance %</h3></div>
          <div className="flex flex-col items-center justify-center h-[240px]">
            <div className="relative w-40 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ value: attPct }, { value: 100 - attPct }]} dataKey="value" innerRadius={52} outerRadius={72} startAngle={90} endAngle={-270} stroke="none">
                    <Cell fill="#009624" /><Cell fill="#e5e7eb" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-3xl font-bold text-[hsl(var(--kp-teal))]">{attPct}%</div>
                <div className="text-xs text-gray-400">of {enrolled} enrolled</div>
              </div>
            </div>
          </div>
        </PagePanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PagePanel>
          <div className="flex items-center gap-2 mb-3"><Clock className="w-4 h-4 text-[hsl(var(--kp-teal))]" /><h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">Peak Arrival / Departure Times</h3></div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={peak}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip />
              <Bar dataKey="Time In" fill="#2BB5C6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Time Out" fill="#009624" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </PagePanel>

        <PagePanel>
          <div className="flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-[hsl(var(--kp-teal))]" /><h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">By Class / Grade (Today)</h3></div>
          {byGrade.length === 0 ? <p className="text-sm text-gray-400 text-center py-12">No student scans today</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byGrade} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                <YAxis type="category" dataKey="grade" tick={{ fontSize: 11 }} width={70} stroke="#9ca3af" />
                <Tooltip />
                <Bar dataKey="count" fill="#004D5A" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </PagePanel>
      </div>

      <PagePanel>
        <div className="flex items-center gap-2 mb-3"><ShieldAlert className="w-4 h-4 text-[hsl(var(--kp-teal))]" /><h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">Recent Security Events</h3></div>
        {todayAlerts.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">No security events today</p> : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {todayAlerts.slice(0, 12).map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${a.severity === 'Critical' ? 'bg-red-100 text-red-700' : a.severity === 'High' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{a.alertType}</span>
                <span className="text-xs text-gray-500 flex-1 truncate">{a.description}</span>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        )}
      </PagePanel>
    </div>
  );
}