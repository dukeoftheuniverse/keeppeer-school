import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import DashHeader from '@/components/kp/DashHeader';
import AnnouncementList from '@/components/kp/AnnouncementList';
import ChatModal from '@/components/kp/ChatModal';
import { logAudit } from '@/lib/audit';
import {
  Calendar, BookOpen, FlaskConical, Coffee, Calculator, Home as HomeIcon, Megaphone, Award,
  Clock, Loader2, Plus, QrCode, Trash2, ChevronRight, MapPin, GraduationCap, CheckCircle2,
  ClipboardCheck, BadgeCheck, School as SchoolIcon, MessageSquare
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

function subjectIcon(name = '') {
  const n = name.toLowerCase();
  if (n.includes('science')) return FlaskConical;
  if (n.includes('recess') || n.includes('break')) return Coffee;
  if (n.includes('math')) return Calculator;
  if (n.includes('dismissal') || n.includes('home')) return HomeIcon;
  return BookOpen;
}

export default function ParentDashboard() {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState(null);
  const [children, setChildren] = useState([]);
  const [selected, setSelected] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [grades, setGrades] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [lrnInput, setLrnInput] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState('');
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 18 ? 'Good Afternoon' : 'Good Evening';
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const load = useCallback(async () => {
    if (!user?.email) { setLoading(false); return; }
    try {
      const [schools, allStudents, anns] = await Promise.all([
        base44.entities.School.list().catch(() => []),
        base44.entities.Student.list(),
        base44.entities.Announcement.list('-created_date', 30).catch(() => []),
      ]);
      setSchool(schools[0] || null);
      const mine = allStudents.filter(s => s.parent_email && s.parent_email.toLowerCase() === user.email.toLowerCase());
      setChildren(mine);
      if (mine.length && !selected) setSelected(mine[0]);
      setAnnouncements(anns.filter(a => a.audience === 'school' || a.audience === 'class'));
    } catch (e) { /* */ }
    finally { setLoading(false); }
  }, [user, selected]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selected) return;
    base44.entities.Attendance.filter({ person_id: selected.id }).then(setAttendance).catch(() => setAttendance([]));
    base44.entities.Grade.filter({ student_id: selected.id }).then(all => setGrades(all.filter(g => g.visible_to_parent !== false))).catch(() => setGrades([]));
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    base44.entities.Schedule.filter({ day: dayName }).then(all => {
      setSchedules(all.filter(s => s.class_name?.includes(selected.grade) && s.class_name?.includes(selected.section)));
    }).catch(() => setSchedules([]));
  }, [selected]);

  const linkChild = async () => {
    if (!lrnInput.trim()) return;
    setLinking(true); setLinkMsg('');
    try {
      const all = await base44.entities.Student.list();
      const found = all.find(s => s.lrn === lrnInput.trim());
      if (!found) { setLinkMsg('No student found with that LRN.'); setLinking(false); return; }
      await base44.entities.Student.update(found.id, { parent_email: user.email });
      setChildren(prev => prev.find(c => c.id === found.id) ? prev : [...prev, found]);
      setSelected(found);
      setLrnInput(''); setShowAdd(false);
      setLinkMsg('Student linked successfully.');
      logAudit('link_child', 'Student', found.id, `Linked to ${user.email}`);
    } catch (e) { setLinkMsg('Failed to link student.'); }
    finally { setLinking(false); }
  };

  if (loading) return <div className="kp-dash-bg min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#00838F] animate-spin" /></div>;

  const present = attendance.filter(a => a.status === 'present').length;
  const absent = attendance.filter(a => a.status === 'absent').length;
  const late = attendance.filter(a => a.status === 'late').length;
  const total = present + absent + late;
  const rate = total ? Math.round((present / total) * 100) : 0;

  const todayCheckin = attendance.find(a => a.date === new Date().toLocaleDateString('en-CA') && a.scan_type === 'time_in');
  const schoolAnn = announcements.filter(a => a.audience === 'school');
  const classAnn = announcements.filter(a => a.audience === 'class' && (!a.target_class || (selected && a.target_class === `${selected.grade} - ${selected.section}`)));
  const chatMe = { id: user?.id, name: user?.full_name || 'Parent', email: user?.email, role: 'parent' };

  return (
    <div className="kp-dash-bg min-h-screen">
      <DashHeader greeting={greeting} name="Parents" />
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4 pb-10">
        {/* Greeting banner */}
        <div className="bg-white rounded-2xl shadow-md p-4 sm:p-5 flex items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#00838F] to-[#00BCD4] flex items-center justify-center shrink-0 shadow-md">
            <GraduationCap className="w-9 h-9 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-[#004D40]">{greeting}, Parents</h2>
            <div className="text-xs sm:text-sm text-[#546E7A] flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3.5 h-3.5" /> {timeStr}, {dateStr}
            </div>
          </div>
        </div>

        {/* Announcements */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <h3 className="text-base font-bold text-[#004D40] mb-3 flex items-center gap-2"><Megaphone className="w-5 h-5 text-[#006064]" /> School Announcement</h3>
            <AnnouncementList announcements={schoolAnn} maxHeight="220px" emptyMessage="No school announcements" />
          </Card>
          <Card>
            <h3 className="text-base font-bold text-[#004D40] mb-3 flex items-center gap-2"><BookOpen className="w-5 h-5 text-[#006064]" /> Class Announcement</h3>
            <AnnouncementList announcements={classAnn} maxHeight="220px" emptyMessage="No class announcements" />
          </Card>
        </div>

        {/* My Student picker */}
        <SectionBar icon={GraduationCap} label="My Student" />
        <div className="flex gap-3 overflow-x-auto kp-scroll-thin pb-2">
          {children.map(c => {
            const active = selected?.id === c.id;
            return (
              <button key={c.id} onClick={() => setSelected(c)} className={`bg-white rounded-2xl shadow p-3 min-w-[124px] flex flex-col items-center gap-1.5 border-2 transition-all ${active ? 'border-[#004D5A] ring-2 ring-[#004D5A]/10' : 'border-transparent hover:border-[#B2EBF2]'}`}>
                <Avatar name={`${c.first_name} ${c.last_name}`} src={c.photo_url} size="w-12 h-12" />
                <span className="text-xs font-semibold text-[#004D40] truncate max-w-[100px]">{c.nickname || c.first_name}</span>
                <span className="text-[10px] text-[#546E7A]">{c.grade} - {c.section}</span>
              </button>
            );
          })}
          <button onClick={() => setShowAdd(true)} className="bg-white/70 rounded-2xl shadow p-3 min-w-[124px] flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-[#00BCD4] text-[#00838F] hover:bg-white">
            <div className="w-12 h-12 rounded-full bg-[#009624] flex items-center justify-center shadow"><QrCode className="w-6 h-6 text-white" /></div>
            <span className="text-xs font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add More</span>
          </button>
        </div>

        {showAdd && (
          <Card>
            <h3 className="text-sm font-bold text-[#004D40] mb-2">Link a Student</h3>
            <p className="text-xs text-[#546E7A] mb-3">Enter your child's LRN to link them to your account.</p>
            <div className="flex gap-2">
              <input value={lrnInput} onChange={e => setLrnInput(e.target.value)} placeholder="Enter LRN..." className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <button onClick={linkChild} disabled={linking} className="px-4 py-2 rounded-lg bg-[#00BCD4] text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1.5">{linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />} Link</button>
              <button onClick={() => { setShowAdd(false); setLinkMsg(''); }} className="px-3 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm">Cancel</button>
            </div>
            {linkMsg && <p className="text-xs text-[#006064] mt-2">{linkMsg}</p>}
          </Card>
        )}

        {children.length === 0 && !showAdd ? (
          <Card>
            <div className="text-center py-10">
              <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#004D40] mb-1">No children linked yet</h3>
              <p className="text-sm text-[#546E7A] mb-3">Tap "Add More" and enter your child's LRN to start tracking their records.</p>
            </div>
          </Card>
        ) : selected && (
          <>
            {/* Profile + Attendance summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <div className="flex flex-col items-center text-center">
                  <Avatar name={`${selected.first_name} ${selected.last_name}`} src={selected.photo_url} size="w-24 h-24" />
                  <h3 className="text-base font-bold text-[#004D40] mt-2">{selected.first_name} {selected.last_name}</h3>
                  <div className="mt-1 inline-flex items-center gap-1.5 bg-[#E0F7FA] text-[#006064] text-[11px] font-medium px-2.5 py-1 rounded-full">
                    <SchoolIcon className="w-3.5 h-3.5" /> {school?.school_name || 'Labangal Elementary School'}
                  </div>
                  <div className="text-[11px] text-[#546E7A] mt-1">School Year {school?.academic_year || '2026-2027'}</div>
                  <div className="flex gap-1.5 mt-3">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center ${i <= Math.ceil(rate / 20) ? 'bg-yellow-100 text-yellow-500 ring-1 ring-yellow-300' : 'bg-gray-100 text-gray-300'}`}>
                        <Award className="w-4 h-4" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="text-xs font-semibold text-[#006064] mb-1.5">Connected</div>
                  {[selected.parent_email, user.email].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map(em => (
                    <div key={em} className="flex items-center justify-between text-xs text-[#546E7A] py-1">
                      <span className="truncate flex items-center gap-1.5"><BadgeCheck className="w-3.5 h-3.5 text-green-500 shrink-0" /> {em}</span>
                      <Trash2 className="w-3.5 h-3.5 text-gray-300" />
                    </div>
                  ))}
                  {!selected.parent_email && !user.email && <p className="text-xs text-gray-400">No contacts connected.</p>}
                </div>
              </Card>

              <Card className="lg:col-span-2">
                <h3 className="text-base font-bold text-[#004D40] mb-3 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-[#006064]" /> Attendance Summary</h3>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative w-40 h-40 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={[{ name: 'Present', value: present || 1, color: '#009624' }]} dataKey="value" innerRadius={56} outerRadius={78} startAngle={-90} endAngle={-90 + (rate / 100) * 360} stroke="none">
                          <Cell fill="#009624" />
                        </Pie>
                        <Pie data={[{ name: 'bg', value: 1, color: '#E0F7FA' }]} dataKey="value" innerRadius={56} outerRadius={78} startAngle={-90 + (rate / 100) * 360} endAngle={270} stroke="none">
                          <Cell fill="#E0F7FA" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <div className="text-3xl font-bold text-[#009624] leading-none">{rate}%</div>
                      <div className="text-[10px] text-[#546E7A]">Attendance</div>
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-2 w-full">
                    <StatBox label="Present Days" value={present} color="#009624" />
                    <StatBox label="Absent Days" value={absent} color="#CC2424" />
                    <StatBox label="Late Days" value={late} color="#F29339" />
                  </div>
                </div>
                <button className="mt-4 text-xs font-medium text-[#006064] hover:underline flex items-center gap-1">View Attendance History <ChevronRight className="w-3.5 h-3.5" /></button>
              </Card>
            </div>

            {/* Schedule + Attendance status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <h3 className="text-base font-bold text-[#004D40] mb-3 flex items-center gap-2"><Calendar className="w-5 h-5 text-[#006064]" /> Today's Schedule</h3>
                {schedules.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">No classes scheduled today.</p> : (
                  <div className="relative pl-6">
                    <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-[#B2EBF2]" />
                    {schedules.map(s => {
                      const SIcon = subjectIcon(s.subject_name);
                      return (
                        <div key={s.id} className="relative mb-3 last:mb-0">
                          <div className="absolute -left-[18px] top-1 w-3.5 h-3.5 rounded-full bg-[#00BCD4] border-2 border-white shadow" />
                          <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-2.5 shadow-sm">
                            <div className="w-9 h-9 rounded-lg bg-[#E0F7FA] flex items-center justify-center shrink-0"><SIcon className="w-4 h-4 text-[#006064]" /></div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-[#004D40] truncate">{s.subject_name}</div>
                              <div className="text-[11px] text-[#546E7A]">{s.teacher_name ? `Teacher ${s.teacher_name.split(' ')[0]}` : ''} {s.room ? `• Room ${s.room}` : ''}</div>
                            </div>
                            <div className="text-xs font-medium text-[#006064] shrink-0">{s.start_time} - {s.end_time}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card>
                <h3 className="text-base font-bold text-[#004D40] mb-3 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-[#006064]" /> Attendance Status</h3>
                <div className="space-y-2.5">
                  <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${selected.inside_status === 'inside' ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${selected.inside_status === 'inside' ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <ClipboardCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className={`text-sm font-semibold ${selected.inside_status === 'inside' ? 'text-green-700' : 'text-gray-500'}`}>{selected.inside_status === 'inside' ? 'Inside Campus' : 'Outside Campus'}</div>
                      <div className="text-[11px] text-[#546E7A]">{todayCheckin?.time || '—'} {todayCheckin?.date ? `• ${new Date(todayCheckin.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}</div>
                    </div>
                  </div>
                  <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${todayCheckin ? 'bg-green-50' : 'bg-gray-50'}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${todayCheckin ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <span className="text-white font-bold text-sm">{todayCheckin ? 'A+' : '—'}</span>
                    </div>
                    <div>
                      <div className={`text-sm font-semibold ${todayCheckin ? 'text-green-700' : 'text-gray-500'}`}>{todayCheckin ? 'Present' : 'Not yet checked in'}</div>
                      <div className="text-[11px] text-[#546E7A]">{selected.grade} - {selected.section}</div>
                      {todayCheckin?.confidence_score != null && <div className="text-[11px] text-[#546E7A]">Teacher Advisory</div>}
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-[#546E7A] flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-[#006064]" /> {school?.address || 'Labangal Elementary School'}</div>
              </Card>
            </div>

            {/* Latest Grades */}
            <Card>
              <h3 className="text-base font-bold text-[#004D40] mb-3 flex items-center gap-2"><Award className="w-5 h-5 text-[#006064]" /> Latest Grades</h3>
              {grades.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">No grades recorded yet.</p> : (
                <div className="space-y-2">
                  {grades.slice(0, 8).map(g => {
                    const pct = g.total ? Math.round((g.score / g.total) * 100) : 0;
                    return (
                      <div key={g.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-2.5">
                        <div className="w-9 h-9 rounded-lg bg-[#E0F7FA] flex items-center justify-center shrink-0"><Award className="w-4 h-4 text-[#006064]" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-[#004D40] truncate">{g.subject_name}</div>
                          <div className="text-[11px] text-[#546E7A]">{g.quarter} • {g.teacher_name ? `Teacher ${g.teacher_name.split(' ')[0]}` : ''}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-[#004D40]">{g.score}/{g.total}</div>
                          <div className={`text-[11px] font-semibold ${pct >= 75 ? 'text-green-600' : 'text-red-600'}`}>{pct}%{g.remarks ? ` • ${g.remarks}` : ''}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Announcements moved to top */}
          </>
        )}
      </main>

      <button onClick={() => setShowChat(true)} className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-[#00838F] text-white shadow-lg flex items-center justify-center hover:brightness-105" title="Messages">
        <MessageSquare className="w-6 h-6" />
      </button>
      <ChatModal open={showChat} onClose={() => setShowChat(false)} me={chatMe} mode="parent" />
    </div>
  );
}

function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-2xl shadow-md p-4 sm:p-5 ${className}`}>{children}</div>;
}
function SectionBar({ icon: Icon, label }) {
  return <div className="bg-[#006064] rounded-xl px-4 py-2.5 flex items-center gap-2 text-white font-bold text-sm"><Icon className="w-4 h-4" /> {label}</div>;
}
function Avatar({ name, src, size = 'w-8 h-8' }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  if (src) return <img src={src} alt={name} className={`${size} rounded-full object-cover shrink-0`} />;
  return <div className={`${size} rounded-full bg-[#B2EBF2] flex items-center justify-center text-[#006064] text-sm font-semibold shrink-0`}>{initials}</div>;
}
function StatBox({ label, value, color }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-center">
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}