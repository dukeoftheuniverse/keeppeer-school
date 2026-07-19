import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import DashHeader from '@/components/kp/DashHeader';
import WeatherMonitor from '@/components/kp/WeatherMonitor';
import AnnouncementList from '@/components/kp/AnnouncementList';
import AnnouncementModal from '@/components/kp/AnnouncementModal';
import StudentProfileView from '@/components/kp/StudentProfileView';
import ManageClassModal from '@/components/kp/ManageClassModal';
import AddStudentModal from '@/components/kp/AddStudentModal';
import { logAudit } from '@/lib/audit';
import {
  ClipboardList, GraduationCap, BookOpen, FlaskConical, Coffee, Calculator, Home as HomeIcon,
  UserCheck, UserX, Clock, Plus, Save, Calendar, Megaphone, Award, ChevronRight, Users,
  CheckCircle2, Loader2, CloudSun, Search
} from 'lucide-react';

const STATUS_OPT = [
  { key: 'present', label: 'Present', color: '#009624', bg: 'bg-green-500' },
  { key: 'late', label: 'Late', color: '#F29339', bg: 'bg-orange-500' },
  { key: 'absent', label: 'Absent', color: '#CC2424', bg: 'bg-red-500' },
];

function subjectIcon(name = '') {
  const n = name.toLowerCase();
  if (n.includes('science')) return FlaskConical;
  if (n.includes('recess') || n.includes('break')) return Coffee;
  if (n.includes('math')) return Calculator;
  if (n.includes('dismissal') || n.includes('home')) return HomeIcon;
  return BookOpen;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employee, setEmployee] = useState(null);
  const [school, setSchool] = useState(null);
  const [myClasses, setMyClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [todayAtt, setTodayAtt] = useState([]); // today's attendance for selected class
  const [marks, setMarks] = useState({}); // { studentId: 'present'|'late'|'absent' }
  const [expanded, setExpanded] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnModal, setShowAnnModal] = useState(false);
  const [profileStudent, setProfileStudent] = useState(null);
  const [showManageClass, setShowManageClass] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [tab, setTab] = useState('attendance'); // attendance | grades

  // grades state
  const [subjects, setSubjects] = useState([]);
  const [gradeSubject, setGradeSubject] = useState('');
  const [quarter, setQuarter] = useState('Q1');
  const [scores, setScores] = useState({}); // { studentId: { score, total } }
  const [savingGrades, setSavingGrades] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 18 ? 'Good Afternoon' : 'Good Evening';

  const load = useCallback(async () => {
    if (!user?.email && !user?.id) return;
    try {
      const schools = await base44.entities.School.list().catch(() => []);
      setSchool(schools[0] || null);
      const employees = await base44.entities.Employee.list();
      const me = employees.find(e => e.email === user.email || e.user_id === user.id) || null;
      setEmployee(me);
      if (!me) return;

      const fullName = `${me.first_name} ${me.last_name}`;
      const allClasses = await base44.entities.Class.list();
      const mine = allClasses.filter(c => c.adviser_id === me.id || c.adviser_name === fullName);
      setMyClasses(mine);
      if (mine.length) selectClass(mine[0], me);

      const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const allSched = await base44.entities.Schedule.filter({ day: dayName }).catch(() => []);
      setSchedules(allSched.filter(s => s.teacher_id === me.id || s.teacher_name === fullName));

      const anns = await base44.entities.Announcement.list('-created_date', 30).catch(() => []);
      setAnnouncements(anns.filter(a => a.author_id === me.id || a.audience === 'school' || a.audience === 'class'));
    } catch (e) { /* */ }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const selectClass = async (c, meOverride) => {
    const me = meOverride || employee;
    setSelectedClass(c);
    setExpanded(null);
    const allStudents = await base44.entities.Student.list();
    const studs = allStudents.filter(s => s.grade === c.grade_level && s.section === c.section && s.enrollment_status !== 'archived');
    setStudents(studs);
    const today = new Date().toLocaleDateString('en-CA');
    const att = await base44.entities.Attendance.filter({ date: today, grade: c.grade_level, section: c.section }).catch(() => []);
    setTodayAtt(att);
    const m = {};
    att.forEach(a => { if (a.person_type === 'student') m[a.person_id] = a.status; });
    setMarks(m);
    setScores({});
    // subjects for this class/teacher
    const subs = await base44.entities.ClassSubject.filter({ class_id: c.id }).catch(() => []);
    const subjList = subs.length ? subs.map(s => s.subject_name) : (schedulesRef(schedules, c).map(s => s.subject_name));
    setSubjects(subjList.filter(Boolean));
    setGradeSubject(subjList[0] || '');
  };

  const schedulesRef = (scheds, c) => scheds.filter(s => s.class_name?.includes(c.grade_level) && s.class_name?.includes(c.section));

  const present = Object.values(marks).filter(v => v === 'present').length;
  const absent = Object.values(marks).filter(v => v === 'absent').length;
  const late = Object.values(marks).filter(v => v === 'late').length;
  const totalMarked = present + absent + late;

  const handleSaveAttendance = async () => {
    if (!selectedClass) return;
    setSaving(true);
    const today = new Date().toLocaleDateString('en-CA');
    const timeNow = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const toCreate = [];
    const toUpdate = [];
    Object.entries(marks).forEach(([sid, status]) => {
      const existing = todayAtt.find(a => a.person_id === sid);
      const stu = students.find(s => s.id === sid);
      if (existing) toUpdate.push({ id: existing.id, status });
      else if (stu) toCreate.push({
        person_id: sid, person_name: `${stu.first_name} ${stu.last_name}`, person_type: 'student',
        scan_type: 'time_in', status, method: 'manual', date: today, time: timeNow,
        grade: selectedClass.grade_level, section: selectedClass.section,
      });
    });
    try {
      if (toCreate.length) await base44.entities.Attendance.bulkCreate(toCreate);
      if (toUpdate.length) await base44.entities.Attendance.bulkUpdate(toUpdate);
      // update inside_status for present/late
      const insideUpdates = students.filter(s => marks[s.id] === 'present' || marks[s.id] === 'late')
        .map(s => ({ id: s.id, inside_status: 'inside' }));
      if (insideUpdates.length) await base44.entities.Student.bulkUpdate(insideUpdates);
      logAudit('record_attendance', 'Attendance', selectedClass.id, `${selectedClass.grade_level}-${selectedClass.section}: ${toCreate.length} new, ${toUpdate.length} updated`);
      // refresh
      const att = await base44.entities.Attendance.filter({ date: today, grade: selectedClass.grade_level, section: selectedClass.section }).catch(() => []);
      setTodayAtt(att);
    } catch (e) { /* */ }
    finally { setSaving(false); }
  };

  const handleSaveGrades = async () => {
    if (!selectedClass || !gradeSubject) return;
    setSavingGrades(true);
    const today = new Date().toLocaleDateString('en-CA');
    const fullName = employee ? `${employee.first_name} ${employee.last_name}` : '';
    const records = students.map(s => {
      const sc = scores[s.id] || {};
      return {
        student_id: s.id, student_name: `${s.first_name} ${s.last_name}`,
        class_id: selectedClass.id, class_name: `${selectedClass.grade_level} - ${selectedClass.section}`,
        subject_name: gradeSubject, teacher_id: employee?.id, teacher_name: fullName,
        quarter, score: Number(sc.score) || 0, total: Number(sc.total) || 100, date: today,
      };
    }).filter(r => r.score > 0);
    try {
      if (records.length) await base44.entities.Grade.bulkCreate(records);
      logAudit('record_grades', 'Grade', selectedClass.id, `${gradeSubject} - ${records.length} students`);
      setScores({});
    } catch (e) { /* */ }
    finally { setSavingGrades(false); }
  };

  const reloadAnnouncements = () => {
    base44.entities.Announcement.list('-created_date', 30).then(anns => {
      setAnnouncements(anns.filter(a => !employee || a.author_id === employee.id || a.audience === 'school' || a.audience === 'class'));
    }).catch(() => {});
  };

  if (loading) return <div className="bg-[#E0F7FA] min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#00838F] animate-spin" /></div>;

  const teacherName = employee ? `${employee.first_name}` : (user?.full_name?.split(' ')[0] || 'Teacher');

  return (
    <div className="bg-[#E0F7FA] min-h-screen">
      <DashHeader greeting={greeting} name={`Teacher ${teacherName}`} />
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4 pb-10">
        {employee ? (
          <>
            {/* My Classroom */}
            <SectionBar icon={GraduationCap} label="My Classroom" action={
              <button onClick={() => setShowManageClass(true)} className="text-xs font-medium text-white bg-[#00838F] px-2.5 py-1 rounded-lg flex items-center gap-1 hover:brightness-105"><Plus className="w-3.5 h-3.5" /> Add Class</button>
            } />
            {myClasses.length === 0 ? (
              <Card><p className="text-sm text-gray-400 text-center py-6">No advisory classes assigned yet. Contact the administrator.</p></Card>
            ) : (
              <div className="flex gap-3 overflow-x-auto kp-scroll-thin pb-2">
                {myClasses.map((c, idx) => {
                  const count = students.length && selectedClass?.id === c.id ? students.length : c.enrolled_count || 0;
                  const active = selectedClass?.id === c.id;
                  const clsSched = schedules.filter(s => s.class_name?.includes(c.grade_level) && s.class_name?.includes(c.section));
                  const first = clsSched[0];
                  const borderColors = ['border-[#004D5A]', 'border-[#4CAF50]', 'border-[#2196F3]', 'border-[#B71C1C]'];
                  const bc = borderColors[idx % borderColors.length];
                  return (
                    <button key={c.id} onClick={() => selectClass(c)} className={`bg-white rounded-2xl shadow p-4 min-w-[190px] text-left border-2 transition-all ${active ? 'border-[#004D5A] ring-2 ring-[#004D5A]/20' : `${bc} hover:opacity-90`}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#004D40] bg-[#E0F7FA] px-2 py-0.5 rounded">Grade {c.grade_level}</span>
                        <span className={`w-2 h-2 rounded-full ${c.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`} />
                      </div>
                      <div className="text-sm font-bold text-[#004D40] mt-1.5">{c.section}</div>
                      <div className="text-xs text-[#546E7A] mt-1">{count}/{c.capacity || '—'} Students</div>
                      {first && <div className="text-[11px] font-semibold text-[#00838F] mt-1.5 truncate">{first.subject_name}</div>}
                      {first && <div className="text-[11px] text-[#546E7A] flex items-center gap-1"><Clock className="w-3 h-3" /> {first.start_time} - {first.end_time}</div>}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex justify-center mt-2">
              <button onClick={() => setShowManageClass(true)} className="px-5 py-2.5 rounded-lg bg-[#00838F] text-white text-sm font-semibold hover:brightness-105 shadow flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Manage Class
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 bg-white/70 rounded-xl p-1 w-fit">
              <TabBtn active={tab === 'attendance'} onClick={() => setTab('attendance')} icon={ClipboardList}>Attendance</TabBtn>
              <TabBtn active={tab === 'grades'} onClick={() => setTab('grades')} icon={Award}>Grades / Scores</TabBtn>
            </div>

            {tab === 'attendance' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Attendance panel */}
                <Card className="lg:col-span-2">
                  <div className="flex items-center gap-2 mb-1">
                    <ClipboardList className="w-5 h-5 text-[#006064]" />
                    <h3 className="text-base font-bold text-[#004D40]">Attendance</h3>
                  </div>
                  <div className="text-sm font-semibold text-white bg-[#006064] rounded-lg px-3 py-1.5 mb-3">
                    {selectedClass ? `Grade ${selectedClass.grade_level} - ${selectedClass.section}` : 'Select a class'}
                  </div>

                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search student..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm" />
                  </div>

                  <div className="space-y-1.5 max-h-[340px] overflow-y-auto kp-scroll-thin pr-1">
                    {students.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">No students enrolled in this class.</p> :
                      students.filter(s => `${s.first_name} ${s.last_name} ${s.lrn || ''}`.toLowerCase().includes(query.toLowerCase())).map(s => {
                        const mk = marks[s.id];
                        const isExpanded = expanded === s.id;
                        return (
                          <div key={s.id} className="rounded-xl border border-gray-100 overflow-hidden">
                            <button onClick={() => setExpanded(isExpanded ? null : s.id)} className="w-full flex items-center gap-3 p-2.5 hover:bg-gray-50 text-left">
                              <div onClick={(e) => { e.stopPropagation(); setProfileStudent(s); }} className="cursor-pointer rounded-full ring-2 ring-transparent hover:ring-[#00BCD4] transition" title="View profile">
                                <Avatar name={`${s.first_name} ${s.last_name}`} src={s.photo_url} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-[#004D40] truncate">{s.first_name} {s.last_name} {s.suffix || ''}</div>
                                <div className="text-[11px] text-[#546E7A] font-mono">{s.lrn || s.student_id || '—'}</div>
                              </div>
                              <span className={`w-2.5 h-2.5 rounded-full ${mk === 'present' ? 'bg-green-500' : mk === 'late' ? 'bg-orange-500' : mk === 'absent' ? 'bg-red-500' : 'bg-gray-300'}`} />
                              <span className="text-[11px] text-[#546E7A] hidden sm:block">{s.inside_status === 'inside' ? 'Inside the Campus' : 'Outside'}</span>
                            </button>
                            {isExpanded && (
                              <div className="px-3 pb-3 bg-[#E0F7FA]/40">
                                <div className="text-[11px] font-semibold text-[#006064] mb-1.5">Select Attendance Status</div>
                                <div className="flex flex-wrap gap-2">
                                  {STATUS_OPT.map(o => (
                                    <button key={o.key} onClick={() => { setMarks(prev => ({ ...prev, [s.id]: o.key })); setExpanded(null); }}
                                      className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all ${o.bg} ${mk === o.key ? 'ring-2 ring-offset-1 ring-current' : 'opacity-80 hover:opacity-100'}`}>
                                      {o.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button onClick={() => setShowAddStudent(true)} className="px-4 py-2 rounded-lg bg-[#00BCD4] text-white text-sm font-medium hover:brightness-110 flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add Student</button>
                    <button onClick={handleSaveAttendance} disabled={saving} className="px-4 py-2 rounded-lg bg-[#00BCD4] text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 flex items-center gap-1.5">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                    </button>
                  </div>
                </Card>

                {/* Attendance Stats */}
                <Card>
                  <h3 className="text-base font-bold text-[#004D40] mb-3">Attendance Summary</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <StatBox icon={UserCheck} label="Present" value={present} pct={totalMarked ? Math.round(present / totalMarked * 100) : 0} color="#009624" />
                    <StatBox icon={UserX} label="Absent" value={absent} pct={totalMarked ? Math.round(absent / totalMarked * 100) : 0} color="#CC2424" />
                    <StatBox icon={Clock} label="Late" value={late} pct={totalMarked ? Math.round(late / totalMarked * 100) : 0} color="#F29339" />
                  </div>
                  <div className="mt-4 rounded-xl bg-[#E0F7FA] p-3 text-xs text-[#006064]">
                    <div className="font-semibold mb-0.5">{totalMarked}/{students.length} marked today</div>
                    <div className="text-[#546E7A]">{students.length - totalMarked} students remaining.</div>
                  </div>
                  <div className="mt-4">
                    <h4 className="text-sm font-bold text-[#004D40] mb-2 flex items-center gap-1.5"><CloudSun className="w-4 h-4" /> Weather & Safety</h4>
                    <WeatherMonitor compact />
                  </div>
                </Card>
              </div>
            ) : (
              /* Grades tab */
              <Card>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <h3 className="text-base font-bold text-[#004D40] flex items-center gap-2"><Award className="w-5 h-5 text-[#006064]" /> Record Grades / Scores</h3>
                  <div className="flex flex-wrap gap-2">
                    <select value={gradeSubject} onChange={e => setGradeSubject(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                      <option value="">Select subject</option>
                      {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={quarter} onChange={e => setQuarter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                      {['Q1', 'Q2', 'Q3', 'Q4'].map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                  </div>
                </div>
                {students.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">Select a class to record grades.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-xs text-gray-400">
                          <th className="text-left py-2 px-2 font-medium">Student</th>
                          <th className="text-left py-2 px-2 font-medium w-24">Score</th>
                          <th className="text-left py-2 px-2 font-medium w-24">Total</th>
                          <th className="text-left py-2 px-2 font-medium w-28">Equivalent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map(s => {
                          const sc = scores[s.id] || {};
                          const score = Number(sc.score) || 0;
                          const total = Number(sc.total) || 100;
                          const pct = total ? Math.round((score / total) * 100) : 0;
                          return (
                            <tr key={s.id} className="border-b border-gray-50">
                              <td className="py-2 px-2">
                                <div className="flex items-center gap-2">
                                  <Avatar name={`${s.first_name} ${s.last_name}`} src={s.photo_url} size="w-7 h-7" />
                                  <span className="font-medium text-[#004D40]">{s.first_name} {s.last_name}</span>
                                </div>
                              </td>
                              <td className="py-2 px-2"><input type="number" value={sc.score ?? ''} onChange={e => setScores(p => ({ ...p, [s.id]: { ...p[s.id], score: e.target.value, total: p[s.id]?.total || 100 } }))} className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-sm" /></td>
                              <td className="py-2 px-2"><input type="number" value={sc.total ?? ''} placeholder="100" onChange={e => setScores(p => ({ ...p, [s.id]: { ...p[s.id], total: e.target.value, score: p[s.id]?.score || '' } }))} className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-sm" /></td>
                              <td className="py-2 px-2"><span className={`text-xs font-bold ${pct >= 75 ? 'text-green-600' : 'text-red-600'}`}>{pct}%</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="flex justify-end mt-3">
                      <button onClick={handleSaveGrades} disabled={savingGrades || !gradeSubject} className="px-4 py-2 rounded-lg bg-[#00BCD4] text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 flex items-center gap-1.5">
                        {savingGrades ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Grades
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Schedule + Announcements */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <h3 className="text-base font-bold text-[#004D40] mb-3 flex items-center gap-2"><Calendar className="w-5 h-5 text-[#006064]" /> Today's Class Schedule</h3>
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
                              <div className="text-[11px] text-[#546E7A]">{s.class_name || ''} {s.room ? `• Room ${s.room}` : ''}</div>
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
                <h3 className="text-base font-bold text-[#004D40] mb-3 flex items-center gap-2"><Megaphone className="w-5 h-5 text-[#006064]" /> Announcements</h3>
                <AnnouncementList announcements={announcements} onAdd={() => setShowAnnModal(true)} addLabel="Record Announcement" maxHeight="320px" />
              </Card>
            </div>
          </>
        ) : (
          <Card>
            <div className="text-center py-10">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#004D40] mb-1">No teacher profile linked</h3>
              <p className="text-sm text-[#546E7A]">Please contact the administrator to link your employee record, then switch role again.</p>
            </div>
          </Card>
        )}
      </main>

      {profileStudent && (
        <StudentProfileView
          student={profileStudent}
          school={school}
          classInfo={selectedClass}
          teacher={employee}
          subjectName={subjects[0] || gradeSubject || ''}
          onClose={() => setProfileStudent(null)}
        />
      )}

      <ManageClassModal open={showManageClass} onClose={() => setShowManageClass(false)} onCreated={() => load()} teacher={employee} school={school} />
      <AddStudentModal open={showAddStudent} onClose={() => setShowAddStudent(false)} onAdded={() => selectedClass && selectClass(selectedClass)} classInfo={selectedClass} />

      <AnnouncementModal open={showAnnModal} onClose={() => setShowAnnModal(false)} onCreated={reloadAnnouncements} defaultAudience="class" defaultClass={selectedClass ? `${selectedClass.grade_level} - ${selectedClass.section}` : ''} user={user} />
    </div>
  );
}

function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-2xl shadow-md p-4 sm:p-5 ${className}`}>{children}</div>;
}
function SectionBar({ icon: Icon, label, action }) {
  return (
    <div className="bg-[#006064] rounded-xl px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2 text-white font-bold text-sm"><Icon className="w-4 h-4" /> {label}</div>
      {action}
    </div>
  );
}
function TabBtn({ active, onClick, icon: Icon, children }) {
  return <button onClick={onClick} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all ${active ? 'bg-[#004D5A] text-white' : 'text-[#006064]'}`}><Icon className="w-4 h-4" /> {children}</button>;
}
function Avatar({ name, src, size = 'w-8 h-8' }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  if (src) return <img src={src} alt={name} className={`${size} rounded-full object-cover shrink-0`} />;
  return <div className={`${size} rounded-full bg-[#B2EBF2] flex items-center justify-center text-[#006064] text-xs font-semibold shrink-0`}>{initials}</div>;
}
function StatBox({ icon: Icon, label, value, pct, color }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-center">
      <div className="w-9 h-9 rounded-full mx-auto flex items-center justify-center mb-1" style={{ background: `${color}18` }}><Icon className="w-5 h-5" style={{ color }} /></div>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className="text-[10px] font-medium" style={{ color }}>{pct}%</div>
    </div>
  );
}