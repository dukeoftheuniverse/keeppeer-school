import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { PagePanel, PageTitle } from '@/components/kp/ui';
import { Loader2, GraduationCap, Users, RefreshCw, CheckCircle2, BookOpen, AlertCircle, ArrowRight } from 'lucide-react';

export default function ClassroomSync() {
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selCourse, setSelCourse] = useState('');
  const [selClass, setSelClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const loadCourses = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await base44.functions.invoke('syncClassroomRosters', { action: 'listCourses' });
      setCourses(res.data.courses || []);
    } catch (e) { setError('Failed to load Google Classroom courses. Make sure the connection is active.'); }
    finally { setLoading(false); }
  }, []);

  const loadClasses = useCallback(async () => {
    try {
      const cls = await base44.entities.Class.list();
      setClasses(cls.filter(c => c.status === 'active'));
    } catch (e) { /* */ }
  }, []);

  useEffect(() => { loadCourses(); loadClasses(); }, [loadCourses, loadClasses]);

  const selectCourse = async (id) => {
    setSelCourse(id); setStudents([]); setResult(null); setError('');
    if (!id) return;
    setLoadingStudents(true);
    try {
      const res = await base44.functions.invoke('syncClassroomRosters', { action: 'listStudents', courseId: id });
      setStudents(res.data.students || []);
    } catch (e) { setError('Failed to load roster for this course.'); }
    finally { setLoadingStudents(false); }
  };

  const handleSync = async () => {
    if (!selCourse || !selClass) return;
    setSyncing(true); setError(''); setResult(null);
    try {
      const res = await base44.functions.invoke('syncClassroomRosters', { action: 'sync', courseId: selCourse, classId: selClass });
      setResult(res.data);
    } catch (e) { setError('Sync failed. Please try again.'); }
    finally { setSyncing(false); }
  };

  const selCourseObj = courses.find(c => c.id === selCourse);

  return (
    <div className="space-y-4">
      <PageTitle subtitle="Import student rosters from Google Classroom into your KeepPeer classes.">
        Google Classroom Roster Sync
      </PageTitle>

      {error && (
        <div className="kp-panel rounded-xl p-3 flex items-center gap-2 text-sm text-[hsl(var(--kp-red))]">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {result && (
        <div className="kp-panel rounded-xl p-4 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-[hsl(var(--kp-green))] font-semibold">
            <CheckCircle2 className="w-5 h-5" /> Sync complete
          </div>
          <Stat label="Roster" value={result.total} />
          <Stat label="Matched" value={result.matched} />
          <Stat label="Created" value={result.created} color="green" />
          <Stat label="Newly enrolled" value={result.enrolled} color="green" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Course picker */}
        <PagePanel>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] flex items-center gap-2">
              <GraduationCap className="w-4 h-4" /> Google Classroom Courses
            </h3>
            <button onClick={loadCourses} disabled={loading} className="text-[hsl(var(--kp-teal))] hover:bg-[hsl(var(--accent))] p-1.5 rounded-lg disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-[hsl(var(--kp-teal))] animate-spin" /></div>
          ) : courses.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No active courses found in your Google Classroom.</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto kp-scroll-thin pr-1">
              {courses.map(c => {
                const active = selCourse === c.id;
                return (
                  <button key={c.id} onClick={() => selectCourse(c.id)}
                    className={`w-full text-left rounded-xl p-3 border transition-all ${active ? 'bg-[hsl(var(--kp-teal))] text-white border-[hsl(var(--kp-teal))]' : 'bg-white/70 border-gray-100 hover:border-[hsl(var(--kp-teal))]/40'}`}>
                    <div className={`text-sm font-semibold truncate ${active ? 'text-white' : 'text-[hsl(var(--kp-teal))]'}`}>{c.name}</div>
                    <div className={`text-xs mt-0.5 ${active ? 'text-white/80' : 'text-gray-500'}`}>
                      {c.section ? `Section: ${c.section}` : 'No section'} {c.descriptionHeading ? `• ${c.descriptionHeading}` : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </PagePanel>

        {/* Roster preview + target class */}
        <PagePanel>
          <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] flex items-center gap-2 mb-3">
            <Users className="w-4 h-4" /> Roster Preview
          </h3>

          {!selCourseObj ? (
            <p className="text-sm text-gray-400 text-center py-8">Select a Google Classroom course to preview its roster.</p>
          ) : loadingStudents ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-[hsl(var(--kp-teal))] animate-spin" /></div>
          ) : students.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No students enrolled in this Google Classroom course.</p>
          ) : (
            <>
              <div className="space-y-1.5 max-h-[280px] overflow-y-auto kp-scroll-thin pr-1 mb-3">
                {students.map(s => (
                  <div key={s.userId} className="flex items-center gap-2.5 rounded-lg bg-white/60 border border-gray-100 px-3 py-2">
                    <div className="w-7 h-7 rounded-full bg-[hsl(var(--accent))] flex items-center justify-center text-[10px] font-bold text-[hsl(var(--kp-teal))] shrink-0">
                      {s.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[hsl(var(--kp-teal))] truncate">{s.fullName}</div>
                      {s.emailAddress && <div className="text-[11px] text-gray-400 truncate">{s.emailAddress}</div>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-3">
                <div>
                  <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> Sync into KeepPeer class
                  </label>
                  <select value={selClass} onChange={e => setSelClass(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15">
                    <option value="">Select a class…</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>Grade {c.grade_level} - {c.section} ({c.enrolled_count || 0} enrolled)</option>
                    ))}
                  </select>
                </div>

                <button onClick={handleSync} disabled={!selClass || syncing}
                  className="w-full px-4 py-2.5 rounded-lg bg-[hsl(var(--kp-green))] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50">
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  {syncing ? 'Syncing…' : `Sync ${students.length} student${students.length === 1 ? '' : 's'}`}
                </button>
                <p className="text-[11px] text-gray-400 text-center">
                  Existing students are matched by Google email or name; new ones are created and enrolled.
                </p>
              </div>
            </>
          )}
        </PagePanel>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  const c = color === 'green' ? 'text-[hsl(var(--kp-green))]' : 'text-[hsl(var(--kp-teal))]';
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-base font-bold ${c}`}>{value}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}