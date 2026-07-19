import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { PagePanel, PageTitle, StatusBadge, Avatar, EmptyState } from '@/components/kp/ui';
import { Users, BookOpen, Clock, Calendar, LogIn, Megaphone, CloudSun, Shield, GraduationCap } from 'lucide-react';
import WeatherMonitor from '@/components/kp/WeatherMonitor';
import AnnouncementList from '@/components/kp/AnnouncementList';
import AnnouncementModal from '@/components/kp/AnnouncementModal';
import { logAudit } from '@/lib/audit';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [myClasses, setMyClasses] = useState([]);
  const [classStudents, setClassStudents] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnModal, setShowAnnModal] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    if (!user?.email && !user?.id) return;
    try {
      const employees = await base44.entities.Employee.list();
      const me = employees.find(e => e.email === user.email || e.user_id === user.id);
      setEmployee(me || null);

      if (me) {
        // Classes where this teacher is the adviser
        const allClasses = await base44.entities.Class.list();
        const mine = allClasses.filter(c => c.adviser_id === me.id || c.adviser_name === `${me.first_name} ${me.last_name}`);
        setMyClasses(mine);

        // Students in the teacher's advisory class(es)
        const allStudents = await base44.entities.Student.list();
        const grades = mine.map(c => c.grade_level);
        const sections = mine.map(c => c.section);
        const studs = allStudents.filter(s =>
          grades.some(g => s.grade === g && sections.some(sec => s.section === sec))
        );
        setClassStudents(studs);

        // Today's schedule for this teacher
        const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const allSched = await base44.entities.Schedule.filter({ day: dayName }).catch(() => []);
        const mine2 = allSched.filter(s => s.teacher_id === me.id || s.teacher_name === `${me.first_name} ${me.last_name}`);
        setSchedules(mine2);

        // Announcements by this teacher + school-wide
        const anns = await base44.entities.Announcement.list('-created_date', 20).catch(() => []);
        const mine3 = anns.filter(a => a.author_id === me.id || a.audience === 'school' || a.audience === 'class');
        setAnnouncements(mine3);
      }
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 18 ? 'Good Afternoon' : 'Good Evening';
  const teacherName = employee ? `Teacher ${employee.first_name}` : (user?.full_name || 'Teacher');

  if (loading) return <div className="text-center py-12 text-gray-400">Loading your dashboard...</div>;

  if (!employee) {
    return (
      <div className="space-y-4">
        <PageTitle subtitle={dateStr}>Teacher Dashboard</PageTitle>
        <PagePanel>
          <EmptyState message="No teacher profile linked to your account. Please contact the administrator to link your employee record." />
        </PagePanel>
      </div>
    );
  }

  const present = classStudents.filter(s => s.inside_status === 'inside').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageTitle subtitle={dateStr}>{greeting}, {teacherName}</PageTitle>
        <div className="kp-panel rounded-xl px-4 py-2.5 shadow-sm flex items-center gap-3">
          <Clock className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
          <div>
            <div className="text-lg font-bold text-[hsl(var(--kp-teal))] tabular-nums leading-none">{timeStr}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Philippine Standard Time</div>
          </div>
        </div>
      </div>

      {/* My Classroom cards */}
      <div>
        <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-2 flex items-center gap-2"><GraduationCap className="w-4 h-4" /> My Classroom</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {myClasses.length === 0 ? (
            <div className="col-span-full"><EmptyState message="No advisory classes assigned yet" /></div>
          ) : myClasses.map(c => {
            const count = classStudents.filter(s => s.grade === c.grade_level && s.section === c.section).length;
            return (
              <PagePanel key={c.id} className="!p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[hsl(var(--kp-teal))]">{c.grade_level} - {c.section}</span>
                  <StatusBadge status={c.status} />
                </div>
                <div className="text-2xl font-bold text-[hsl(var(--kp-teal))]">{count}<span className="text-sm text-gray-400">/{c.capacity || '—'}</span></div>
                <div className="text-[11px] text-gray-400">{c.session || 'Whole Day'} Session</div>
              </PagePanel>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Attendance for my class */}
        <PagePanel className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] flex items-center gap-2"><Users className="w-4 h-4" /> My Class Students</h3>
            <span className="text-xs text-gray-400">{classStudents.length} enrolled • {present} inside</span>
          </div>
          {classStudents.length === 0 ? <EmptyState message="No students in your advisory class" /> : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto kp-scroll-thin">
              {classStudents.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 border border-gray-50">
                  <Avatar name={`${s.first_name} ${s.last_name}`} src={s.photo_url} size="w-8 h-8" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-700 truncate">{s.first_name} {s.last_name}</div>
                    <div className="text-[11px] text-gray-400 font-mono">{s.lrn || '—'}</div>
                  </div>
                  <span className={`w-2 h-2 rounded-full ${s.inside_status === 'inside' ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <StatusBadge status={s.enrollment_status} />
                </div>
              ))}
            </div>
          )}
        </PagePanel>

        {/* Weather & Safety */}
        <PagePanel>
          <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-3 flex items-center gap-2"><CloudSun className="w-4 h-4" /> Weather & Safety</h3>
          <WeatherMonitor compact />
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
                    <div className="text-xs text-gray-400">Room {s.room || '—'} • {s.class_name || '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PagePanel>

        {/* Announcements */}
        <PagePanel>
          <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-3 flex items-center gap-2"><Megaphone className="w-4 h-4" /> Announcements</h3>
          <AnnouncementList
            announcements={announcements}
            onAdd={() => setShowAnnModal(true)}
            addLabel="Record Announcement"
            maxHeight="320px"
          />
        </PagePanel>
      </div>

      <AnnouncementModal
        open={showAnnModal}
        onClose={() => setShowAnnModal(false)}
        onCreated={load}
        defaultAudience="class"
        user={user}
      />
    </div>
  );
}