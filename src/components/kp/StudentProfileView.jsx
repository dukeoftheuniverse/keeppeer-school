import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Award, Plus, Trash2, BookOpen, ClipboardList, Calendar, X, BadgeCheck,
  ChevronRight, Save, Loader2, School as SchoolIcon, GraduationCap, Eye, EyeOff
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function StudentProfileView({ student, school, classInfo, teacher, subjectName, onClose }) {
  const [tab, setTab] = useState('score');
  const [attendance, setAttendance] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState('');
  const [score, setScore] = useState('');
  const [total, setTotal] = useState(100);
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [att, gr] = await Promise.all([
        base44.entities.Attendance.filter({ person_id: student.id }).catch(() => []),
        base44.entities.Grade.filter({ student_id: student.id }).catch(() => []),
      ]);
      if (!alive) return;
      setAttendance(att);
      setGrades(gr);
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

  const statusColor = (s) => s === 'present' ? 'text-green-600' : s === 'late' ? 'text-orange-500' : 'text-red-500';

  return (
    <div className="fixed inset-0 z-[100] bg-[#E0F7FA] overflow-y-auto kp-scroll-thin">
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium text-[#00838F] hover:underline">
            <ChevronRight className="w-4 h-4 rotate-180" /> Back to Class
          </button>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-[#00838F] hover:bg-gray-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Medals + Add Badge */}
          <div className="flex items-center justify-between px-5 pt-5">
            <button className="inline-flex items-center gap-1.5 bg-[#00C853] text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm hover:brightness-105">
              <Plus className="w-3.5 h-3.5" /> Add Badge
            </button>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className={`w-9 h-9 rounded-full flex items-center justify-center ${i <= Math.ceil(rate / 20) ? 'bg-yellow-100 text-yellow-500 ring-1 ring-yellow-300' : 'bg-gray-100 text-gray-300'}`}>
                  <Award className="w-5 h-5" />
                </div>
              ))}
            </div>
          </div>

          {/* Name plate */}
          <div className="mt-3 bg-[#00838F] px-5 py-3">
            <h2 className="text-white text-lg font-bold">{student.first_name} {student.last_name} {student.suffix || ''}</h2>
          </div>

          {/* School info */}
          <div className="mx-5 my-4 bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#1565C0] to-[#FFC107] flex items-center justify-center text-white font-bold text-sm shrink-0">
              {school?.logo_url ? <img src={school.logo_url} alt="logo" className="w-full h-full rounded-full object-cover" /> : 'LES'}
            </div>
            <div className="text-xs">
              <div className="text-green-600 font-semibold flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5" /> Enrolled</div>
              <div className="text-[#263238] font-medium">{school?.school_name || 'Labangal Elementary School'}</div>
              <div className="text-[#546E7A]">School Year {school?.academic_year || '2026-2027'}</div>
            </div>
          </div>

          {/* Profile + attendance ring */}
          <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="flex flex-col items-center text-center">
              <Avatar name={`${student.first_name} ${student.last_name}`} src={student.photo_url} size="w-24 h-24" />
              <span className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${student.inside_status === 'inside' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                <span className={`w-2 h-2 rounded-full ${student.inside_status === 'inside' ? 'bg-green-500' : 'bg-gray-400'}`} />
                {student.inside_status === 'inside' ? 'Inside Campus' : 'Outside Campus'}
              </span>
              {subjectName && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-[#1976D2] text-sm font-medium">
                  <BookOpen className="w-4 h-4" /> {subjectName}
                </div>
              )}
            </div>

            <div className="flex flex-col items-center">
              <div className="relative w-36 h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{ value: present || 1 }]} dataKey="value" innerRadius={52} outerRadius={72} startAngle={-90} endAngle={-90 + (rate / 100) * 360} stroke="none">
                      <Cell fill="#009624" />
                    </Pie>
                    <Pie data={[{ value: 1 }]} dataKey="value" innerRadius={52} outerRadius={72} startAngle={-90 + (rate / 100) * 360} endAngle={270} stroke="none">
                      <Cell fill="#E0F7FA" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-2xl font-bold text-[#009624] leading-none">{rate}%</div>
                  <div className="text-[10px] text-[#546E7A]">Present</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 w-full mt-3">
                <Stat label="Present Days" value={present} color="#009624" />
                <Stat label="Absent Days" value={absent} color="#CC2424" />
                <Stat label="Late Days" value={late} color="#F29339" />
              </div>
              <button className="mt-2 text-xs font-medium text-[#1976D2] hover:underline flex items-center gap-1">View Attendance History <ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-5">
            <div className="flex gap-1 bg-[#E0F7FA]/60 rounded-xl p-1 w-fit">
              <TabBtn active={tab === 'score'} onClick={() => setTab('score')} icon={ClipboardList}>Score Board</TabBtn>
              <TabBtn active={tab === 'history'} onClick={() => setTab('history')} icon={ClipboardList}>Attendance History</TabBtn>
            </div>
          </div>

          {/* Tab content */}
          <div className="p-5">
            {tab === 'score' ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList className="w-7 h-7 text-[#16A34A]" />
                  <h3 className="text-2xl font-bold text-[#16A34A]">Score board</h3>
                </div>

                <div className="bg-[#E8F9FB] rounded-2xl p-4 space-y-3">
                  <div>
                    <label className="text-sm font-medium text-[#0F766E] block mb-1">Activity</label>
                    <select value={activity} onChange={e => setActivity(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-[#1F2937] text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                      <option value="">Select activity...</option>
                      <option>Quiz</option>
                      <option>Summative Test</option>
                      <option>Activity</option>
                      <option>Project</option>
                      <option>Exam</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-sm font-medium text-[#0F766E] block mb-1">Score</label>
                      <input type="number" value={score} onChange={e => setScore(e.target.value)} placeholder="40" className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-[#1F2937] text-sm" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#0F766E] block mb-1">Total</label>
                      <input type="number" value={total} onChange={e => setTotal(e.target.value)} placeholder="50" className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-[#1F2937] text-sm" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-[#0F766E] block mb-1">Date</label>
                      <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-[#1F2937] text-sm" />
                    </div>
                  </div>
                  <button onClick={saveScore} disabled={saving || !activity} className="w-full py-2.5 rounded-full bg-[#16A34A] text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-1.5">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Score
                  </button>
                </div>

                <div className="mt-4 space-y-2.5">
                  {grades.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No scores recorded yet.</p> :
                    grades.map(g => (
                      <div key={g.id} className="bg-[#CBEAF4] rounded-xl px-4 py-3 flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-[#1E3A8A] truncate">{g.activity_type || g.subject_name}</div>
                          <div className="text-xs text-[#374151]">{g.date ? new Date(g.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}</div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-bold text-[#1F2937]">{g.score}/{g.total}</span>
                          <button onClick={() => toggleVisible(g)} title={g.visible_to_parent === false ? 'Hidden from parents' : 'Visible to parents'} className={`hover:text-[#0F766E] ${g.visible_to_parent === false ? 'text-gray-300' : 'text-[#0F766E]'}`}>
                            {g.visible_to_parent === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button onClick={() => deleteGrade(g.id)} className="text-[#6B7280] hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-bold text-[#004D40] mb-3 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-[#00838F]" /> Attendance History</h3>
                {loading ? <div className="py-6 flex justify-center"><Loader2 className="w-6 h-6 text-[#00838F] animate-spin" /></div> :
                  attendance.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No attendance records yet.</p> :
                  <div className="space-y-2">
                    {attendance.slice().reverse().map(a => (
                      <div key={a.id} className="bg-[#E0F7FA] rounded-xl px-3 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full ${a.status === 'present' ? 'bg-green-500' : a.status === 'late' ? 'bg-orange-500' : 'bg-red-500'}`} />
                          <span className="text-sm text-[#263238] font-medium">{a.date || '—'}</span>
                          <span className={`text-sm font-semibold capitalize ${statusColor(a.status)}`}>{a.status}</span>
                          {a.time && <span className="text-[11px] text-[#546E7A]">{a.time}</span>}
                        </div>
                        <button onClick={() => deleteAtt(a.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, src, size = 'w-8 h-8' }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  if (src) return <img src={src} alt={name} className={`${size} rounded-full object-cover shrink-0`} />;
  return <div className={`${size} rounded-full bg-[#B2EBF2] flex items-center justify-center text-[#006064] font-semibold shrink-0`}>{initials}</div>;
}
function Stat({ label, value, color }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      <div className="text-[10px] text-gray-400">{label}</div>
    </div>
  );
}
function TabBtn({ active, onClick, icon: Icon, children }) {
  return <button onClick={onClick} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all ${active ? 'bg-[#00838F] text-white' : 'text-[#00838F]'}`}><Icon className="w-4 h-4" /> {children}</button>;
}