import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import DashHeader from '@/components/kp/DashHeader';
import WeatherMonitor from '@/components/kp/WeatherMonitor';
import AnnouncementList from '@/components/kp/AnnouncementList';
import AnnouncementModal from '@/components/kp/AnnouncementModal';
import StudentProfileView from '@/components/kp/StudentProfileView';
import AddStudentModal from '@/components/kp/AddStudentModal';
import SyncClassModal from '@/components/kp/SyncClassModal';
import ScheduleModal from '@/components/kp/ScheduleModal';
import GradebookPanel from '@/components/kp/GradebookPanel';
import { logAudit } from '@/lib/audit';
import { printHTML } from '@/lib/print';
import ChatModal from '@/components/kp/ChatModal';
import {
  ClipboardList, GraduationCap, BookOpen, FlaskConical, Coffee, Calculator, Home as HomeIcon,
  UserCheck, UserX, Clock, Plus, Save, Calendar, Megaphone, Award, ChevronRight, Users,
  CheckCircle2, Loader2, CloudSun, Search, Printer, MessageSquare } from
'lucide-react';

const STATUS_OPT = [
{ key: 'present', label: 'Present', color: '#009624', bg: 'bg-green-500' },
{ key: 'late', label: 'Late', color: '#F29339', bg: 'bg-orange-500' },
{ key: 'absent', label: 'Absent', color: '#CC2424', bg: 'bg-red-500' }];


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
  const [selectedRole, setSelectedRole] = useState('advisory');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [todayAtt, setTodayAtt] = useState([]); // today's attendance for selected class
  const [marks, setMarks] = useState({}); // { studentId: 'present'|'late'|'absent' }
  const [expanded, setExpanded] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnModal, setShowAnnModal] = useState(false);
  const [profileStudent, setProfileStudent] = useState(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showSyncClass, setShowSyncClass] = useState(false);
  const [showSchedModal, setShowSchedModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
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
      const me = employees.find((e) => e.email === user.email || e.user_id === user.id) || null;
      setEmployee(me);
      if (!me) return;

      const fullName = `${me.first_name} ${me.last_name}`;
      const allClasses = await base44.entities.Class.list();
      const classSubs = await base44.entities.ClassSubject.list().catch(() => []);
      const advisory = allClasses.filter((c) => c.adviser_id === me.id || c.adviser_name === fullName).map((c) => ({ class: c, role: 'advisory' }));
      const subject = [];
      classSubs.forEach((cs) => {
        if (cs.teacher_id === me.id || cs.teacher_name === fullName) {
          const cls = allClasses.find((c) => c.id === cs.class_id);
          if (cls) subject.push({ class: cls, role: 'subject', subjectName: cs.subject_name });
        }
      });
      const map = new Map();
      advisory.forEach((x) => map.set(x.class.id, x));
      subject.forEach((x) => {if (!map.has(x.class.id)) map.set(x.class.id, x);});
      const mine = Array.from(map.values());
      setMyClasses(mine);
      if (mine.length) selectClass(mine[0], me);

      const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const allSched = await base44.entities.Schedule.filter({ day: dayName }).catch(() => []);
      setSchedules(allSched.filter((s) => s.teacher_id === me.id || s.teacher_name === fullName));

      const anns = await base44.entities.Announcement.list('-created_date', 30).catch(() => []);
      setAnnouncements(anns.filter((a) => a.author_id === me.id || a.audience === 'school' || a.audience === 'class'));
    } catch (e) {/* */} finally
    {setLoading(false);}
  }, [user]);

  useEffect(() => {load();}, [load]);

  const selectClass = async (item, meOverride) => {
    const me = meOverride || employee;
    const c = item.class || item;
    const role = item.role || 'advisory';
    setSelectedClass(c);
    setSelectedRole(role);
    setSelectedSubject(item.subjectName || '');
    setExpanded(null);
    const allStudents = await base44.entities.Student.list();
    const studs = allStudents.filter((s) => s.grade === c.grade_level && s.section === c.section && s.enrollment_status !== 'archived');
    setStudents(studs);
    const today = new Date().toLocaleDateString('en-CA');
    const att = await base44.entities.Attendance.filter({ date: today, grade: c.grade_level, section: c.section }).catch(() => []);
    setTodayAtt(att);
    const m = {};
    att.forEach((a) => {if (a.person_type === 'student') m[a.person_id] = a.status;});
    setMarks(m);
    setScores({});
    // subjects for this class/teacher
    const subs = await base44.entities.ClassSubject.filter({ class_id: c.id }).catch(() => []);
    const fullName = me ? `${me.first_name} ${me.last_name}` : '';
    const mySubs = subs.filter((s) => s.teacher_id === me?.id || s.teacher_name === fullName);
    let subjList;
    if (role === 'subject') {
      subjList = item.subjectName ? [item.subjectName] : mySubs.map((s) => s.subject_name);
    } else {
      subjList = subs.length ? subs.map((s) => s.subject_name) : schedulesRef(schedules, c).map((s) => s.subject_name);
    }
    setSubjects(subjList.filter(Boolean));
    setGradeSubject(subjList[0] || '');
    if (role === 'subject') setTab('gradebook');
  };

  const schedulesRef = (scheds, c) => scheds.filter((s) => s.class_name?.includes(c.grade_level) && s.class_name?.includes(c.section));

  const present = Object.values(marks).filter((v) => v === 'present').length;
  const absent = Object.values(marks).filter((v) => v === 'absent').length;
  const late = Object.values(marks).filter((v) => v === 'late').length;
  const totalMarked = present + absent + late;

  const handleSaveAttendance = async () => {
    if (!selectedClass) return;
    setSaving(true);
    const today = new Date().toLocaleDateString('en-CA');
    const timeNow = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const toCreate = [];
    const toUpdate = [];
    Object.entries(marks).forEach(([sid, status]) => {
      const existing = todayAtt.find((a) => a.person_id === sid);
      const stu = students.find((s) => s.id === sid);
      if (existing) toUpdate.push({ id: existing.id, status });else
      if (stu) toCreate.push({
        person_id: sid, person_name: `${stu.first_name} ${stu.last_name}`, person_type: 'student',
        scan_type: 'time_in', status, method: 'manual', date: today, time: timeNow,
        grade: selectedClass.grade_level, section: selectedClass.section
      });
    });
    try {
      if (toCreate.length) await base44.entities.Attendance.bulkCreate(toCreate);
      if (toUpdate.length) await base44.entities.Attendance.bulkUpdate(toUpdate);
      // update inside_status for present/late
      const insideUpdates = students.filter((s) => marks[s.id] === 'present' || marks[s.id] === 'late').
      map((s) => ({ id: s.id, inside_status: 'inside' }));
      if (insideUpdates.length) await base44.entities.Student.bulkUpdate(insideUpdates);
      logAudit('record_attendance', 'Attendance', selectedClass.id, `${selectedClass.grade_level}-${selectedClass.section}: ${toCreate.length} new, ${toUpdate.length} updated`);
      // refresh
      const att = await base44.entities.Attendance.filter({ date: today, grade: selectedClass.grade_level, section: selectedClass.section }).catch(() => []);
      setTodayAtt(att);
    } catch (e) {/* */} finally
    {setSaving(false);}
  };

  const handleSaveGrades = async () => {
    if (!selectedClass || !gradeSubject) return;
    if (!subjects.includes(gradeSubject)) {alert('You are not authorized to record grades for this subject. Only the assigned teacher may record it.');return;}
    setSavingGrades(true);
    const today = new Date().toLocaleDateString('en-CA');
    const fullName = employee ? `${employee.first_name} ${employee.last_name}` : '';
    const records = students.map((s) => {
      const sc = scores[s.id] || {};
      return {
        student_id: s.id, student_name: `${s.first_name} ${s.last_name}`,
        class_id: selectedClass.id, class_name: `${selectedClass.grade_level} - ${selectedClass.section}`,
        subject_name: gradeSubject, teacher_id: employee?.id, teacher_name: fullName,
        quarter, score: Number(sc.score) || 0, total: Number(sc.total) || 100, date: today
      };
    }).filter((r) => r.score > 0);
    try {
      if (records.length) await base44.entities.Grade.bulkCreate(records);
      logAudit('record_grades', 'Grade', selectedClass.id, `${gradeSubject} - ${records.length} students`);
      setScores({});
    } catch (e) {/* */} finally
    {setSavingGrades(false);}
  };

  const printAttendance = () => {
    if (!selectedClass) return;
    const rows = students.map((s) => `<tr><td>${s.last_name}, ${s.first_name}</td><td>${s.lrn || s.student_id || ''}</td><td>${marks[s.id] || '—'}</td><td>${s.inside_status || ''}</td></tr>`).join('');
    printHTML(`Grade ${selectedClass.grade_level} - ${selectedClass.section} Attendance`,
    `<h1>Grade ${selectedClass.grade_level} - ${selectedClass.section}</h1><h2>Daily Attendance</h2><div class="meta">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} • Present: ${present} • Absent: ${absent} • Late: ${late}</div><table><thead><tr><th>Student</th><th>LRN</th><th>Status</th><th>Inside</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">KeepPeer School • Confidential</div>`);
  };

  const chatMe = { id: employee?.id, name: employee ? `${employee.first_name} ${employee.last_name}` : user?.full_name || 'Teacher', email: employee?.email || user?.email, role: 'teacher' };

  const reloadAnnouncements = () => {
    base44.entities.Announcement.list('-created_date', 30).then((anns) => {
      setAnnouncements(anns.filter((a) => !employee || a.author_id === employee.id || a.audience === 'school' || a.audience === 'class'));
    }).catch(() => {});
  };

  const reloadSchedules = () => {
    if (!employee) return;
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const fullName = `${employee.first_name} ${employee.last_name}`;
    base44.entities.Schedule.filter({ day: dayName }).then((all) => {
      setSchedules(all.filter((s) => s.teacher_id === employee.id || s.teacher_name === fullName));
    }).catch(() => {});
  };

  if (loading) return <div className="kp-dash-bg min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#00838F] animate-spin" /></div>;

  const teacherName = employee ? `${employee.first_name}` : user?.full_name?.split(' ')[0] || 'Teacher';

  return (
    <div className="kp-dash-bg min-h-screen">
      <DashHeader greeting={greeting} name={`Teacher ${teacherName}`} />
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4 pb-10">
        {employee ?
        <>
            {/* Today's Class Schedule + Announcements — equal columns, above My Classroom */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-[#004D40] flex items-center gap-2"><Calendar className="w-5 h-5 text-[#006064]" /> Today's Class Schedule</h3>
                  <button onClick={() => setShowSchedModal(true)} className="text-xs font-medium text-white bg-[#00838F] px-2.5 py-1 rounded-lg flex items-center gap-1 hover:brightness-105"><Plus className="w-3.5 h-3.5" /> Add Schedule</button>
                </div>
                {schedules.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">No classes scheduled today.</p> :
              <div className="relative pl-6">
                  <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-[#B2EBF2]" />
                  {schedules.map((s) => {
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
                      </div>);
                })}
                </div>}
              </Card>

              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold text-[#004D40] flex items-center gap-2"><Megaphone className="w-5 h-5 text-[#006064]" /> Announcements</h3>
                  <button onClick={() => setShowAnnModal(true)} className="text-xs font-medium text-white bg-[#00838F] px-2.5 py-1 rounded-lg flex items-center gap-1 hover:brightness-105"><Plus className="w-3.5 h-3.5" /> Record</button>
                </div>
                <AnnouncementList announcements={announcements} maxHeight="240px" />
              </Card>
            </div>

            {/* My Classroom — full width */}
            <div className="space-y-4">
              <SectionBar icon={GraduationCap} label="My Classroom" action={
            <button onClick={() => setShowSyncClass(true)} className="text-xs font-medium text-white bg-[#00838F] px-2.5 py-1 rounded-lg flex items-center gap-1 hover:brightness-105"><CheckCircle2 className="w-3.5 h-3.5" /> Sync Class</button>
            } />
            {myClasses.length === 0 ?
            <Card><p className="text-sm text-gray-400 text-center py-6">No classes linked yet. Use "Sync Class" to link classes you teach or advise.</p></Card> :
            <div className="flex gap-3 overflow-x-auto kp-scroll-thin pb-2">
                {myClasses.map((item, idx) => {
                const c = item.class;
                const role = item.role;
                const count = students.length && selectedClass?.id === c.id ? students.length : c.enrolled_count || 0;
                const active = selectedClass?.id === c.id;
                const clsSched = schedules.filter((s) => s.class_name?.includes(c.grade_level) && s.class_name?.includes(c.section));
                const first = clsSched[0];
                const borderColors = ['border-[#004D5A]', 'border-[#4CAF50]', 'border-[#2196F3]', 'border-[#B71C1C]'];
                const bc = borderColors[idx % borderColors.length];
                return (
                  <button key={c.id} onClick={() => selectClass(item)} className={`rounded-2xl shadow p-4 min-w-[190px] text-left border-2 transition-all text-2xl bg-gray-50 ${active ? 'border-[#004D5A] ring-2 ring-[#004D5A]/20' : `${bc} hover:opacity-90`}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#004D40] bg-[#E0F7FA] px-2 py-0.5 rounded">Grade {c.grade_level}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${role === 'advisory' ? 'bg-[#00838F] text-white' : 'bg-[#FFB300] text-white'}`}>{role === 'advisory' ? 'ADVISORY' : 'SUBJECT'}</span>
                    </div>
                    <div className="text-sm font-bold text-[#004D40] mt-1.5">{c.section}</div>
                    <div className="text-xs text-[#546E7A] mt-1">{count}/{c.capacity || '—'} Students</div>
                    {role === 'subject' && item.subjectName && <div className="text-[11px] font-semibold text-[#FF8F00] mt-1.5 truncate">{item.subjectName}</div>}
                    {first && <div className="text-[11px] font-semibold text-[#00838F] mt-1.5 truncate">{first.subject_name}</div>}
                    {first && <div className="text-[11px] text-[#546E7A] flex items-center gap-1"><Clock className="w-3 h-3" /> {first.start_time} - {first.end_time}</div>}
                    </button>);
              })}
              </div>
            }
            </div>

            {/* Tabs */}
            <div className="kp-wave-tabs rounded-xl p-1.5 inline-flex gap-1 w-fit">
              {selectedRole === 'advisory' &&
            <TabBtn active={tab === 'attendance'} onClick={() => setTab('attendance')} icon={ClipboardList}>Attendance</TabBtn>
            }
              <TabBtn active={tab === 'gradebook'} onClick={() => setTab('gradebook')} icon={Award}>Score Records</TabBtn>
            </div>

            {tab === 'attendance' ?
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Attendance panel */}
                <div className="lg:col-span-2 kp-glass-card rounded-2xl p-4 sm:p-5 flex flex-col">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[hsl(var(--kp-teal))] flex items-center justify-center shrink-0">
                        <ClipboardList className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-[#004D40] leading-tight">Attendance</h3>
                        <div className="text-xs font-semibold text-white bg-[#006064] inline-flex px-2 py-0.5 rounded-md truncate max-w-[220px]">
                          {selectedClass ? `Grade ${selectedClass.grade_level} - ${selectedClass.section}` : 'Select a class'}
                        </div>
                      </div>
                    </div>
                    <div className="relative w-40 sm:w-56 shrink-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search student..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm bg-white/70" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-1 pb-2 text-[10px] font-semibold uppercase tracking-wide text-[#546E7A]">
                    <span className="w-8 shrink-0" />
                    <span className="flex-1">Student</span>
                    <span className="hidden sm:block w-28 text-right">Status</span>
                    <span className="w-2.5" />
                  </div>

                  <div className="space-y-1.5 flex-1 max-h-[360px] overflow-y-auto kp-scroll-thin pr-1">
                    {students.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">No students enrolled in this class.</p> :
                students.filter((s) => `${s.first_name} ${s.last_name} ${s.lrn || ''}`.toLowerCase().includes(query.toLowerCase())).map((s) => {
                  const mk = marks[s.id];
                  const isExpanded = expanded === s.id;
                  return (
                    <div key={s.id} className="rounded-xl border border-gray-100 overflow-hidden bg-white/50">
                            <button onClick={() => setExpanded(isExpanded ? null : s.id)} className="w-full flex items-center gap-3 p-2.5 hover:bg-gray-50 text-left">
                              <div onClick={(e) => {e.stopPropagation();setProfileStudent(s);}} className="cursor-pointer rounded-full ring-2 ring-transparent hover:ring-[#00BCD4] transition" title="View profile">
                                <Avatar name={`${s.first_name} ${s.last_name}`} src={s.photo_url} />
                              </div>
                              <div className="flex-1 min-w-0 cursor-pointer" onClick={(e) => {e.stopPropagation();setProfileStudent(s);}} title="View profile — scoreboard & attendance history">
                                <div className="text-sm font-semibold text-[#004D40] truncate hover:underline decoration-[#00BCD4] decoration-2 underline-offset-2">{s.first_name} {s.last_name} {s.suffix || ''}</div>
                                <div className="text-[11px] text-[#546E7A] font-mono">{s.lrn || s.student_id || '—'}</div>
                              </div>
                              <span className="hidden sm:block text-[11px] text-[#546E7A] w-28 text-right capitalize">{mk || '—'}</span>
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${mk === 'present' ? 'bg-green-500' : mk === 'late' ? 'bg-orange-500' : mk === 'absent' ? 'bg-red-500' : 'bg-gray-300'}`} />
                            </button>
                            {isExpanded &&
                      <div className="px-3 pb-3 bg-[#E0F7FA]/40">
                                <div className="text-[11px] font-semibold text-[#006064] mb-1.5">Select Attendance Status</div>
                                <div className="flex flex-wrap gap-2">
                                  {STATUS_OPT.map((o) =>
                          <button key={o.key} onClick={() => {setMarks((prev) => ({ ...prev, [s.id]: o.key }));setExpanded(null);}}
                          className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all ${o.bg} ${mk === o.key ? 'ring-2 ring-offset-1 ring-current' : 'opacity-80 hover:opacity-100'}`}>
                                      {o.label}
                                    </button>
                          )}
                                </div>
                              </div>
                      }
                          </div>);

                })}
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                    {selectedRole === 'advisory' &&
                <button onClick={() => setShowAddStudent(true)} className="px-4 py-2 rounded-lg bg-[#00BCD4] text-white text-sm font-medium hover:brightness-110 flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add Student</button>
                }
                    <button onClick={printAttendance} disabled={!selectedClass} className="px-4 py-2 rounded-lg bg-white border border-[#00838F] text-[#00838F] text-sm font-medium hover:bg-[#E0F7FA] flex items-center gap-1.5 disabled:opacity-50"><Printer className="w-4 h-4" /> Print</button>
                    <button onClick={handleSaveAttendance} disabled={saving} className="px-4 py-2 rounded-lg bg-[hsl(var(--kp-green))] text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 flex items-center gap-1.5">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                    </button>
                  </div>
                </div>

                {/* Attendance Stats */}
                <div className="kp-glass-card rounded-2xl p-4 sm:p-5 flex flex-col">
                  <h3 className="text-base font-bold text-[#004D40] mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-[#006064]" /> Attendance Summary</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <StatBox icon={UserCheck} label="Present" value={present} pct={totalMarked ? Math.round(present / totalMarked * 100) : 0} color="#009624" />
                    <StatBox icon={UserX} label="Absent" value={absent} pct={totalMarked ? Math.round(absent / totalMarked * 100) : 0} color="#CC2424" />
                    <StatBox icon={Clock} label="Late" value={late} pct={totalMarked ? Math.round(late / totalMarked * 100) : 0} color="#F29339" />
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#009624] via-[#F29339] to-[#CC2424] transition-all" style={{ width: `${students.length ? Math.round(totalMarked / students.length * 100) : 0}%` }} />
                  </div>
                  <div className="mt-2 rounded-xl bg-[#E0F7FA] p-3 text-xs text-[#006064]">
                    <div className="font-semibold mb-0.5">{totalMarked}/{students.length} marked today</div>
                    <div className="text-[#546E7A]">{students.length - totalMarked} students remaining.</div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <h4 className="text-sm font-bold text-[#004D40] mb-2 flex items-center gap-1.5"><CloudSun className="w-4 h-4" /> Weather & Safety</h4>
                    <WeatherMonitor compact />
                  </div>
                </div>
              </div> :

          <GradebookPanel classInfo={selectedClass} teacher={employee} role={selectedRole} onStudentClick={(s) => setProfileStudent(s)} />
          }
          </> :

        <Card>
            <div className="text-center py-10">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#004D40] mb-1">No teacher profile linked</h3>
              <p className="text-sm text-[#546E7A]">Please contact the administrator to link your employee record, then switch role again.</p>
            </div>
          </Card>
        }
      </main>

      {profileStudent &&
      <StudentProfileView
        student={profileStudent}
        school={school}
        classInfo={selectedClass}
        teacher={employee}
        subjectName={subjects[0] || gradeSubject || ''}
        onClose={() => setProfileStudent(null)} />

      }

      <AddStudentModal open={showAddStudent} onClose={() => setShowAddStudent(false)} onAdded={() => selectedClass && selectClass(selectedClass)} classInfo={selectedClass} />
      <SyncClassModal open={showSyncClass} onClose={() => setShowSyncClass(false)} onLinked={() => load()} teacher={employee} />

      <AnnouncementModal open={showAnnModal} onClose={() => setShowAnnModal(false)} onCreated={reloadAnnouncements} defaultAudience="class" defaultClass={selectedClass ? `${selectedClass.grade_level} - ${selectedClass.section}` : ''} user={user} />
      <ScheduleModal open={showSchedModal} onClose={() => setShowSchedModal(false)} onSaved={reloadSchedules} teacher={employee} presetClass={selectedClass} />

      <button onClick={() => setShowChat(true)} className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 h-12 pl-3.5 pr-5 rounded-full bg-[#00838F] text-white shadow-lg hover:brightness-105" title="Messages">
        <MessageSquare className="w-5 h-5" />
        <span className="text-sm font-semibold">Messages</span>
      </button>
      <ChatModal open={showChat} onClose={() => setShowChat(false)} me={chatMe} mode="teacher" />
    </div>);

}

function Card({ children, className = '' }) {
  return <div className={`rounded-2xl shadow-md sm:p-5 py-4 opacity-100 bg-[#9ef5ff] ${className}`}>{children}</div>;
}
function SectionBar({ icon: Icon, label, action }) {
  return (
    <div className="bg-[#006064] rounded-xl px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2 text-white font-bold text-sm"><Icon className="w-4 h-4" /> {label}</div>
      {action}
    </div>);

}
function TabBtn({ active, onClick, icon: Icon, children }) {
  return <button onClick={onClick} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all ${active ? 'bg-white/90 text-[#004D5A] shadow' : 'text-white hover:bg-white/20'}`}><Icon className="w-4 h-4" /> {children}</button>;
}
function Avatar({ name, src, size = 'w-8 h-8' }) {
  const initials = name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
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
    </div>);

}