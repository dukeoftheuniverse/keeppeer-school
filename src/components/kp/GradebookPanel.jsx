import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Save, Award, ClipboardList, Lock, Trash2, ListChecks } from 'lucide-react';

const DEFAULT_ACTIVITIES = ['Quiz', 'Summative Test', 'Activity', 'Project', 'Exam', 'Assignment'];
function loadActivities() {
  try {return [...new Set([...DEFAULT_ACTIVITIES, ...JSON.parse(localStorage.getItem('kp_custom_activities') || '[]')])];} catch {return DEFAULT_ACTIVITIES;}
}
function saveActivity(a) {
  if (!a) return;
  const custom = JSON.parse(localStorage.getItem('kp_custom_activities') || '[]');
  if (!DEFAULT_ACTIVITIES.includes(a) && !custom.includes(a)) {custom.push(a);localStorage.setItem('kp_custom_activities', JSON.stringify(custom));}
}

export default function GradebookPanel({ classInfo, teacher, role, onStudentClick }) {
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ student_id: '', subject: '', activity: 'Quiz', score: '', total: 100, date: new Date().toLocaleDateString('en-CA') });
  const [activities, setActivities] = useState(loadActivities);

  const load = async () => {
    if (!classInfo) {setStudents([]);setSubjects([]);setGrades([]);setLoading(false);return;}
    setLoading(true);
    const [allStudents, subs, allGrades] = await Promise.all([
    base44.entities.Student.list().catch(() => []),
    base44.entities.ClassSubject.filter({ class_id: classInfo.id }).catch(() => []),
    base44.entities.Grade.filter({ class_id: classInfo.id }).catch(() => [])]
    );
    const studs = allStudents.filter((s) => s.grade === classInfo.grade_level && s.section === classInfo.section && s.enrollment_status === 'enrolled');
    setStudents(studs);
    const fullName = teacher ? `${teacher.first_name} ${teacher.last_name}` : '';
    const allowed = role === 'subject' ?
    subs.filter((s) => s.teacher_id === teacher?.id || s.teacher_name === fullName) :
    subs;
    const subjList = allowed.map((s) => s.subject_name).filter(Boolean);
    setSubjects(subjList);
    setGrades(allGrades);
    setForm((f) => ({ ...f, student_id: f.student_id || studs[0]?.id || '', subject: f.subject || subjList[0] || '' }));
    setLoading(false);
  };

  useEffect(() => {load();}, [classInfo?.id]);

  if (!classInfo) {
    return <div className="bg-white rounded-2xl shadow-md p-6 text-center text-sm text-gray-400">Select a class to open the gradebook.</div>;
  }

  const avgFor = (studentId, subject) => {
    const recs = grades.filter((g) => g.student_id === studentId && g.subject_name === subject);
    if (!recs.length) return null;
    const pcts = recs.map((g) => g.total ? g.score / g.total * 100 : 0);
    return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  };

  const rowAvg = (studentId) => {
    const vals = subjects.map((s) => avgFor(studentId, s)).filter((v) => v != null);
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  const save = async () => {
    if (!form.student_id || !form.subject || !form.activity) return;
    setSaving(true);
    saveActivity(form.activity);
    setActivities(loadActivities());
    const stu = students.find((s) => s.id === form.student_id);
    await base44.entities.Grade.create({
      student_id: form.student_id,
      student_name: `${stu.first_name} ${stu.last_name}`,
      class_id: classInfo.id,
      class_name: `${classInfo.grade_level} - ${classInfo.section}`,
      subject_name: form.subject,
      activity_type: form.activity,
      teacher_id: teacher?.id,
      teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : '',
      quarter: 'Q1',
      score: Number(form.score) || 0,
      total: Number(form.total) || 100,
      date: form.date,
      visible_to_parent: true
    });
    const allGrades = await base44.entities.Grade.filter({ class_id: classInfo.id }).catch(() => []);
    setGrades(allGrades);
    setForm((f) => ({ ...f, score: '' }));
    setSaving(false);
  };

  const del = async (id) => {
    if (!window.confirm('Delete this score record?')) return;
    await base44.entities.Grade.delete(id);
    const allGrades = await base44.entities.Grade.filter({ class_id: classInfo.id }).catch(() => []);
    setGrades(allGrades);
  };

  const clearAll = async () => {
    if (grades.length === 0) return;
    if (!window.confirm(`Remove all ${grades.length} score records for this class? This cannot be undone.`)) return;
    await base44.entities.Grade.deleteMany({ class_id: classInfo.id });
    setGrades([]);
  };

  const pctColor = (p) => p == null ? 'text-gray-300' : p >= 90 ? 'text-green-600' : p >= 75 ? 'text-[#1E3A8A]' : 'text-red-600';

  return (
    <div className="bg-white rounded-2xl shadow-md p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList className="w-6 h-6 text-[#16A34A]" />
        <div>
          <h3 className="text-lg font-bold text-[hsl(var(--kp-teal))]">Score Records — {classInfo.grade_level} - {classInfo.section}</h3>
          <div className="flex items-center gap-1.5 text-xs">
            <span className={`px-2 py-0.5 rounded font-semibold ${role === 'advisory' ? 'bg-[#00838F] text-white' : 'bg-[#FFB300] text-white'}`}>{role === 'advisory' ? 'ADVISORY' : 'SUBJECT'}</span>
            {role === 'subject' && <span className="text-gray-500 flex items-center gap-1"><Lock className="w-3 h-3" /> You can only enter scores for your assigned subjects</span>}
          </div>
        </div>
      </div>

      {/* Add score form */}
      <div className="bg-[#E8F9FB] rounded-xl p-3 mb-4">
        <div className="text-xs font-semibold text-[#0F766E] mb-2 flex items-center gap-1.5"><Award className="w-3.5 h-3.5" /> Record a Score</div>
        {subjects.length === 0 ?
        <p className="text-xs text-gray-500 py-2">{role === 'subject' ? 'You have no assigned subjects for this class. Ask the admin to assign you, or sync your class.' : 'No subjects added to this classroom yet.'}</p> :

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} className="sm:col-span-2 px-2.5 py-2 rounded-lg border border-gray-200 text-sm bg-white">
              <option value="">Select student</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
            </select>
            <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="px-2.5 py-2 rounded-lg border border-gray-200 text-sm bg-white">
              <option value="">Subject</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input list="kp-activities-gb" value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })} placeholder="Activity" className="px-2.5 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
            <datalist id="kp-activities-gb">
              {activities.map((a) => <option key={a} value={a}>{a}</option>)}
            </datalist>
            <input type="number" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} placeholder="Score" className="px-2.5 py-2 rounded-lg border border-gray-200 text-sm" />
            <input type="number" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} placeholder="Total" className="px-2.5 py-2 rounded-lg border border-gray-200 text-sm" />
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="px-2.5 py-2 rounded-lg border border-gray-200 text-sm col-span-2 sm:col-span-1" />
            <button onClick={save} disabled={saving || !form.student_id || !form.subject} className="sm:col-span-6 px-4 py-2 rounded-full bg-[#16A34A] text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Score
            </button>
          </div>
        }
      </div>

      {/* Matrix */}
      {loading ? <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-[hsl(var(--kp-teal))] animate-spin" /></div> :
      students.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No enrolled students in this classroom.</p> :
      (() => {
        const graded = students.filter((s) => grades.some((g) => g.student_id === s.id));
        if (graded.length === 0) return <p className="text-sm text-gray-400 text-center py-8">No grades recorded yet. Student names appear here once scores are entered.</p>;
        return (
          <div className="overflow-auto kp-scroll-thin">
            





















            
          </div>);

      })()}
      {/* Score Records — list with delete + striped rows */}
      <div className="mt-5">
       <div className="flex items-center justify-between mb-2">
         
         

          
       </div>
       {grades.length === 0 ?
        <p className="text-sm text-gray-400 text-center py-6">No score records yet.</p> :

        <div className="overflow-auto kp-scroll-thin max-h-[340px] rounded-xl border border-[#B2EBF2]/60">
           <table className="w-full text-sm">
             <thead className="sticky top-0 z-10">
               <tr className="bg-[#00838F] text-white">
                 <th className="text-left py-2 px-3 font-medium text-xs">Student</th>
                 <th className="text-left py-2 px-3 font-medium text-xs">Subject</th>
                 <th className="text-left py-2 px-3 font-medium text-xs">Activity</th>
                 <th className="text-center py-2 px-3 font-medium text-xs">Score</th>
                 <th className="text-center py-2 px-3 font-medium text-xs">%</th>
                 <th className="text-left py-2 px-3 font-medium text-xs">Date</th>
                 <th className="text-center py-2 px-3 font-medium text-xs w-10"></th>
               </tr>
             </thead>
             <tbody>
               {grades.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((g, i) => {
                const pct = g.total ? Math.round(g.score / g.total * 100) : 0;
                return (
                  <tr key={g.id} className={`border-b border-[#B2EBF2]/30 ${i % 2 === 0 ? 'bg-[#E0F7FA]/60' : 'bg-white/70'}`}>
                     <td className="py-2 px-3 font-medium text-[hsl(var(--kp-teal))] truncate">{g.student_name || '—'}</td>
                     <td className="py-2 px-3 text-gray-600 truncate">{g.subject_name || '—'}</td>
                     <td className="py-2 px-3 text-gray-500 truncate">{g.activity_type || '—'}</td>
                     <td className="py-2 px-3 text-center font-semibold text-[hsl(var(--kp-teal))]">{g.score}/{g.total}</td>
                     <td className="py-2 px-3 text-center"><span className={`text-xs font-bold ${pctColor(pct)}`}>{pct}%</span></td>
                     <td className="py-2 px-3 text-gray-400 text-xs">{g.date || '—'}</td>
                     <td className="py-2 px-3 text-center">
                       <button onClick={() => del(g.id)} className="text-red-500 hover:bg-red-100 rounded-md p-1" title="Delete record"><Trash2 className="w-3.5 h-3.5" /></button>
                     </td>
                   </tr>);

              })}
             </tbody>
           </table>
         </div>
        }
      </div>
      <div className="text-[11px] text-gray-400 mt-2">Cell values show the average of recorded scores per subject. Detailed per-student scores live in the Score Board (click a student name).</div>
    </div>);

}