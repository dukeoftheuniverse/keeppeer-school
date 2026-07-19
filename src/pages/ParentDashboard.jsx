import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { PagePanel, PageTitle, StatusBadge, Avatar, EmptyState } from '@/components/kp/ui';
import { Clock, Calendar, BookOpen, Megaphone, CloudSun, LogIn, Award, GraduationCap, School, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import WeatherMonitor from '@/components/kp/WeatherMonitor';
import AnnouncementList from '@/components/kp/AnnouncementList';

export default function ParentDashboard() {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState([]);
  const [selected, setSelected] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [school, setSchool] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    if (!user?.email) return;
    try {
      const allStudents = await base44.entities.Student.list();
      // Match children by parent_email
      const mine = allStudents.filter(s =>
        s.parent_email && s.parent_email.toLowerCase() === user.email.toLowerCase()
      );
      setChildren(mine);
      if (mine.length && !selected) setSelected(mine[0]);

      const schools = await base44.entities.School.list().catch(() => []);
      setSchool(schools[0] || null);

      const anns = await base44.entities.Announcement.list('-created_date', 20).catch(() => []);
      setAnnouncements(anns.filter(a => a.audience === 'school' || a.audience === 'class'));
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user, selected]);

  useEffect(() => { load(); }, [load]);

  // Load attendance + schedule for selected child
  useEffect(() => {
    if (!selected) return;
    base44.entities.Attendance.filter({ person_id: selected.id }).then(att => {
      setAttendance(att);
    }).catch(() => {});
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    base44.entities.Schedule.filter({ day: dayName }).then(all => {
      const mine = all.filter(s =>
        s.class_name?.includes(selected.grade) || s.class_name?.includes(selected.section)
      );
      setSchedules(mine);
    }).catch(() => {});
  }, [selected]);

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 18 ? 'Good Afternoon' : 'Good Evening';

  if (loading) return <div className="text-center py-12 text-gray-400">Loading your dashboard...</div>;

  if (children.length === 0) {
    return (
      <div className="space-y-4">
        <PageTitle subtitle={dateStr}>Parent Dashboard</PageTitle>
        <PagePanel>
          <EmptyState message="No children are linked to your email. Please make sure your child's record lists your email as the parent contact, or contact the school administrator." />
        </PagePanel>
      </div>
    );
  }

  const present = attendance.filter(a => a.status === 'present').length;
  const absent = attendance.filter(a => a.status === 'absent').length;
  const late = attendance.filter(a => a.status === 'late').length;
  const total = present + absent + late;
  const rate = total ? Math.round((present / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageTitle subtitle={dateStr}>{greeting}, Parent</PageTitle>
        <div className="kp-panel rounded-xl px-4 py-2.5 shadow-sm flex items-center gap-3">
          <Clock className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
          <div>
            <div className="text-lg font-bold text-[hsl(var(--kp-teal))] tabular-nums leading-none">{timeStr}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Philippine Standard Time</div>
          </div>
        </div>
      </div>

      {/* Children selector */}
      <div>
        <div className="flex items-center gap-3 overflow-x-auto kp-scroll-thin pb-2">
          {children.map(c => (
            <button key={c.id} onClick={() => setSelected(c)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 min-w-[100px] transition-all ${selected?.id === c.id ? 'border-[hsl(var(--kp-teal))] bg-[hsl(var(--accent))]' : 'border-transparent bg-white/60'}`}>
              <Avatar name={`${c.first_name} ${c.last_name}`} src={c.photo_url} size="w-12 h-12" />
              <span className="text-xs font-medium text-gray-700 truncate max-w-[90px]">{c.nickname || c.first_name}</span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <>
          {/* Student profile + attendance summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <PagePanel>
              <div className="flex flex-col items-center text-center">
                <Avatar name={`${selected.first_name} ${selected.last_name}`} src={selected.photo_url} size="w-20 h-20" />
                <h3 className="text-base font-bold text-[hsl(var(--kp-teal))] mt-2">{selected.first_name} {selected.last_name}</h3>
                <div className="text-xs text-gray-400 font-mono mt-0.5">LRN: {selected.lrn || '—'}</div>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge status={selected.enrollment_status} />
                  <span className="text-[11px] text-gray-500">{selected.grade} - {selected.section}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                  <School className="w-3.5 h-3.5" /> {school?.school_name || 'Labangal Elementary School'}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">SY {school?.academic_year || '2026-2027'}</div>
                {/* Badges */}
                <div className="flex gap-1.5 mt-3">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center ${i <= Math.ceil(rate/20) ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-300'}`}>
                      <Award className="w-3.5 h-3.5" />
                    </div>
                  ))}
                </div>
              </div>
            </PagePanel>

            <PagePanel className="lg:col-span-2">
              <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-3 flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Attendance Summary</h3>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative w-44 h-44 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[
                        { name: 'Present', value: present, color: '#009624' },
                        { name: 'Absent', value: absent, color: '#CC2424' },
                        { name: 'Late', value: late, color: '#F29339' },
                      ].filter(d => d.value > 0)} dataKey="value" innerRadius={52} outerRadius={78} paddingAngle={3} startAngle={90} endAngle={-270} stroke="none">
                        {[{c:'#009624'},{c:'#CC2424'},{c:'#F29339'}].map((d,i) => <Cell key={i} fill={d.c} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-2xl font-bold text-[hsl(var(--kp-teal))] leading-none">{rate}%</div>
                    <div className="text-[10px] text-gray-400">Attendance</div>
                  </div>
                </div>
                <div className="flex-1 space-y-2.5 w-full">
                  <Row label="Present Days" value={present} color="#009624" />
                  <Row label="Absent Days" value={absent} color="#CC2424" />
                  <Row label="Late Days" value={late} color="#F29339" />
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: selected.inside_status === 'inside' ? '#009624' : '#9ca3af' }} />
                    <span className="text-sm text-gray-600">{selected.inside_status === 'inside' ? 'Inside Campus' : 'Outside Campus'}</span>
                  </div>
                </div>
              </div>
            </PagePanel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Today's schedule */}
            <PagePanel className="lg:col-span-2">
              <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-3 flex items-center gap-2"><Calendar className="w-4 h-4" /> Today's Schedule</h3>
              {schedules.length === 0 ? <EmptyState message="No classes scheduled today" /> : (
                <div className="space-y-1.5">
                  {schedules.map(s => (
                    <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50">
                      <div className="text-xs font-medium text-[hsl(var(--kp-teal))] w-24 shrink-0">{s.start_time} - {s.end_time}</div>
                      <BookOpen className="w-4 h-4 text-[hsl(var(--kp-teal))] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-700 truncate">{s.subject_name}</div>
                        <div className="text-xs text-gray-400">{s.teacher_name} • Room {s.room || '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </PagePanel>

            {/* Weather */}
            <PagePanel>
              <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-3 flex items-center gap-2"><CloudSun className="w-4 h-4" /> Weather & Safety</h3>
              <WeatherMonitor compact />
            </PagePanel>
          </div>

          {/* School + Class announcements */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PagePanel>
              <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-3 flex items-center gap-2"><Megaphone className="w-4 h-4" /> School Announcements</h3>
              <AnnouncementList announcements={announcements.filter(a => a.audience === 'school')} maxHeight="200px" emptyMessage="No school announcements" />
            </PagePanel>
            <PagePanel>
              <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Class Announcements</h3>
              <AnnouncementList announcements={announcements.filter(a => a.audience === 'class' && (!a.target_class || a.target_class === `${selected.grade} - ${selected.section}`))} maxHeight="200px" emptyMessage="No class announcements" />
            </PagePanel>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      </div>
      <span className="text-sm text-gray-600 flex-1">{label}</span>
      <span className="font-bold text-gray-700">{value}</span>
    </div>
  );
}