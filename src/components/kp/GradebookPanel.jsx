import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { printHTML } from '@/lib/print';
import { SearchInput, Pagination, EmptyState, KpSelect, KpButton } from '@/components/kp/ui';
import { Loader2, Save, Award, ClipboardList, Lock, Plus, Upload, Calculator, Printer, Download, Filter, BookOpen } from 'lucide-react';

const ACTIVITIES = ['Quiz', 'Summative Test', 'Activity', 'Project', 'Exam', 'Assignment'];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

// Weights per DepEd K-12 grading components
const WEIGHTS = { written: 0.30, performance: 0.50, quarterly: 0.20 };

function toPct(score, total) { return total ? (score / total) * 100 : 0; }

export default function GradebookPanel({ classInfo, teacher, role, onStudentClick }) {
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [grades, setGrades] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gradeForm, setGradeForm] = useState({ student_id: '', subject: '', activity: 'Quiz', component: 'written', score: '', total: 100, date: new Date().toLocaleDateString('en-CA'), quarter: 'Q1' });
  const [gradeDrawerOpen, setGradeDrawerOpen] = useState(false);
  const [filters, setFilters] = useState({ academicYear: '2026-2027', quarter: 'Q1', gradeLevel: '', section: '', subject: '', teacherId: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editCells, setEditCells] = useState({}); // { studentId: { written, performance, quarterly, attendance, remarks } }

  const load = async () => {
    if (!classInfo) { setStudents([]); setSubjects([]); setGrades([]); setLoading(false); return; }
    setLoading(true);
    const [allStudents, subs, allGrades, emps] = await Promise.all([
      base44.entities.Student.list().catch(() => []),
      base44.entities.ClassSubject.filter({ class_id: classInfo.id }).catch(() => []),
      base44.entities.Grade.filter({ class_id: classInfo.id }).catch(() => []),
      base44.entities.Employee.list().catch(() => []),
    ]);
    const studs = allStudents.filter(s => s.grade === classInfo.grade_level && s.section === classInfo.section && s.enrollment_status === 'enrolled');
    setStudents(studs);
    setTeachers(emps);
    const fullName = teacher ? `${teacher.first_name} ${teacher.last_name}` : '';
    const allowed = role === 'subject'
      ? subs.filter(s => s.teacher_id === teacher?.id || s.teacher_name === fullName)
      : subs;
    const subjList = allowed.map(s => s.subject_name).filter(Boolean);
    setSubjects(subjList);
    setGrades(allGrades);
    setFilters(f => ({ ...f, subject: f.subject || subjList[0] || '', gradeLevel: classInfo.grade_level, section: classInfo.section }));
    setGradeForm(f => ({ ...f, student_id: f.student_id || studs[0]?.id || '', subject: f.subject || subjList[0] || '' }));
    setLoading(false);
  };

  useEffect(() => { load(); }, [classInfo?.id]);

  // Compute per-student component averages for the selected subject/quarter
  const subject = filters.subject || subjects[0] || '';
  const quarter = filters.quarter || 'Q1';

  const componentAvg = (studentId, component) => {
    const recs = grades.filter(g => g.student_id === studentId && g.subject_name === subject && g.quarter === quarter);
    const map = { written: ['Quiz', 'Summative Test', 'Assignment'], performance: ['Activity', 'Project'], quarterly: ['Exam'] };
    const types = map[component];
    const matched = recs.filter(g => types.includes(g.activity_type));
    if (!matched.length) return null;
    const pcts = matched.map(g => toPct(g.score, g.total));
    return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  };

  const attendancePct = (studentId) => {
    // participation proxy: number of recorded activities / 10 capped 100
    const recs = grades.filter(g => g.student_id === studentId && g.subject_name === subject && g.quarter === quarter);
    return recs.length ? Math.min(100, Math.round((recs.length / 10) * 100)) : null;
  };

  const computedGrade = (studentId) => {
    const w = componentAvg(studentId, 'written');
    const p = componentAvg(studentId, 'performance');
    const q = componentAvg(studentId, 'quarterly');
    if (w == null && p == null && q == null) return null;
    const total = (w ?? 0) * WEIGHTS.written + (p ?? 0) * WEIGHTS.performance + (q ?? 0) * WEIGHTS.quarter;
    const weight = (w != null ? WEIGHTS.written : 0) + (p != null ? WEIGHTS.performance : 0) + (q != null ? WEIGHTS.quarter : 0);
    return weight ? Math.round(total / weight) : null;
  };

  const finalGrade = (studentId) => {
    const comp = computedGrade(studentId);
    if (comp == null) return null;
    const att = attendancePct(studentId) ?? 0;
    // attendance contributes as a 5% adjustment
    return Math.round(comp * 0.95 + att * 0.05);
  };

  const remarks = (fg) => {
    if (fg == null) return { label: 'No Grade', cls: 'bg-gray-100 text-gray-500' };
    if (fg >= 90) return { label: 'Outstanding', cls: 'bg-green-100 text-green-700' };
    if (fg >= 85) return { label: 'Very Satisfactory', cls: 'bg-teal-100 text-teal-700' };
    if (fg >= 80) return { label: 'Satisfactory', cls: 'bg-blue-100 text-blue-700' };
    if (fg >= 75) return { label: 'Fair', cls: 'bg-yellow-100 text-yellow-700' };
    return { label: 'Did Not Meet', cls: 'bg-red-100 text-red-700' };
  };

  const filteredStudents = students.filter(s => {
    const name = `${s.first_name} ${s.last_name} ${s.lrn || ''}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });
  const totalPages = Math.ceil(filteredStudents.length / 10) || 1;
  const currentStudents = filteredStudents.slice((page - 1) * 10, page * 10);

  const saveGrade = async () => {
    if (!gradeForm.student_id || !gradeForm.subject || !gradeForm.activity) return;
    setSaving(true);
    const stu = students.find(s => s.id === gradeForm.student_id);
    await base44.entities.Grade.create({
      student_id: gradeForm.student_id,
      student_name: `${stu.first_name} ${stu.last_name}`,
      class_id: classInfo.id,
      class_name: `${classInfo.grade_level} - ${classInfo.section}`,
      subject_name: gradeForm.subject,
      activity_type: gradeForm.activity,
      teacher_id: teacher?.id,
      teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : '',
      quarter: gradeForm.quarter,
      score: Number(gradeForm.score) || 0,
      total: Number(gradeForm.total) || 100,
      date: gradeForm.date,
      visible_to_parent: true,
    });
    const allGrades = await base44.entities.Grade.filter({ class_id: classInfo.id }).catch(() => []);
    setGrades(allGrades);
    setGradeForm(f => ({ ...f, score: '' }));
    setGradeDrawerOpen(false);
    setSaving(false);
  };

  const saveAll = async () => {
    // Persist any edited remarks as Grade records of activity_type 'Remarks' (lightweight persistence)
    setSaving(true);
    try {
      const records = Object.entries(editCells).map(([sid, cell]) => {
        if (!cell.remarks) return null;
        const stu = students.find(s => s.id === sid);
        return {
          student_id: sid, student_name: `${stu.first_name} ${stu.last_name}`,
          class_id: classInfo.id, class_name: `${classInfo.grade_level} - ${classInfo.section}`,
          subject_name: subject, activity_type: 'Remarks', teacher_id: teacher?.id,
          teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : '',
          quarter, score: 0, total: 0, date: new Date().toLocaleDateString('en-CA'),
          remarks: cell.remarks, visible_to_parent: true,
        };
      }).filter(Boolean);
      if (records.length) await base44.entities.Grade.bulkCreate(records);
      setEditCells({});
    } finally { setSaving(false); }
  };

  const computeAll = () => {
    // Trigger re-render by bumping a state; computed values are derived
    setEditCells(prev => ({ ...prev }));
  };

  const importGrades = () => {
    alert('Import Grades: upload a CSV with columns Student LRN, Written Work, Performance Task, Quarterly Assessment, Attendance. (Use the Import tool on the Classes page to bulk-import.)');
  };

  const exportCsv = () => {
    const rows = [['Student Name', 'LRN', 'Subject', 'Quarter', 'Written Work', 'Performance Task', 'Quarterly Assessment', 'Attendance', 'Computed Grade', 'Final Grade', 'Remarks']];
    students.forEach(s => {
      rows.push([
        `${s.first_name} ${s.last_name}`, s.lrn || s.student_id || '', subject, quarter,
        componentAvg(s.id, 'written') ?? '', componentAvg(s.id, 'performance') ?? '', componentAvg(s.id, 'quarterly') ?? '',
        attendancePct(s.id) ?? '', computedGrade(s.id) ?? '', finalGrade(s.id) ?? '', remarks(finalGrade(s.id)).label,
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `gradebook-${classInfo.grade_level}-${classInfo.section}-${subject}-${quarter}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const printGradebook = () => {
    const rows = students.map(s => {
      const w = componentAvg(s.id, 'written') ?? '—';
      const p = componentAvg(s.id, 'performance') ?? '—';
      const q = componentAvg(s.id, 'quarterly') ?? '—';
      const a = attendancePct(s.id) ?? '—';
      const c = computedGrade(s.id) ?? '—';
      const f = finalGrade(s.id) ?? '—';
      const r = remarks(finalGrade(s.id)).label;
      return `<tr><td>${s.last_name}, ${s.first_name}</td><td>${s.lrn || s.student_id || ''}</td><td>${w}</td><td>${p}</td><td>${q}</td><td>${a}</td><td>${c}</td><td>${f}</td><td>${r}</td></tr>`;
    }).join('');
    printHTML(`Gradebook — ${classInfo.grade_level} - ${classInfo.section} (${subject} ${quarter})`,
      `<h1>Gradebook</h1><h2>${classInfo.grade_level} - ${classInfo.section} • ${subject} • ${quarter}</h2><div class="meta">Generated ${new Date().toLocaleString()}</div><table><thead><tr><th>Student</th><th>LRN</th><th>Written</th><th>Performance</th><th>Quarterly</th><th>Attendance</th><th>Computed</th><th>Final</th><th>Remarks</th></tr></thead><tbody>${rows || '<tr><td colspan="9" class="center">No students</td></tr>'}</tbody></table><div class="footer">KeepPeer School • Confidential</div>`);
  };

  if (!classInfo) {
    return <div className="bg-white rounded-2xl shadow-md p-6 text-center text-sm text-gray-400">Select a class to open the gradebook.</div>;
  }

  const pctColor = (p) => p == null ? 'text-gray-300' : p >= 90 ? 'text-green-600' : p >= 75 ? 'text-[#1E3A8A]' : 'text-red-600';

  return (
    <div className="bg-white rounded-2xl shadow-md p-4 sm:p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[hsl(var(--kp-teal))] flex items-center justify-center shrink-0"><BookOpen className="w-5 h-5 text-white" /></div>
          <div>
            <h3 className="text-lg font-bold text-[hsl(var(--kp-teal))]">Gradebook — {classInfo.grade_level} - {classInfo.section}</h3>
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`px-2 py-0.5 rounded font-semibold ${role === 'advisory' ? 'bg-[#00838F] text-white' : 'bg-[#FFB300] text-white'}`}>{role === 'advisory' ? 'ADVISORY' : 'SUBJECT'}</span>
              {role === 'subject' && <span className="text-gray-500 flex items-center gap-1"><Lock className="w-3 h-3" /> Scores limited to your assigned subjects</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col lg:flex-row gap-2 items-stretch lg:items-center bg-[#F0FAFB] rounded-xl p-3 border border-[#B2EBF2]/60 mb-4">
        <Filter className="w-4 h-4 text-[#00838F] hidden lg:block self-center" />
        <KpSelect value={filters.academicYear} onChange={e => setFilters({ ...filters, academicYear: e.target.value })} className="w-32">
          <option>2026-2027</option><option>2025-2026</option><option>2024-2025</option>
        </KpSelect>
        <KpSelect value={quarter} onChange={e => setFilters({ ...filters, quarter: e.target.value })} className="w-24">
          {QUARTERS.map(q => <option key={q}>{q}</option>)}
        </KpSelect>
        <KpSelect value={subject} onChange={e => setFilters({ ...filters, subject: e.target.value })} className="w-40">
          <option value="">All Subjects</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </KpSelect>
        <KpSelect value={filters.teacherId} onChange={e => setFilters({ ...filters, teacherId: e.target.value })} className="w-40">
          <option value="">All Teachers</option>
          {teachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
        </KpSelect>
        <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student..." className="flex-1 min-w-[160px]" />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <KpButton variant="green" onClick={() => setGradeDrawerOpen(true)}><Plus className="w-4 h-4" /> Add Grade</KpButton>
        <KpButton variant="outline" onClick={importGrades}><Upload className="w-4 h-4" /> Import</KpButton>
        <KpButton variant="outline" onClick={computeAll}><Calculator className="w-4 h-4" /> Compute</KpButton>
        <KpButton variant="teal" onClick={saveAll} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Grades</KpButton>
        <KpButton variant="outline" onClick={printGradebook}><Printer className="w-4 h-4" /> Print</KpButton>
        <KpButton variant="outline" onClick={exportCsv}><Download className="w-4 h-4" /> Export</KpButton>
      </div>

      {/* Table */}
      {loading ? <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-[hsl(var(--kp-teal))] animate-spin" /></div> :
        students.length === 0 ? <EmptyState message="No enrolled students in this classroom." /> : (
          <>
            <div className="overflow-x-auto kp-scroll-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400">
                    <th className="text-left py-2 px-2 font-medium">Student Name</th>
                    <th className="text-left py-2 px-2 font-medium hidden md:table-cell">LRN / ID</th>
                    <th className="text-center py-2 px-2 font-medium">Written Work</th>
                    <th className="text-center py-2 px-2 font-medium">Performance Task</th>
                    <th className="text-center py-2 px-2 font-medium">Quarterly Assessment</th>
                    <th className="text-center py-2 px-2 font-medium hidden lg:table-cell">Attendance</th>
                    <th className="text-center py-2 px-2 font-medium">Computed</th>
                    <th className="text-center py-2 px-2 font-medium">Final Grade</th>
                    <th className="text-left py-2 px-2 font-medium hidden md:table-cell">Remarks</th>
                    <th className="text-right py-2 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentStudents.map((s, idx) => {
                    const w = componentAvg(s.id, 'written');
                    const p = componentAvg(s.id, 'performance');
                    const q = componentAvg(s.id, 'quarterly');
                    const a = attendancePct(s.id);
                    const c = computedGrade(s.id);
                    const f = finalGrade(s.id);
                    const r = remarks(f);
                    return (
                      <tr key={s.id} className={`border-b border-gray-50 hover:bg-[#E0F7FA]/40 ${idx % 2 === 1 ? 'bg-[#F0FAFB]/50' : ''}`}>
                        <td className="py-2.5 px-2">
                          <button onClick={() => onStudentClick?.(s)} className="text-sm font-medium text-[hsl(var(--kp-teal))] hover:underline text-left">{s.first_name} {s.last_name}</button>
                        </td>
                        <td className="py-2.5 px-2 text-gray-500 font-mono text-xs hidden md:table-cell">{s.lrn || s.student_id || '—'}</td>
                        <td className="py-2.5 px-2 text-center"><span className={`text-sm font-semibold ${pctColor(w)}`}>{w == null ? '—' : `${w}%`}</span></td>
                        <td className="py-2.5 px-2 text-center"><span className={`text-sm font-semibold ${pctColor(p)}`}>{p == null ? '—' : `${p}%`}</span></td>
                        <td className="py-2.5 px-2 text-center"><span className={`text-sm font-semibold ${pctColor(q)}`}>{q == null ? '—' : `${q}%`}</span></td>
                        <td className="py-2.5 px-2 text-center hidden lg:table-cell"><span className={`text-sm font-semibold ${pctColor(a)}`}>{a == null ? '—' : `${a}%`}</span></td>
                        <td className="py-2.5 px-2 text-center"><span className={`text-sm font-bold ${pctColor(c)}`}>{c == null ? '—' : `${c}%`}</span></td>
                        <td className="py-2.5 px-2 text-center"><span className={`inline-flex items-center justify-center w-9 h-7 rounded-md text-sm font-bold ${f == null ? 'text-gray-300' : r.cls}`}>{f == null ? '—' : f}</span></td>
                        <td className="py-2.5 px-2 hidden md:table-cell">
                          <input value={editCells[s.id]?.remarks || ''} onChange={e => setEditCells(prev => ({ ...prev, [s.id]: { ...prev[s.id], remarks: e.target.value } }))} placeholder={r.label} className="w-full px-2 py-1 rounded-md border border-gray-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[hsl(var(--kp-teal))]/30" />
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <button onClick={() => onStudentClick?.(s)} className="text-xs text-[hsl(var(--kp-teal))] hover:underline">View</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredStudents.length > 0 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
          </>
        )}

      <div className="text-[11px] text-gray-400 mt-2">Component weights: Written Work 30% • Performance Task 50% • Quarterly Assessment 20%. Attendance adjusts the final grade by 5%. Click a student name to open their scoreboard.</div>

      {/* Add Grade drawer (inline panel) */}
      {gradeDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setGradeDrawerOpen(false)} />
          <div className="relative w-full max-w-md h-full bg-white shadow-xl overflow-y-auto kp-scroll-thin p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[hsl(var(--kp-teal))] flex items-center gap-2"><Award className="w-5 h-5" /> Add Grade</h3>
              <button onClick={() => setGradeDrawerOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Student</label>
                <select value={gradeForm.student_id} onChange={e => setGradeForm({ ...gradeForm, student_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                  <option value="">Select student</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Subject</label>
                  <select value={gradeForm.subject} onChange={e => setGradeForm({ ...gradeForm, subject: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Quarter</label>
                  <select value={gradeForm.quarter} onChange={e => setGradeForm({ ...gradeForm, quarter: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                    {QUARTERS.map(q => <option key={q}>{q}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Component / Activity</label>
                  <input list="kp-act-gb" value={gradeForm.activity} onChange={e => setGradeForm({ ...gradeForm, activity: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
                  <datalist id="kp-act-gb">{ACTIVITIES.map(a => <option key={a} value={a}>{a}</option>)}</datalist>
                </div>
                <div>
                  <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Date</label>
                  <input type="date" value={gradeForm.date} onChange={e => setGradeForm({ ...gradeForm, date: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Score</label>
                  <input type="number" value={gradeForm.score} onChange={e => setGradeForm({ ...gradeForm, score: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Total</label>
                  <input type="number" value={gradeForm.total} onChange={e => setGradeForm({ ...gradeForm, total: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <KpButton variant="light" className="flex-1" onClick={() => setGradeDrawerOpen(false)}>Cancel</KpButton>
                <KpButton variant="green" className="flex-1" onClick={saveGrade} disabled={saving || !gradeForm.student_id || !gradeForm.subject}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save</KpButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}