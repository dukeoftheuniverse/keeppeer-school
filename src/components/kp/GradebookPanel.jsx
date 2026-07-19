import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { logAudit } from '@/lib/audit';
import { printHTML } from '@/lib/print';
import {
  Loader2, Save, Plus, Calculator, Printer, Download, ClipboardList, X,
  BookOpen, Lock, Award, ChevronRight, Trash2, Eye, EyeOff
} from 'lucide-react';

const CATEGORIES = ['Written Work', 'Performance Task', 'Quarterly Assessment'];
const ACTIVITY_TYPES = ['Quiz', 'Exam', 'Assignment', 'Project', 'Activity', 'Recitation', 'Performance', 'Quarterly Exam'];
// Category weights (DepEd)
const WEIGHTS = { 'Written Work': 0.3, 'Performance Task': 0.5, 'Quarterly Assessment': 0.2 };
const PASSING = 75;

function catAvg(studentId, subject, category, grades) {
  const recs = grades.filter(g => g.student_id === studentId && g.subject_name === subject && g.category === category);
  if (!recs.length) return null;
  const pcts = recs.map(g => g.total ? (g.score / g.total) * 100 : 0);
  return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
}
function finalGrade(studentId, subject, grades) {
  const w = catAvg(studentId, subject, 'Written Work', grades);
  const p = catAvg(studentId, subject, 'Performance Task', grades);
  const q = catAvg(studentId, subject, 'Quarterly Assessment', grades);
  const parts = [];
  if (w != null) parts.push(w * WEIGHTS['Written Work']);
  if (p != null) parts.push(p * WEIGHTS['Performance Task']);
  if (q != null) parts.push(q * WEIGHTS['Quarterly Assessment']);
  if (!parts.length) return null;
  const totalW = (w != null ? WEIGHTS['Written Work'] : 0) + (p != null ? WEIGHTS['Performance Task'] : 0) + (q != null ? WEIGHTS['Quarterly Assessment'] : 0);
  return Math.round(parts.reduce((a, b) => a + b, 0) / totalW);
}
function remarks(fg) {
  if (fg == null) return { label: 'Incomplete', cls: 'bg-orange-100 text-orange-700' };
  if (fg >= PASSING) return { label: 'Passed', cls: 'bg-green-100 text-green-700' };
  return { label: 'Failed', cls: 'bg-red-100 text-red-700' };
}

