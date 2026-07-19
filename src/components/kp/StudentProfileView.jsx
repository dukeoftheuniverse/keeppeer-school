import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { printHTML } from '@/lib/print';
import ChatModal from '@/components/kp/ChatModal';
import { SearchInput, Pagination, EmptyState, KpSelect, KpButton } from '@/components/kp/ui';
import {
  Award, Plus, Trash2, BookOpen, Calendar, X, BadgeCheck, ChevronRight, Save, Loader2,
  School as SchoolIcon, GraduationCap, Printer, MessageSquare, Trophy, Star, Target,
  ClipboardList, TrendingUp, Users, Medal, Eye, EyeOff, Clock, Filter, Download
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const BADGES = [
  { id: 'perfect_attendance', label: 'Perfect Attendance', icon: Target, color: '#009624' },
  { id: 'top_reader', label: 'Top Reader', icon: BookOpen, color: '#1976D2' },
  { id: 'math_whiz', label: 'Math Whiz', icon: Award, color: '#7B1FA2' },
  { id: 'helper', label: 'Helping Hand', icon: Star, color: '#F29339' },
  { id: 'honor', label: 'Honor Student', icon: Medal, color: '#FFB300' },
  { id: 'leader', label: 'Class Leader', icon: Trophy, color: '#00838F' },
];

const toMin = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmtHours = (mins) => { if (!mins || mins <= 0) return '0h'; const h = Math.floor(mins / 60); const m = Math.round(mins % 60); return m ? `${h}h ${m}m` : `${h}h`; };

export default function StudentProfileView({ student, school, classInfo, teacher, subjectName, onClose }) {
  const [tab, setTab] = useState('score');
  const [attendance, setAttendance] = useState([]);
  const [grades, setGrades] = useState([]);
  const [classStudents, setClassStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState('');
  const [score, setScore] = useState('');
  const [total, setTotal] = useState(100);
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [saving, setSaving] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [badges, setBadges] = useState([]);
  const [attFilters, setAttFilters] = useState({ from: '', to: '', status: 'all' });
  const [attSearch, setAttSearch] = useState('');
  const [attPage, setAttPage] = useState(1);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [att, gr, allStudents] = await Promise.all([
        base44.entities.Attendance.filter({ person_id: student.id }).catch(() => []),
        base44.entities.Grade.filter({ student_id: student.id }).catch(() => []),
        classInfo ? base44.entities.Student.list().catch(() => []) : Promise.resolve([]),
      ]);
      if (!alive) return;
      setAttendance(att);
      setGrades(gr);
      if (classInfo && allStudents.length) {
        setClassStudents(allStudents.filter(s => s.grade === classInfo.grade_level && s.section === classInfo.section && s.enrollment_status !== 'archived'));
      }
      // derive badges from data
      const presentCount = att.filter(a => a.status === 'present').length;
      const derived = [];
      if (presentCount >= 20) derived.push('perfect_attendance');
      if (gr.length >= 10) derived.push('top_reader');
      const avgScore = gr.length ? gr.reduce((s, g) => s + (g.total ? (g.score / g.total) * 100 : 0), 0) / gr.length : 0;
      if (avgScore >= 90) derived.push('honor');
      if (avgScore >= 85) derived.push('math_whiz');
      setBadges([...new Set(derived)]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [student.id]);

  const present = attendance.filter(a => a.status === 'present').length;
  const absent = attendance.filter(a => a.status === 'absent').length;
  const late = attendance.filter(a => a.status === 'late').length;
  const tot = present + absent + late;
  const attRate = tot ? Math.round((present / tot) * 100) : 0;

  // Computed scores
  const academicScore = useMemo(() => {
    if (!grades.length) return 0;
    const pcts = grades.map(g => g.total ? (g.score / g.total) * 100 : 0);
    return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  }, [grades]);
  const attendanceScore = attRate;
  const participationScore = grades.length ? Math.min(100, Math.round((grades.length / 10) * 100)) : 0;
  const behaviorScore = Math.max(0, Math.round((attRate * 0.6) + (academicScore * 0.4)));
  const overallScore = Math.round((academicScore * 0.45 + attendanceScore * 0.2 + participationScore * 0.15 + behaviorScore * 0.2));

  // Rank in class
  const rank = useMemo(() => {
    if (!classStudents.length) return '—';
    const allStudentGrades = classStudents.map(s => {
      // approximate: only this student has grades loaded; others use stored counters
      if (s.id === student.id) return { id: s.id, avg: academicScore };
      return { id: s.id, avg: (s.attendance_present || 0) };
    });
    const sorted = [...allStudentGrades].sort((a, b) => b.avg - a.avg);
    const idx = sorted.findIndex(x => x.id === student.id);
    return idx >= 0 ? `${idx + 1}/${classStudents.length}` : '—';
  }, [classStudents, academicScore, student.id]);

  const recentAchievements = grades.slice(-5).reverse().map(g => ({
    id: g.id,
    title: g.activity_type || g.subject_name || 'Activity',
    detail: `${g.score}/${g.total} • ${g.subject_name || ''}`,
    date: g.date,
  }));

  const reload = async () => {
    const [att, gr] = await Promise.all([
      base44.entities.Attendance.filter({ person_id: student.id }).catch(() => []),
      base44.entities.Grade.filter({ student_id: student.id }).catch(() => []),
    ]);
    setAttendance(att); setGrades(gr);
  };

  const saveScore = async () => {
    if (!activity.trim()) return;
    setSaving(true);
    await base44.entities.Grade.create({
      student_id: student.id,
      student_name: `${student.first_name} ${student.last_name}`,
      class_id: classInfo?.id,
      class_name: classInfo ? `${classInfo.grade_level} - ${classInfo.section}` : '',
      subject_name: subjectName || activity.trim(),
      activity_type: activity.trim(),
      teacher_id: teacher?.id,
      teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : '',
      quarter: 'Q1',
      score: Number(score) || 0,
      total: Number(total) || 100,
      date,
      visible_to_parent: true,
    });
    setActivity(''); setScore(''); setTotal(100);
    await reload();
    setSaving(false);
  };

  const toggleVisible = async (g) => {
    const newVal = g.visible_to_parent === false;
    await base44.entities.Grade.update(g.id, { visible_to_parent: newVal });
    await reload();
  };
  const deleteGrade = async (id) => { await base44.entities.Grade.delete(id); await reload(); };
  const deleteAtt = async (id) => { await base44.entities.Attendance.delete(id); await reload(); };
  const toggleBadge = (b) => setBadges(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);

  const chatMe = { id: teacher?.id, name: teacher ? `${teacher.first_name} ${teacher.last_name}` : '', email: teacher?.email, role: 'teacher' };

  // Build daily attendance rows (morning/afternoon in/out, hours)
  const dailyRows = useMemo(() => {
    const byDate = {};
    attendance.forEach(a => {
      if (!byDate[a.date]) byDate[a.date] = [];
      byDate[a.date].push(a);
    });
    return Object.entries(byDate).map(([date, scans]) => {
      const sorted = scans.slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      const day = date ? new Date(date + 'T00:00').toLocaleDateString('en-US', { weekday: 'long' }) : '—';
      const mornIn = sorted.find(a => a.scan_type === 'time_in' && toMin(a.time) != null && toMin(a.time) < 720);
      const mornOut = sorted.find(a => a.scan_type === 'time_out' && toMin(a.time) != null && toMin(a.time) < 720);
      const aftIn = sorted.find(a => a.scan_type === 'time_in' && toMin(a.time) != null && toMin(a.time) >= 720);
      const aftOut = sorted.find(a => a.scan_type === 'time_out' && toMin(a.time) != null && toMin(a.time) >= 720);
      const inTime = mornIn?.time || aftIn?.time;
      const outTime = mornOut?.time || aftOut?.time;
      let totalMins = 0;
      if (inTime && outTime) totalMins = toMin(outTime) - toMin(inTime);
      else if (sorted.length >= 2) totalMins = toMin(sorted[sorted.length - 1].time) - toMin(sorted[0].time);
      const standardMins = 8 * 60; // 8 hours
      const lateMins = (mornIn || aftIn) ? Math.max(0, (toMin((mornIn || aftIn).time) - (8 * 60 + 0))) : 0;
      const undertimeMins = totalMins > 0 ? Math.max(0, standardMins - totalMins) : 0;
      const overtimeMins = Math.max(0, totalMins - standardMins);
      const status = scans[0].status || (inTime ? 'present' : 'absent');
      return { date, day, mornIn: mornIn?.time || '—', mornOut: mornOut?.time || '—', aftIn: aftIn?.time || '—', aftOut: aftOut?.time || '—', totalHours: fmtHours(totalMins), late: lateMins > 0 ? fmtHours(lateMins) : '—', undertime: undertimeMins > 0 ? fmtHours(undertimeMins) : '—', overtime: overtimeMins > 0 ? fmtHours(overtimeMins) : '—', status, ids: scans.map(s => s.id) };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance]);

  const filteredDaily = dailyRows.filter(r => {
    if (attFilters.from && r.date < attFilters.from) return false;
    if (attFilters.to && r.date > attFilters.to) return false;
    if (attFilters.status !== 'all' && r.status !== attFilters.status) return false;
    return true;
  });
  const attTotalPages = Math.ceil(filteredDaily.length / 10) || 1;
  const attCurrent = filteredDaily.slice((attPage - 1) * 10, attPage * 10);

  const printScoreboard = () => {
    const badgeHtml = badges.map(b => { const bd = BADGES.find(x => x.id === b); return bd ? `<span class="badge">${bd.label}</span>` : ''; }).join(' ');
    printHTML(`${student.first_name} ${student.last_name} - Scoreboard`,
      `<h1>${student.first_name} ${student.last_name}</h1><h2>Student Scoreboard</h2><div class="meta">${classInfo ? `${classInfo.grade_level} - ${classInfo.section}` : ''} • Rank ${rank} • Generated ${new Date().toLocaleString()}</div>
       <table><thead><tr><th>Overall</th><th>Academic</th><th>Attendance</th><th>Participation</th><th>Behavior</th></tr></thead><tbody><tr><td>${overallScore}%</td><td>${academicScore}%</td><td>${attendanceScore}%</td><td>${participationScore}%</td><td>${behaviorScore}%</td></tr></tbody></table>
       <h3>Badges</h3><div>${badgeHtml || 'None'}</div><div class="footer">KeepPeer School • Confidential</div>`);
  };

  const printAttendance = () => {
    const rows = filteredDaily.map(r => `<tr><td>${r.date}</td><td>${r.day}</td><td>${r.mornIn}</td><td>${r.mornOut}</td><td>${r.aftIn}</td><td>${r.aftOut}</td><td>${r.totalHours}</td><td>${r.late}</td><td>${r.status}</td></tr>`).join('');
    printHTML(`${student.first_name} ${student.last_name} - Attendance History`,
      `<h1>${student.first_name} ${student.last_name}</h1><h2>Attendance History</h2><div class="meta">${classInfo ? `${classInfo.grade_level} - ${classInfo.section}` : ''} • Present: ${present} • Absent: ${absent} • Late: ${late}</div><table><thead><tr><th>Date</th><th>Day</th><th>AM In</th><th>AM Out</th><th>PM In</th><th>PM Out</th><th>Hours</th><th>Late</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="9" class="center">No records</td></tr>'}</tbody></table><div class="footer">KeepPeer School • Confidential</div>`);
  };

  const statusColor = (s) => s === 'present' ? 'text-green-600' : s === 'late' ? 'text-orange-500' : 'text-red-500';
  const scoreColor = (p) => p >= 90 ? 'text-green-600' : p >= 75 ? 'text-[#1E3A8A]' : 'text-red-500';

  return (
    <div className="fixed inset-0 z-[100] bg-[#E0F7FA] overflow-y-auto kp-scroll-thin">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium text-[#00838F] hover:underline">
            <ChevronRight className="w-4 h-4 rotate-180" /> Back to Class
          </button>
          <div className="flex items-center gap-2">
            <button onClick={printScoreboard} className="text-xs font-medium text-white bg-[#00838F] px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:brightness-105"><Printer className="w-3.5 h-3.5" /> Print Scoreboard</button>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-[#00838F] hover:bg-gray-50"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header banner */}
          <div className="bg-[#00838F] px-5 py-3 flex items-center justify-between gap-2">
            <h2 className="text-white text-lg font-bold">{student.first_name} {student.last_name} {student.suffix || ''}</h2>
            {student.parent_email && (
              <button onClick={() => setShowChat(true)} className="text-xs font-medium text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full flex items-center gap-1.5 shrink-0"><MessageSquare className="w-3.5 h-3.5" /> Message Parent</button>
            )}
          </div>

          {/* Profile + attendance ring */}
          <div className="px-5 pt-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="flex items-center gap-4">
              <Avatar name={`${student.first_name} ${student.last_name}`} src={student.photo_url} size="w-20 h-20" />
              <div className="min-w-0">
                <div className="text-xs text-gray-500 flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> {classInfo ? `Grade ${classInfo.grade_level} - ${classInfo.section}` : (student.grade || '—')}</div>
                <div className="text-xs text-gray-500 font-mono mt-0.5">{student.lrn || student.student_id || '—'}</div>
                <span className={`mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${student.inside_status === 'inside' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  <span className={`w-2 h-2 rounded-full ${student.inside_status === 'inside' ? 'bg-green-500' : 'bg-gray-400'}`} />
                  {student.inside_status === 'inside' ? 'Inside Campus' : 'Outside Campus'}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{ value: present || 1 }]} dataKey="value" innerRadius={46} outerRadius={64} startAngle={-90} endAngle={-90 + (attRate / 100) * 360} stroke="none">
                      <Cell fill="#009624" />
                    </Pie>
                    <Pie data={[{ value: 1 }]} dataKey="value" innerRadius={46} outerRadius={64} startAngle={-90 + (attRate / 100) * 360} endAngle={270} stroke="none">
                      <Cell fill="#E0F7FA" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-xl font-bold text-[#009624] leading-none">{attRate}%</div>
                  <div className="text-[10px] text-[#546E7A]">Attendance</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 w-full mt-2">
                <Stat label="Present" value={present} color="#009624" />
                <Stat label="Absent" value={absent} color="#CC2424" />
                <Stat label="Late" value={late} color="#F29339" />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-5">
            <div className="flex gap-1 bg-[#E0F7FA]/60 rounded-xl p-1 w-fit">
              <TabBtn active={tab === 'score'} onClick={() => setTab('score')} icon={TrendingUp}>Score Board</TabBtn>
              <TabBtn active={tab === 'history'} onClick={() => setTab('history')} icon={ClipboardList}>Attendance History</TabBtn>
              <TabBtn active={tab === 'record'} onClick={() => setTab('record')} icon={Award}>Record Score</TabBtn>
            </div>
          </div>

          {/* Tab content */}
          <div className="p-5">
            {tab === 'score' && (
              <div className="space-y-4">
                {/* Score grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <ScoreCard label="Overall Score" value={overallScore} color="#00838F" icon={Target} highlight />
                  <ScoreCard label="Academic" value={academicScore} color="#1E3A8A" icon={BookOpen} />
                  <ScoreCard label="Attendance" value={attendanceScore} color="#009624" icon={Calendar} />
                  <ScoreCard label="Participation" value={participationScore} color="#7B1FA2" icon={Users} />
                  <ScoreCard label="Behavior" value={behaviorScore} color="#F29339" icon={BadgeCheck} />
                  <ScoreCard label="Rank in Class" value={rank} color="#FFB300" icon={Trophy} isText />
                  <ScoreCard label="Badges Earned" value={badges.length} color="#16A34A" icon={Medal} />
                  <ScoreCard label="Records" value={grades.length} color="#546E7A" icon={ClipboardList} />
                </div>

                {/* Badges */}
                <div className="bg-[#F0FAFB] rounded-xl p-4 border border-[#B2EBF2]/60">
                  <h4 className="text-sm font-bold text-[#004D40] mb-2 flex items-center gap-2"><Award className="w-4 h-4 text-[#00838F]" /> Badges Earned</h4>
                  <div className="flex flex-wrap gap-2">
                    {BADGES.map(b => {
                      const earned = badges.includes(b.id);
                      const BIcon = b.icon;
                      return (
                        <button key={b.id} onClick={() => toggleBadge(b.id)} title={earned ? 'Click to remove' : 'Click to award'}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${earned ? 'text-white border-transparent shadow-sm' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}
                          style={earned ? { backgroundColor: b.color } : {}}>
                          <BIcon className="w-3.5 h-3.5" /> {b.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Recent achievements */}
                <div>
                  <h4 className="text-sm font-bold text-[#004D40] mb-2 flex items-center gap-2"><Star className="w-4 h-4 text-[#FFB300]" /> Recent Achievements</h4>
                  {recentAchievements.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No scores recorded yet.</p> : (
                    <div className="space-y-2">
                      {recentAchievements.map(a => (
                        <div key={a.id} className="bg-white border border-gray-100 rounded-xl px-4 py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-lg bg-[#E0F7FA] flex items-center justify-center"><Award className="w-4 h-4 text-[#00838F]" /></div><div><div className="text-sm font-semibold text-[#004D40]">{a.title}</div><div className="text-xs text-gray-500">{a.detail}</div></div></div>
                          <span className="text-xs text-gray-400">{a.date}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'history' && (
              <div className="space-y-3">
                {/* Filter bar */}
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-[#F0FAFB] rounded-xl p-3 border border-[#B2EBF2]/60">
                  <Filter className="w-4 h-4 text-[#00838F] hidden sm:block" />
                  <input type="date" value={attFilters.from} onChange={e => setAttFilters({ ...attFilters, from: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
                  <span className="text-gray-400 text-sm self-center">to</span>
                  <input type="date" value={attFilters.to} onChange={e => setAttFilters({ ...attFilters, to: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
                  <KpSelect value={attFilters.status} onChange={e => setAttFilters({ ...attFilters, status: e.target.value })} className="w-36">
                    <option value="all">All Status</option>
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="absent">Absent</option>
                    <option value="excused">Excused</option>
                  </KpSelect>
                  <KpButton variant="outline" onClick={printAttendance} className="self-end sm:self-auto"><Printer className="w-4 h-4" /> Print</KpButton>
                </div>

                {loading ? <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 text-[#00838F] animate-spin" /></div> :
                  filteredDaily.length === 0 ? <EmptyState message="No attendance records for the selected filters." /> : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 text-xs text-gray-400">
                            <th className="text-left py-2 px-2 font-medium">Date</th>
                            <th className="text-left py-2 px-2 font-medium">Day</th>
                            <th className="text-left py-2 px-2 font-medium hidden sm:table-cell">AM In</th>
                            <th className="text-left py-2 px-2 font-medium hidden sm:table-cell">AM Out</th>
                            <th className="text-left py-2 px-2 font-medium hidden sm:table-cell">PM In</th>
                            <th className="text-left py-2 px-2 font-medium hidden sm:table-cell">PM Out</th>
                            <th className="text-left py-2 px-2 font-medium">Total Hours</th>
                            <th className="text-left py-2 px-2 font-medium hidden md:table-cell">Late</th>
                            <th className="text-left py-2 px-2 font-medium hidden lg:table-cell">Undertime</th>
                            <th className="text-left py-2 px-2 font-medium hidden lg:table-cell">Overtime</th>
                            <th className="text-left py-2 px-2 font-medium">Status</th>
                            <th className="text-right py-2 px-2 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attCurrent.map(r => (
                            <tr key={r.date} className="border-b border-gray-50 hover:bg-[#E0F7FA]/40">
                              <td className="py-2 px-2 font-medium text-[#004D40]">{r.date}</td>
                              <td className="py-2 px-2 text-gray-600">{r.day}</td>
                              <td className="py-2 px-2 text-gray-600 hidden sm:table-cell">{r.mornIn}</td>
                              <td className="py-2 px-2 text-gray-600 hidden sm:table-cell">{r.mornOut}</td>
                              <td className="py-2 px-2 text-gray-600 hidden sm:table-cell">{r.aftIn}</td>
                              <td className="py-2 px-2 text-gray-600 hidden sm:table-cell">{r.aftOut}</td>
                              <td className="py-2 px-2 font-medium text-[#00838F]">{r.totalHours}</td>
                              <td className="py-2 px-2 text-gray-600 hidden md:table-cell">{r.late}</td>
                              <td className="py-2 px-2 text-gray-600 hidden lg:table-cell">{r.undertime}</td>
                              <td className="py-2 px-2 text-gray-600 hidden lg:table-cell">{r.overtime}</td>
                              <td className="py-2 px-2"><span className={`text-xs font-semibold capitalize ${statusColor(r.status)}`}>{r.status}</span></td>
                              <td className="py-2 px-2 text-right">
                                <button onClick={() => r.ids.forEach(id => deleteAtt(id))} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {filteredDaily.length > 0 && <Pagination page={attPage} totalPages={attTotalPages} onPageChange={setAttPage} />}
                  </>
                )}
              </div>
            )}

            {tab === 'record' && (
              <div className="bg-[#F0FAFB] rounded-2xl p-4 space-y-3 border border-[#B2EBF2]/60">
                <h4 className="text-sm font-bold text-[#004D40] flex items-center gap-2"><Award className="w-4 h-4 text-[#00838F]" /> Record a Score</h4>
                <div>
                  <label className="text-sm font-medium text-[#0F766E] block mb-1">Activity</label>
                  <input list="kp-activities-spv" value={activity} onChange={e => setActivity(e.target.value)} placeholder="Select or type activity..." className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-[#1F2937] text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                  <datalist id="kp-activities-spv">
                    <option>Quiz</option><option>Summative Test</option><option>Activity</option><option>Project</option><option>Exam</option><option>Assignment</option>
                  </datalist>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-sm font-medium text-[#0F766E] block mb-1">Score</label><input type="number" value={score} onChange={e => setScore(e.target.value)} placeholder="40" className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-[#1F2937] text-sm" /></div>
                  <div><label className="text-sm font-medium text-[#0F766E] block mb-1">Total</label><input type="number" value={total} onChange={e => setTotal(e.target.value)} placeholder="50" className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-[#1F2937] text-sm" /></div>
                  <div><label className="text-sm font-medium text-[#0F766E] block mb-1">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-[#1F2937] text-sm" /></div>
                </div>
                <button onClick={saveScore} disabled={saving || !activity} className="w-full py-2.5 rounded-lg bg-[hsl(var(--kp-green))] text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Score
                </button>

                <div className="mt-3 space-y-2">
                  {grades.length === 0 ? <p className="text-sm text-gray-400 text-center py-2">No scores recorded yet.</p> :
                    grades.slice().reverse().map(g => (
                      <div key={g.id} className="bg-white rounded-xl px-4 py-2.5 border border-gray-100 flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-[#1E3A8A] truncate">{g.activity_type || g.subject_name}</div>
                          <div className="text-xs text-gray-500">{g.date} {g.subject_name ? `• ${g.subject_name}` : ''}</div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-sm font-bold ${scoreColor(g.total ? (g.score / g.total) * 100 : 0)}`}>{g.score}/{g.total}</span>
                          <button onClick={() => toggleVisible(g)} title={g.visible_to_parent === false ? 'Hidden from parents' : 'Visible to parents'} className={g.visible_to_parent === false ? 'text-gray-300' : 'text-[#0F766E]'}>{g.visible_to_parent === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                          <button onClick={() => deleteGrade(g.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ChatModal open={showChat} onClose={() => setShowChat(false)} me={chatMe} mode="teacher" student={student} presetContact={student.parent_email ? { email: student.parent_email, name: student.parent_name || student.parent_email, role: 'parent', sub: `Parent of ${student.first_name} ${student.last_name}` } : null} />
    </div>
  );
}

function Avatar({ name, src, size = 'w-8 h-8' }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  if (src) return <img src={src} alt={name} className={`${size} rounded-full object-cover shrink-0`} />;
  return <div className={`${size} rounded-full bg-[#B2EBF2] flex items-center justify-center text-[#006064] font-semibold shrink-0`}>{initials}</div>;
}
function Stat({ label, value, color }) {
  return (<div className="text-center"><div className="text-lg font-bold" style={{ color }}>{value}</div><div className="text-[10px] text-gray-400">{label}</div></div>);
}
function ScoreCard({ label, value, color, icon: Icon, highlight, isText }) {
  return (
    <div className={`rounded-xl p-3 border ${highlight ? 'bg-[#00838F] text-white border-transparent' : 'bg-white border-gray-100'}`}>
      <div className="flex items-center gap-1.5 mb-1"><Icon className={`w-3.5 h-3.5 ${highlight ? 'text-white' : ''}`} style={highlight ? {} : { color }} /><span className={`text-[10px] ${highlight ? 'text-white/80' : 'text-gray-400'}`}>{label}</span></div>
      <div className={`text-2xl font-bold ${isText ? '' : ''}`} style={highlight ? {} : { color }}>{isText ? value : `${value}%`}</div>
    </div>
  );
}
function TabBtn({ active, onClick, icon: Icon, children }) {
  return <button onClick={onClick} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all ${active ? 'bg-[#00838F] text-white shadow-sm' : 'text-[#00838F] hover:bg-[#E0F7FA]'}`}><Icon className="w-4 h-4" /> {children}</button>;
}