import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, X, Search, Link2, Check, GraduationCap, BookOpen, UserCheck } from 'lucide-react';

export default function SyncClassModal({ open, onClose, onLinked, teacher }) {
  const [classes, setClasses] = useState([]);
  const [classSubs, setClassSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [subjectInput, setSubjectInput] = useState({}); // { classId: subjectName }
  const fullName = teacher ? `${teacher.first_name} ${teacher.last_name}` : '';

  const reload = async () => {
    const [cls, subs] = await Promise.all([
      base44.entities.Class.list(),
      base44.entities.ClassSubject.list().catch(() => []),
    ]);
    setClasses(cls);
    setClassSubs(subs);
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const isAdvisory = (c) => (teacher?.id && c.adviser_id === teacher.id) || (fullName && c.adviser_name === fullName);
  const mySubjectLinks = (c) => classSubs.filter(cs => cs.class_id === c.id && (cs.teacher_id === teacher?.id || cs.teacher_name === fullName));

  const linkAdvisory = async (c) => {
    setBusyId(c.id);
    try {
      await base44.entities.Class.update(c.id, { adviser_id: teacher?.id, adviser_name: fullName });
      await reload();
      onLinked?.();
    } finally { setBusyId(null); }
  };
  const linkSubject = async (c) => {
    const subjectName = (subjectInput[c.id] || '').trim();
    if (!subjectName) return;
    setBusyId(c.id);
    try {
      await base44.entities.ClassSubject.create({
        subject_id: `${c.id}-${teacher?.id}-${subjectName}`,
        subject_name: subjectName,
        class_id: c.id,
        class_name: `Grade ${c.grade_level} - ${c.section}`,
        teacher_id: teacher?.id,
        teacher_name: fullName,
      });
      setSubjectInput(s => ({ ...s, [c.id]: '' }));
      await reload();
      onLinked?.();
    } finally { setBusyId(null); }
  };
  const unlink = async (c) => {
    setBusyId(c.id);
    try {
      if (isAdvisory(c)) await base44.entities.Class.update(c.id, { adviser_id: null, adviser_name: '' });
      const links = mySubjectLinks(c);
      if (links.length) await base44.entities.ClassSubject.deleteMany({ id: { $in: links.map(l => l.id) } });
      await reload();
      onLinked?.();
    } finally { setBusyId(null); }
  };

  const filtered = classes.filter(c => `${c.grade_level} ${c.section} ${c.adviser_name || ''}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-[#004D40] flex items-center gap-2"><Link2 className="w-5 h-5 text-[#00838F]" /> Sync Class from Admin</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-[#546E7A] mb-3">Search admin-created classes, then choose <b>Advisory</b> (manage attendance + all grades) or <b>Subject</b> (record grades for one subject).</p>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search grade or section..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm" />
        </div>
        <div className="flex-1 overflow-y-auto kp-scroll-thin space-y-2 pr-1">
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 text-[#00838F] animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No classes found.</p>
          ) : filtered.map(c => {
            const advisory = isAdvisory(c);
            const subjLinks = mySubjectLinks(c);
            const linked = advisory || subjLinks.length > 0;
            const taken = !linked && (c.adviser_id || c.adviser_name);
            return (
              <div key={c.id} className="rounded-xl border border-gray-100 p-3 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#E0F7FA] flex items-center justify-center shrink-0"><GraduationCap className="w-4 h-4 text-[#00838F]" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#004D40] truncate">Grade {c.grade_level} - {c.section}</div>
                    <div className="text-[11px] text-[#546E7A] truncate">
                      {c.adviser_name ? `Adviser: ${c.adviser_name}` : 'No adviser'}{c.room ? ` • ${c.room}` : ''} • {c.enrolled_count || 0}/{c.capacity || '—'}
                    </div>
                  </div>
                  {linked ? (
                    <button onClick={() => unlink(c)} disabled={busyId === c.id} className="px-3 py-1.5 rounded-lg bg-green-100 text-green-700 text-xs font-medium hover:bg-green-200 flex items-center gap-1 shrink-0">
                      {busyId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> {advisory ? 'Advisory' : `Subject${subjLinks.length > 1 ? ` (${subjLinks.length})` : ''}`}</>}
                    </button>
                  ) : taken ? (
                    <span className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-400 text-xs font-medium shrink-0">Taken</span>
                  ) : (
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => linkAdvisory(c)} disabled={busyId === c.id} title="Link as Adviser" className="px-2.5 py-1.5 rounded-lg bg-[#00838F] text-white text-xs font-medium hover:brightness-105 flex items-center gap-1">
                        {busyId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><UserCheck className="w-3.5 h-3.5" /> Advisory</>}
                      </button>
                      <button onClick={() => setSubjectInput(s => ({ ...s, [c.id]: s[c.id] === undefined ? '' : null }))} title="Link as Subject Teacher" className="px-2.5 py-1.5 rounded-lg bg-[#FFB300] text-white text-xs font-medium hover:brightness-105 flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" /> Subject
                      </button>
                    </div>
                  )}
                </div>
                {subjectInput[c.id] !== undefined && subjectInput[c.id] !== null && !linked && (
                  <div className="flex gap-2 mt-2">
                    <input autoFocus value={subjectInput[c.id] || ''} onChange={e => setSubjectInput(s => ({ ...s, [c.id]: e.target.value }))} placeholder="Subject name (e.g. Math)" className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm" />
                    <button onClick={() => linkSubject(c)} disabled={busyId === c.id} className="px-3 py-1.5 rounded-lg bg-[#00838F] text-white text-xs font-medium hover:brightness-105">Confirm</button>
                    <button onClick={() => setSubjectInput(s => { const n = { ...s }; delete n[c.id]; return n; })} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-xs font-medium">Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm font-medium">Done</button>
        </div>
      </div>
    </div>
  );
}