import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { printHTML } from '@/lib/print';
import ChatModal from '@/components/kp/ChatModal';
import BadgeModal from '@/components/kp/BadgeModal';
import BadgeMedal, { BADGE_TYPES } from '@/components/kp/BadgeMedal';
import {
  Award, Plus, Trash2, BookOpen, ClipboardList, Calendar, X, BadgeCheck,
  ChevronRight, Save, Loader2, School as SchoolIcon, GraduationCap, Eye, EyeOff, Printer, MessageSquare, History, ClipboardCheck
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const DEFAULT_ACTIVITIES = ['Quiz', 'Summative Test', 'Activity', 'Project', 'Exam', 'Assignment'];
function loadActivities() {
  try { return [...new Set([...DEFAULT_ACTIVITIES, ...JSON.parse(localStorage.getItem('kp_custom_activities') || '[]')])]; } catch { return DEFAULT_ACTIVITIES; }
}
function saveActivity(a) {
  if (!a) return;
  const custom = JSON.parse(localStorage.getItem('kp_custom_activities') || '[]');
  if (!DEFAULT_ACTIVITIES.includes(a) && !custom.includes(a)) { custom.push(a); localStorage.setItem('kp_custom_activities', JSON.stringify(custom)); }
}

export default function StudentProfileView({ student, school, classInfo, teacher, subjectName, onClose }) {
  const [tab, setTab] = useState('score');
  const [attendance, setAttendance] = useState([]);
  const [grades, setGrades] = useState([]);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState('');
  const [activities, setActivities] = useState(loadActivities);
  const [score, setScore] = useState('');
  const [total, setTotal] = useState(100);
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [saving, setSaving] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showBadge, setShowBadge] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [att, gr, bd] = await Promise.all([
        base44.entities.Attendance.filter({ person_id: student.id }).catch(() => []),
        base44.entities.Grade.filter({ student_id: student.id }).catch(() => []),
        base44.entities.StudentBadge.filter({ student_id: student.id }).catch(() => []),
      ]);
      if (!alive) return;
      bd.sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
      setAttendance(att);
      setGrades(gr);
      setBadges(bd);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [student.id]);

  const present = attendance.filter(a => a.status === 'present').length;
  const absent = attendance.filter(a => a.status === 'absent').length;
  const late = attendance.filter(a => a.status === 'late').length;
  const tot = present + absent + late;
  const rate = tot ? Math.round((present / tot) * 100) : 0;

  const reload = async () => {
    const [att, gr, bd] = await Promise.all([
      base44.entities.Attendance.filter({ person_id: student.id }).catch(() => []),
      base44.entities.Grade.filter({ student_id: student.id }).catch(() => []),
      base44.entities.StudentBadge.filter({ student_id: student.id }).catch(() => []),
    ]);
    bd.sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
    setAttendance(att); setGrades(gr); setBadges(bd);
  };

  const saveScore = async () => {
    if (!activity.trim()) return;
    setSaving(true);
    saveActivity(activity.trim());
    setActivities(loadActivities());
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

  const chatMe = { id: teacher?.id, name: teacher ? `${teacher.first_name} ${teacher.last_name}` : '', email: teacher?.email, role: 'teacher' };

  const printAttendance = () => {
    const rows = attendance.slice().reverse().map(a => {
      const bg = a.status === 'present' ? '#dcfce7' : a.status === 'late' ? '#ffedd5' : '#fee2e2';
      const fg = a.status === 'present' ? '#166534' : a.status === 'late' ? '#9a3412' : '#991b1b';
      return `<tr><td>${a.date || '—'}</td><td>${a.time || '—'}</td><td><span class="badge" style="background:${bg};color:${fg}">${a.status || '—'}</span></td><td>${a.scan_type || ''}</td></tr>`;
    }).join('');
    printHTML(`${student.first_name} ${student.last_name} - Attendance History`,
      `<h1>${student.first_name} ${student.last_name} ${student.suffix || ''}</h1><h2>Attendance History</h2><div class="meta">${classInfo ? `${classInfo.grade_level} - ${classInfo.section}` : ''} • Present: ${present} • Absent: ${absent} • Late: ${late} • Generated ${new Date().toLocaleString()}</div><table><thead><tr><th>Date</th><th>Time</th><th>Status</th><th>Type</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="center">No records</td></tr>'}</tbody></table><div class="footer">KeepPeer School • Confidential</div>`);
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

  return (
    <div className="fixed inset-0 z-[100] kp-dash-bg overflow-y-auto kp-scroll-thin">
      <div className="max-w-md mx-auto p-3 sm:p-5">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium text-[#00838F] hover:underline">
            <ChevronRight className="w-4 h-4 rotate-180" /> Back
          </button>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/70 backdrop-blur shadow flex items-center justify-center text-[#00838F] hover:bg-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-[#E0F7FA] rounded-3xl shadow-lg overflow-hidden border border-white/50">
          {/* Medals + Add Badge */}
          <div className="flex items-center justify-between px-5 pt-5 gap-2">
            <button onClick={() => setShowBadge(true)} className="inline-flex items-center gap-1.5 bg-[#4CAF50] text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm hover:brightness-105">
              <Plus className="w-3.5 h-3.5" /> Add Badge
            </button>
            <div className="flex gap-1.5">
              {badges.length > 0 ? badges.slice(0, 5).map(b => (
                <div key={b.id} className="w-11 h-11" title={BADGE_TYPES[b.badge_type]?.label}><BadgeMedal type={b.badge_type} size={44} showLabel={false} /></div>
              )) : [1, 2, 3, 4, 5].map(i => (
                <div key={i} className={`w-10 h-10 rounded-full flex items-center justify-center ${i <= Math.ceil(rate / 20) ? 'bg-yellow-100 text-yellow-500 ring-1 ring-yellow-300' : 'bg-white/60 text-gray-300 ring-1 ring-gray-200'}`}>
                  <Award className="w-5 h-5" />
                </div>
              ))}
            </div>
          </div>

          {/* Name plate */}
          <div className="mt-3 bg-[#00838F] px-5 py-3 flex items-center justify-between gap-2">
            <h2 className="text-white text-lg font-bold leading-tight">{student.first_name} {student.last_name} {student.suffix || ''}</h2>
            {student.parent_email && (
              <button onClick={() => setShowChat(true)} className="text-[11px] font-medium text-white bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-full flex items-center gap-1 shrink-0"><MessageSquare className="w-3.5 h-3.5" /> Parent</button>
            )}
          </div>

          {/* School info */}
          <div className="mx-4 my-3 bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#1565C0] to-[#FFC107] flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
              {school?.logo_url ? <img src={school.logo_url} alt="logo" className="w-full h-full rounded-full object-cover" /> : 'LES'}
            </div>
            <div className="text-xs min-w-0">
              <div className="text-[#2E7D32] font-semibold flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5" /> Enrolled</div>
              <div className="text-[#263238] font-bold truncate">{school?.school_name || 'Labangal Elementary School'}</div>
              <div className="text-[#546E7A]">School Year {school?.academic_year || '2026-2027'}</div>
            </div>
          </div>

          {/* Profile + attendance ring */}
          <div className="px-4 pb-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <Avatar name={`${student.first_name} ${student.last_name}`} src={student.photo_url} size="w-20 h-20" />
                <div className="relative w-24 h-24 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[{ value: present || 1 }]} dataKey="value" innerRadius={34} outerRadius={46} startAngle={-90} endAngle={-90 + (rate / 100) * 360} stroke="none">
                        <Cell fill="#2E7D32" />
                      </Pie>
                      <Pie data={[{ value: 1 }]} dataKey="value" innerRadius={34} outerRadius={46} startAngle={-90 + (rate / 100) * 360} endAngle={270} stroke="none">
                        <Cell fill="#E0F7FA" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-base font-bold text-[#2E7D32] leading-none">{rate}%</div>
                    <div className="text-[9px] text-[#546E7A]">Present</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4">
                <Stat label="Present Days" value={present} color="#2E7D32" />
                <Stat label="Absent Days" value={absent} color="#D32F2F" />
                <Stat label="Late Days" value={late} color="#EF6C00" />
              </div>

              <button onClick={() => setTab('history')} className="mt-3 text-xs font-medium text-[#1976D2] hover:underline flex items-center gap-1 w-full justify-end">
                View Attendance History <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${student.inside_status === 'inside' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  <span className={`w-2 h-2 rounded-full ${student.inside_status === 'inside' ? 'bg-green-500' : 'bg-gray-400'}`} />
                  {student.inside_status === 'inside' ? 'Inside Campus' : 'Outside Campus'}
                </span>
                {subjectName && (
                  <span className="inline-flex items-center gap-1.5 text-[#1976D2] text-sm font-medium">
                    <BookOpen className="w-4 h-4" /> {subjectName}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-4">
            <div className="flex gap-1 bg-[#E0F7FA] rounded-xl p-1">
              <TabBtn active={tab === 'score'} onClick={() => setTab('score')}>Score Board</TabBtn>
              <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>Attendance History</TabBtn>
            </div>
          </div>

          {/* Tab content */}
          <div className="p-4 pt-3">
            {tab === 'score' ? (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardCheck className="w-6 h-6 text-[#2E7D32]" />
                  <h3 className="text-lg font-bold text-[#2E7D32]">Score board</h3>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-[#0F766E] block mb-1">Activity</label>
                    <input list="kp-activities" value={activity} onChange={e => setActivity(e.target.value)} placeholder="Short Quiz" className="w-full px-3 py-2.5 rounded-lg bg-[#F7FCFD] border border-gray-200 text-[#1F2937] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/20" />
                    <datalist id="kp-activities">
                      {activities.map(a => <option key={a} value={a}>{a}</option>)}
                    </datalist>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-sm font-medium text-[#0F766E] block mb-1">Score</label>
                      <input type="number" value={score} onChange={e => setScore(e.target.value)} placeholder="40" className="w-full px-3 py-2.5 rounded-lg bg-[#F7FCFD] border border-gray-200 text-[#1F2937] text-sm" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#0F766E] block mb-1">Total</label>
                      <input type="number" value={total} onChange={e => setTotal(e.target.value)} placeholder="50" className="w-full px-3 py-2.5 rounded-lg bg-[#F7FCFD] border border-gray-200 text-[#1F2937] text-sm" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#0F766E] block mb-1">Date</label>
                      <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-[#F7FCFD] border border-gray-200 text-[#1F2937] text-sm" />
                    </div>
                  </div>
                  <button onClick={saveScore} disabled={saving || !activity} className="w-full py-2.5 rounded-full bg-[#4CAF50] text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Score
                  </button>
                </div>

                <div className="mt-4">
                  {grades.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No scores recorded yet.</p> : (
                    <div className="space-y-2">
                      {grades.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(g => {
                        const pct = g.total ? Math.round((g.score / g.total) * 100) : 0;
                        return (
                          <div key={g.id} className="bg-[#E0F7FA] rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[#004D40] truncate">{g.activity_type || g.subject_name}</div>
                              <div className="text-[11px] text-[#546E7A]">{fmtDate(g.date)}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right">
                                <div className="text-sm font-bold text-[#1F2937]">{g.score}/{g.total}</div>
                                <div className={`text-[10px] font-semibold ${pct >= 90 ? 'text-green-600' : pct >= 75 ? 'text-blue-600' : 'text-orange-600'}`}>{pct}%</div>
                              </div>
                              <button onClick={() => toggleVisible(g)} title={g.visible_to_parent === false ? 'Hidden from parents' : 'Visible to parents'} className={g.visible_to_parent === false ? 'text-gray-300 hover:text-[#0F766E]' : 'text-[#0F766E] hover:text-[#2E7D32]'}>
                                {g.visible_to_parent === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                              <button onClick={() => deleteGrade(g.id)} className="text-[#D32F2F]/70 hover:text-[#D32F2F]"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-6 h-6 text-[#2E7D32]" />
                    <h3 className="text-lg font-bold text-[#2E7D32]">Attendance History</h3>
                  </div>
                  <button onClick={printAttendance} className="text-xs font-medium text-white bg-[#00838F] px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:brightness-105"><Printer className="w-3.5 h-3.5" /> Print</button>
                </div>
                {loading ? <div className="py-6 flex justify-center"><Loader2 className="w-6 h-6 text-[#00838F] animate-spin" /></div> :
                  attendance.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No attendance records yet.</p> :
                  <div className="space-y-2">
                    {attendance.slice().reverse().map(a => (
                      <div key={a.id} className="bg-[#E0F7FA] rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${a.status === 'present' ? 'bg-green-500' : a.status === 'late' ? 'bg-orange-500' : 'bg-red-500'}`} />
                          <span className="text-sm text-[#263238] font-medium">{a.date || '—'}</span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 capitalize">{a.status}</span>
                        </div>
                        <button onClick={() => deleteAtt(a.id)} className="w-7 h-7 rounded-lg border border-red-200 bg-red-50 text-[#D32F2F]/70 hover:bg-red-100 hover:text-[#D32F2F] flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>}
              </div>
            )}
          </div>
        </div>
      </div>

      <ChatModal open={showChat} onClose={() => setShowChat(false)} me={chatMe} mode="teacher" student={student} presetContact={student.parent_email ? { email: student.parent_email, name: student.parent_name || student.parent_email, role: 'parent', sub: `Parent of ${student.first_name} ${student.last_name}` } : null} />
      <BadgeModal open={showBadge} onClose={() => setShowBadge(false)} student={student} teacher={teacher} onAwarded={reload} />
    </div>
  );
}

function Avatar({ name, src, size = 'w-8 h-8' }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  if (src) return <img src={src} alt={name} className={`${size} rounded-full object-cover shrink-0 ring-2 ring-[#B2EBF2]`} />;
  return <div className={`${size} rounded-full bg-[#B2EBF2] flex items-center justify-center text-[#006064] font-semibold shrink-0`}>{initials}</div>;
}
function Stat({ label, value, color }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      <div className="text-[10px] text-gray-400">{label}</div>
    </div>
  );
}
function TabBtn({ active, onClick, children }) {
  return <button onClick={onClick} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${active ? 'bg-[#00838F] text-white shadow' : 'text-[#00838F] hover:bg-white/60'}`}>{children}</button>;
}