export default function GradebookPanel({ classInfo, teacher, role, onStudentClick, sharedStudents }) {
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subject, setSubject] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulk, setBulk] = useState({ category: 'Written Work', activityType: 'Quiz', assessmentName: '', date: new Date().toLocaleDateString('en-CA'), total: 10 });
  const [bulkScores, setBulkScores] = useState({});
  const [form, setForm] = useState({
    student_id: '', category: 'Written Work', activityType: 'Quiz', assessmentName: '', date: new Date().toLocaleDateString('en-CA'), score: '', total: 10,
  });

  const load = async () => {
    if (!classInfo) { setStudents([]); setSubjects([]); setGrades([]); setLoading(false); return; }
    setLoading(true);
    const studs = sharedStudents && sharedStudents.length
      ? sharedStudents
      : (await base44.entities.Student.list().catch(() => [])).filter(s => s.grade === classInfo.grade_level && s.section === classInfo.section && s.enrollment_status === 'enrolled');
    setStudents(studs);
    const [subs, allGrades] = await Promise.all([
      base44.entities.ClassSubject.filter({ class_id: classInfo.id }).catch(() => []),
      base44.entities.Grade.filter({ class_id: classInfo.id }).catch(() => []),
    ]);
    const fullName = teacher ? `${teacher.first_name} ${teacher.last_name}` : '';
    const allowed = role === 'subject'
      ? subs.filter(s => s.teacher_id === teacher?.id || s.teacher_name === fullName)
      : subs;
    const subjList = allowed.map(s => s.subject_name).filter(Boolean);
    setSubjects(subjList);
    setGrades(allGrades);
    setSubject(prev => prev || subjList[0] || '');
    setForm(f => ({ ...f, student_id: f.student_id || studs[0]?.id || '' }));
    setLoading(false);
  };

  useEffect(() => { load(); }, [classInfo?.id, sharedStudents]);

  if (!classInfo) {
    return <div className="kp-panel rounded-2xl p-6 text-center text-sm text-gray-400">Select a class to open the gradebook.</div>;
  }

  const reloadGrades = async () => {
    const allGrades = await base44.entities.Grade.filter({ class_id: classInfo.id }).catch(() => []);
    setGrades(allGrades);
  };

  const saveSingle = async () => {
    if (!form.student_id || !subject || !form.assessmentName.trim()) return;
    setSaving(true);
    const stu = students.find(s => s.id === form.student_id);
    try {
      await base44.entities.Grade.create({
        student_id: form.student_id,
        student_name: `${stu.first_name} ${stu.last_name}`,
        class_id: classInfo.id,
        class_name: `${classInfo.grade_level} - ${classInfo.section}`,
        subject_name: subject,
        category: form.category,
        assessment_name: form.assessmentName.trim(),
        activity_type: form.activityType,
        teacher_id: teacher?.id,
        teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : '',
        quarter: 'Q1',
        score: Number(form.score) || 0,
        total: Number(form.total) || 100,
        date: form.date,
        visible_to_parent: true,
      });
      await logAudit('record_grade', 'Grade', classInfo.id, `${subject} - ${form.category}: ${form.assessmentName} for ${stu.first_name} ${stu.last_name}`);
      setForm(f => ({ ...f, score: '', assessmentName: '' }));
      await reloadGrades();
      setShowForm(false);
    } finally { setSaving(false); }
  };

  const saveBulk = async () => {
    if (!subject || !bulk.assessmentName.trim()) return;
    setSaving(true);
    const recs = students.map(s => {
      const sc = bulkScores[s.id];
      if (sc === '' || sc == null) return null;
      return {
        student_id: s.id,
        student_name: `${s.first_name} ${s.last_name}`,
        class_id: classInfo.id,
        class_name: `${classInfo.grade_level} - ${classInfo.section}`,
        subject_name: subject,
        category: bulk.category,
        assessment_name: bulk.assessmentName.trim(),
        activity_type: bulk.activityType,
        teacher_id: teacher?.id,
        teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : '',
        quarter: 'Q1',
        score: Number(sc) || 0,
        total: Number(bulk.total) || 100,
        date: bulk.date,
        visible_to_parent: true,
      };
    }).filter(Boolean);
    try {
      if (recs.length) await base44.entities.Grade.bulkCreate(recs);
      await logAudit('bulk_record_grades', 'Grade', classInfo.id, `${subject} - ${bulk.category}: ${bulk.assessmentName} for ${recs.length} students`);
      setBulkScores({});
      setBulk(b => ({ ...b, assessmentName: '' }));
      await reloadGrades();
      setShowBulk(false);
    } finally { setSaving(false); }
  };

  const deleteGrade = async (id) => { await base44.entities.Grade.delete(id); await reloadGrades(); };
  const toggleVisible = async (g) => {
    await base44.entities.Grade.update(g.id, { visible_to_parent: g.visible_to_parent === false });
    await reloadGrades();
  };

  const exportCSV = () => {
    const headers = ['Student', ...CATEGORIES, 'Final Grade', 'Remarks'];
    const rows = students.map(s => {
      const fg = finalGrade(s.id, subject, grades);
      const r = remarks(fg);
      return [
        `${s.first_name} ${s.last_name}`,
        catAvg(s.id, subject, 'Written Work', grades) ?? '',
        catAvg(s.id, subject, 'Performance Task', grades) ?? '',
        catAvg(s.id, subject, 'Quarterly Assessment', grades) ?? '',
        fg ?? '',
        r.label,
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Gradebook_${classInfo.grade_level}-${classInfo.section}_${subject || 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printGradebook = () => {
    const rows = students.map(s => {
      const fg = finalGrade(s.id, subject, grades);
      const r = remarks(fg);
      return `<tr><td>${s.last_name}, ${s.first_name}</td><td>${catAvg(s.id, subject, 'Written Work', grades) ?? '—'}</td><td>${catAvg(s.id, subject, 'Performance Task', grades) ?? '—'}</td><td>${catAvg(s.id, subject, 'Quarterly Assessment', grades) ?? '—'}</td><td><b>${fg ?? '—'}</b></td><td>${r.label}</td></tr>`;
    }).join('');
    printHTML(`Gradebook — ${classInfo.grade_level} - ${classInfo.section} (${subject})`,
      `<h1>Gradebook — Grade ${classInfo.grade_level} ${classInfo.section}</h1><h2>${subject}</h2><div class="meta">Quarter: Q1 • Generated ${new Date().toLocaleDateString()}</div><table><thead><tr><th>Student</th><th>Written Work</th><th>Performance Task</th><th>Quarterly Assessment</th><th>Final Grade</th><th>Remarks</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">KeepPeer School • Confidential</div>`);
  };

  return (
    <div className="space-y-4">
      {/* Header + Actions */}
      <div className="kp-panel rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-[hsl(var(--kp-teal))]" />
            <div>
              <h3 className="text-lg font-bold text-[hsl(var(--kp-teal))]">Gradebook — {classInfo.grade_level} - {classInfo.section}</h3>
              <div className="flex items-center gap-1.5 text-xs">
                <span className={`px-2 py-0.5 rounded font-semibold ${role === 'advisory' ? 'bg-[hsl(var(--kp-teal))] text-white' : 'bg-[#FFB300] text-white'}`}>{role === 'advisory' ? 'ADVISORY' : 'SUBJECT'}</span>
                {role === 'subject' && <span className="text-gray-500 flex items-center gap-1"><Lock className="w-3 h-3" /> Assigned subjects only</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={subject} onChange={e => setSubject(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white font-medium text-[hsl(var(--kp-teal))]">
              {subjects.length === 0 && <option value="">No subjects</option>}
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => setShowForm(true)} className="px-3 py-2 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-medium hover:brightness-105 flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add Assessment</button>
            <button onClick={() => setShowBulk(true)} className="px-3 py-2 rounded-lg bg-[hsl(var(--kp-green))] text-white text-sm font-medium hover:brightness-105 flex items-center gap-1.5"><Calculator className="w-4 h-4" /> Bulk Entry</button>
            <button onClick={printGradebook} className="px-3 py-2 rounded-lg bg-gray-50 text-[hsl(var(--kp-teal))] border border-gray-200 text-sm font-medium hover:bg-gray-100 flex items-center gap-1.5"><Printer className="w-4 h-4" /> Print</button>
            <button onClick={exportCSV} className="px-3 py-2 rounded-lg bg-gray-50 text-[hsl(var(--kp-teal))] border border-gray-200 text-sm font-medium hover:bg-gray-100 flex items-center gap-1.5"><Download className="w-4 h-4" /> Export</button>
          </div>
        </div>

        {/* Gradebook table */}
        {loading ? <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-[hsl(var(--kp-teal))] animate-spin" /></div> :
          students.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No enrolled students in this classroom.</p> :
          subjects.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No subjects added to this class yet.</p> : (
            <div className="overflow-x-auto kp-scroll-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400">
                    <th className="text-left py-2 px-2 font-medium">Student Name</th>
                    <th className="text-center py-2 px-2 font-medium">Written Work</th>
                    <th className="text-center py-2 px-2 font-medium">Performance Task</th>
                    <th className="text-center py-2 px-2 font-medium">Quarterly Assessment</th>
                    <th className="text-center py-2 px-2 font-medium">Final Grade</th>
                    <th className="text-center py-2 px-2 font-medium">Remarks</th>
                    <th className="text-center py-2 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => {
                    const fg = finalGrade(s.id, subject, grades);
                    const r = remarks(fg);
                    return (
                      <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-2.5 px-2">
                          <button onClick={() => onStudentClick?.(s)} className="text-sm font-medium text-[hsl(var(--kp-teal))] hover:underline text-left" title="Open score board">{s.first_name} {s.last_name}</button>
                        </td>
                        <td className="text-center py-2.5 px-2 text-sm font-medium text-gray-700">{catAvg(s.id, subject, 'Written Work', grades) ?? '—'}</td>
                        <td className="text-center py-2.5 px-2 text-sm font-medium text-gray-700">{catAvg(s.id, subject, 'Performance Task', grades) ?? '—'}</td>
                        <td className="text-center py-2.5 px-2 text-sm font-medium text-gray-700">{catAvg(s.id, subject, 'Quarterly Assessment', grades) ?? '—'}</td>
                        <td className="text-center py-2.5 px-2"><span className={`text-sm font-bold ${fg == null ? 'text-gray-300' : fg >= PASSING ? 'text-green-600' : 'text-red-600'}`}>{fg ?? '—'}</span></td>
                        <td className="text-center py-2.5 px-2"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${r.cls}`}>{r.label}</span></td>
                        <td className="text-center py-2.5 px-2"><button onClick={() => onStudentClick?.(s)} className="text-[hsl(var(--kp-teal))] hover:bg-[hsl(var(--accent))] p-1.5 rounded-lg" title="View score board"><ChevronRight className="w-4 h-4" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Add Assessment modal */}
      {showForm && (
        <Modal title="Record a Score" onClose={() => setShowForm(false)} icon={Plus}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Student">
              <select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} className="kp-input">
                <option value="">Select student</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
              </select>
            </Field>
            <Field label="Subject"><div className="px-3 py-2 rounded-lg bg-gray-50 text-sm font-medium text-[hsl(var(--kp-teal))]">{subject || '—'}</div></Field>
            <Field label="Assessment Type">
              <select value={form.activityType} onChange={e => setForm({ ...form, activityType: e.target.value })} className="kp-input">
                {ACTIVITY_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="kp-input">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Assessment Name"><input value={form.assessmentName} onChange={e => setForm({ ...form, assessmentName: e.target.value })} placeholder="e.g. Quiz 1" className="kp-input" /></Field>
            <Field label="Date"><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="kp-input" /></Field>
            <Field label="Score Obtained"><input type="number" value={form.score} onChange={e => setForm({ ...form, score: e.target.value })} placeholder="8" className="kp-input" /></Field>
            <Field label="Highest Score"><input type="number" value={form.total} onChange={e => setForm({ ...form, total: e.target.value })} placeholder="10" className="kp-input" /></Field>
          </div>
          <button onClick={saveSingle} disabled={saving || !form.student_id || !form.assessmentName.trim()} className="mt-4 w-full py-2.5 rounded-lg bg-[hsl(var(--kp-green))] text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Score
          </button>
        </Modal>
      )}

      {/* Bulk entry modal */}
      {showBulk && (
        <Modal title={`Bulk Score Entry — ${subject}`} onClose={() => setShowBulk(false)} icon={Calculator}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <Field label="Category">
              <select value={bulk.category} onChange={e => setBulk({ ...bulk, category: e.target.value })} className="kp-input">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Assessment Type">
              <select value={bulk.activityType} onChange={e => setBulk({ ...bulk, activityType: e.target.value })} className="kp-input">
                {ACTIVITY_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Assessment Name"><input value={bulk.assessmentName} onChange={e => setBulk({ ...bulk, assessmentName: e.target.value })} placeholder="e.g. Quiz 1" className="kp-input" /></Field>
            <Field label="Highest Score"><input type="number" value={bulk.total} onChange={e => setBulk({ ...bulk, total: e.target.value })} className="kp-input" /></Field>
          </div>
          <Field label="Date"><input type="date" value={bulk.date} onChange={e => setBulk({ ...bulk, date: e.target.value })} className="kp-input mb-3" /></Field>
          <div className="max-h-72 overflow-y-auto kp-scroll-thin space-y-1.5 mb-3">
            {students.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-100">
                <span className="text-sm font-medium text-gray-700 truncate">{s.first_name} {s.last_name}</span>
                <input type="number" value={bulkScores[s.id] ?? ''} onChange={e => setBulkScores(prev => ({ ...prev, [s.id]: e.target.value }))} placeholder={`/${bulk.total}`} className="w-20 px-2 py-1 rounded-md border border-gray-200 text-sm text-center" />
              </div>
            ))}
          </div>
          <button onClick={saveBulk} disabled={saving || !bulk.assessmentName.trim()} className="w-full py-2.5 rounded-lg bg-[hsl(var(--kp-green))] text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save All Scores
          </button>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, icon: Icon, children }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="kp-panel rounded-2xl w-full max-w-lg p-5 relative max-h-[90vh] overflow-y-auto kp-scroll-thin">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[hsl(var(--kp-teal))] flex items-center gap-2"><Icon className="w-5 h-5" /> {title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-[hsl(var(--kp-teal))]"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">{label}</label>{children}</div>;
}