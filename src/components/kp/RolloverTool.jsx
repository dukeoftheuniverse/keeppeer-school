import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, Archive, Calendar } from 'lucide-react';

const promoteGrade = (g) => {
  const m = /(\d+)/.exec(g || ''); if (!m) return g; const n = parseInt(m[1]) + 1; return g.replace(m[1], String(n));
};
const nextYearName = (y) => {
  const m = /(\d{4})\s*-\s*(\d{4})/.exec(y || ''); if (!m) return y; const a = parseInt(m[1]) + 1, b = parseInt(m[2]) + 1; return `${a}-${b}`;
};

export default function RolloverTool({ school, onDone }) {
  const [ays, setAys] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      base44.entities.AcademicYear.list().catch(() => []),
      base44.entities.Class.list().catch(() => []),
      base44.entities.Student.list().catch(() => []),
    ]).then(([a, c, s]) => { setAys(a); setClasses(c); setStudents(s); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const currentYear = school?.academic_year || '2026-2027';
  const nextYear = nextYearName(currentYear);
  const oldClasses = classes.filter(c => c.academic_year === currentYear);
  const enrolledStudents = students.filter(s => s.enrollment_status === 'enrolled' && oldClasses.some(c => c.grade_level === s.grade && c.section === s.section));
  const graduating = oldClasses.length ? enrolledStudents.filter(s => !oldClasses.some(c => promoteGrade(c.grade_level) === c.grade_level && c.section === s.section) && false) : [];
  // students whose promoted grade has no matching new class
  const noNewClass = enrolledStudents.filter(s => !oldClasses.some(c => c.section === s.section && promoteGrade(c.grade_level) === promoteGrade(s.grade)));

  const run = async () => {
    if (!confirm(`Promote all classes and enrolled students from ${currentYear} to ${nextYear}?\n\nThis will:\n• Archive the current academic year\n• Create new promoted classes (Grade N → Grade N+1)\n• Promote and re-enroll students\n\nThis cannot be undone.`)) return;
    setBusy(true); setResult(null);
    try {
      // 1. New academic year + archive current
      const newAY = await base44.entities.AcademicYear.create({
        name: nextYear,
        start_date: `${nextYear.split('-')[0]}-06-01`,
        end_date: `${nextYear.split('-')[1]}-03-31`,
        is_current: true, status: 'active',
      });
      const curAYs = ays.filter(a => a.is_current);
      if (curAYs.length) await base44.entities.AcademicYear.bulkUpdate(curAYs.map(a => ({ id: a.id, is_current: false, status: 'archived' })));

      // 2. Copy + promote classes
      const newClassRecords = oldClasses.map(c => ({
        academic_year: nextYear, academic_year_id: newAY.id,
        grade_level: promoteGrade(c.grade_level), section: c.section,
        adviser_name: c.adviser_name, adviser_id: c.adviser_id, room: c.room,
        capacity: c.capacity, enrolled_count: 0, session: c.session, status: 'active',
      }));
      let newClasses = [];
      if (newClassRecords.length) newClasses = await base44.entities.Class.bulkCreate(newClassRecords);

      // 3. Promote students + new enrollments
      const stuUpdates = [];
      const enrollRecords = [];
      enrolledStudents.forEach(s => {
        const newGrade = promoteGrade(s.grade);
        const newCls = newClasses.find(c => c.grade_level === newGrade && c.section === s.section);
        stuUpdates.push({ id: s.id, grade: newGrade, academic_year_id: newAY.id });
        if (newCls) enrollRecords.push({
          student_id: s.id, student_name: `${s.first_name} ${s.last_name}`,
          class_id: newCls.id, class_name: `${newCls.grade_level} ${newCls.section}`,
          academic_year_id: newAY.id, academic_year_name: nextYear,
          enrollment_date: new Date().toLocaleDateString('en-CA'), status: 'enrolled',
        });
      });
      if (stuUpdates.length) await base44.entities.Student.bulkUpdate(stuUpdates);
      if (enrollRecords.length) await base44.entities.Enrollment.bulkCreate(enrollRecords);

      // 4. Update school academic year
      if (school?.id) await base44.entities.School.update(school.id, { academic_year: nextYear });

      setResult({ classes: newClassRecords.length, students: stuUpdates.length, enrollments: enrollRecords.length, year: nextYear, noClass: stuUpdates.length - enrollRecords.length });
      onDone?.();
      load();
    } catch (e) { setResult({ error: e.message || 'Rollover failed.' }); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-[hsl(var(--kp-teal))] animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2 text-[hsl(var(--kp-teal))]">
        <Calendar className="w-4 h-4" />
        <span className="text-sm font-medium">Academic Year Rollover & Promotion</span>
      </div>
      <p className="text-xs text-gray-500">Each school year's data (classes, enrollments, grades) is stored per academic year. At year-end, run the rollover to archive the old year and copy/promote data into the new year — Grade 1 becomes Grade 2, and so on.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="kp-panel rounded-xl p-3">
          <div className="text-xs text-gray-400">Current Year</div>
          <div className="text-base font-bold text-[hsl(var(--kp-teal))]">{currentYear}</div>
        </div>
        <div className="kp-panel rounded-xl p-3">
          <div className="text-xs text-gray-400">Next Year</div>
          <div className="text-base font-bold text-[hsl(var(--kp-teal))]">{nextYear}</div>
        </div>
        <div className="kp-panel rounded-xl p-3">
          <div className="text-xs text-gray-400">Active Years</div>
          <div className="text-base font-bold text-[hsl(var(--kp-teal))]">{ays.filter(a => a.status === 'active').length}</div>
        </div>
        <div className="kp-panel rounded-xl p-3">
          <div className="text-xs text-gray-400">Classes to copy</div>
          <div className="text-base font-bold text-[hsl(var(--kp-teal))]">{oldClasses.length}</div>
        </div>
        <div className="kp-panel rounded-xl p-3">
          <div className="text-xs text-gray-400">Students to promote</div>
          <div className="text-base font-bold text-[hsl(var(--kp-teal))]">{enrolledStudents.length}</div>
        </div>
        <div className="kp-panel rounded-xl p-3">
          <div className="text-xs text-gray-400">Archived Years</div>
          <div className="text-base font-bold text-[hsl(var(--kp-teal))]">{ays.filter(a => a.status === 'archived').length}</div>
        </div>
      </div>

      {noNewClass.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200 text-xs text-orange-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{noNewClass.length} enrolled student(s) will be promoted but have no matching classroom in the new year (e.g. graduating Grade 6). Their grade is updated but no new enrollment is created.</span>
        </div>
      )}

      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Make sure you've created the new year's classrooms (or let the tool copy them). Old year data remains archived and viewable by switching the academic year filter.</span>
      </div>

      {result && (
        <div className={`p-3 rounded-lg border text-xs flex items-center gap-1.5 ${result.error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
          {result.error ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{result.error || `Rollover complete: ${result.year} • ${result.classes} classes copied, ${result.students} students promoted, ${result.enrollments} enrollments created.${result.noClass ? ` ${result.noClass} had no matching classroom.` : ''}`}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={run} disabled={busy || oldClasses.length === 0} className="px-4 py-2 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-medium hover:brightness-105 disabled:opacity-50 flex items-center gap-1.5">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Promote to {nextYear}
        </button>
      </div>

      {ays.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-[hsl(var(--kp-teal))] mb-2 flex items-center gap-1.5"><Archive className="w-3.5 h-3.5" /> Academic Year Records</div>
          <div className="space-y-1.5">
            {ays.map(a => (
              <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 bg-gray-50/50">
                <div className="text-sm font-medium text-gray-700">{a.name}</div>
                <div className="flex items-center gap-2">
                  {a.is_current && <span className="text-[10px] px-2 py-0.5 rounded bg-[hsl(var(--kp-green))] text-white font-medium">Current</span>}
                  <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${a.status === 'archived' ? 'bg-gray-200 text-gray-500' : 'bg-green-100 text-green-700'}`}>{a.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}