import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, X, Search, Users, ClipboardList, CheckCircle2 } from 'lucide-react';
import { Avatar } from '@/components/kp/ui';

export default function MassEnrollModal({ open, onClose, classInfo, onDone }) {
  const [mode, setMode] = useState('list');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({});
  const [lrnText, setLrnText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setMode('list'); setSelected({}); setLrnText(''); setResult(null); setSearch('');
    base44.entities.Student.list().then(setStudents).finally(() => setLoading(false));
  }, [open]);

  if (!open || !classInfo) return null;

  const eligible = students.filter(s => (s.grade !== classInfo.grade_level || s.section !== classInfo.section) && s.enrollment_status !== 'archived');
  const filtered = eligible.filter(s => `${s.first_name} ${s.last_name} ${s.lrn || ''}`.toLowerCase().includes(search.toLowerCase()));
  const selectedIds = Object.keys(selected).filter(k => selected[k]);
  const lrnList = lrnText.split(/[\s,]+/).map(x => x.trim()).filter(Boolean);
  const lrnMatched = lrnList.map(l => students.find(s => s.lrn === l)).filter(Boolean);
  const lrnMissing = lrnList.filter(l => !students.find(s => s.lrn === l));

  const enrollIds = mode === 'list' ? selectedIds : lrnMatched.map(s => s.id);

  const toggle = (id) => setSelected(prev => ({ ...prev, [id]: !prev[id] }));

  const run = async () => {
    if (!enrollIds.length) return;
    setBusy(true); setResult(null);
    try {
      const studs = students.filter(s => enrollIds.includes(s.id));
      if (studs.length) await base44.entities.Student.bulkUpdate(studs.map(s => ({ id: s.id, grade: classInfo.grade_level, section: classInfo.section, enrollment_status: 'enrolled' })));
      const today = new Date().toLocaleDateString('en-CA');
      const records = studs.map(s => ({
        student_id: s.id, student_name: `${s.first_name} ${s.last_name}`,
        class_id: classInfo.id, class_name: `${classInfo.grade_level} ${classInfo.section}`,
        enrollment_date: today, status: 'enrolled',
      }));
      if (records.length) await base44.entities.Enrollment.bulkCreate(records);
      setResult({ count: studs.length });
      onDone?.();
    } catch (e) { setResult({ error: 'Enrollment failed.' }); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-[hsl(var(--kp-teal))] flex items-center gap-2"><Users className="w-5 h-5" /> Mass Enroll — {classInfo.grade_level} - {classInfo.section}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex gap-1.5 mb-3">
          <button onClick={() => setMode('list')} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${mode === 'list' ? 'bg-[hsl(var(--kp-teal))] text-white' : 'bg-[hsl(var(--accent))] text-[hsl(var(--kp-teal))]'}`}><Users className="w-4 h-4" /> Select from list</button>
          <button onClick={() => setMode('lrn')} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${mode === 'lrn' ? 'bg-[hsl(var(--kp-teal))] text-white' : 'bg-[hsl(var(--accent))] text-[hsl(var(--kp-teal))]'}`}><ClipboardList className="w-4 h-4" /> Paste LRNs</button>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-[hsl(var(--kp-teal))] animate-spin" /></div>
        ) : mode === 'list' ? (
          <>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or LRN..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </div>
            <div className="flex-1 overflow-y-auto kp-scroll-thin space-y-1.5 pr-1">
              {filtered.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">No eligible students.</p> : filtered.slice(0, 100).map(s => (
                <button key={s.id} onClick={() => toggle(s.id)} className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left ${selected[s.id] ? 'border-[hsl(var(--kp-teal))] bg-[hsl(var(--accent))]' : 'border-gray-100 hover:bg-gray-50'}`}>
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${selected[s.id] ? 'bg-[hsl(var(--kp-teal))] border-[hsl(var(--kp-teal))]' : 'border-gray-300'}`}>{selected[s.id] && <CheckCircle2 className="w-4 h-4 text-white" />}</div>
                  <Avatar name={`${s.first_name} ${s.last_name}`} src={s.photo_url} size="w-8 h-8" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-700 truncate">{s.first_name} {s.last_name}</div>
                    <div className="text-[11px] text-gray-400">{s.grade || '—'} - {s.section || '—'} • {s.lrn || 'no LRN'}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-400 mt-2">{selectedIds.length} selected</div>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-2">Paste student LRNs, separated by commas or new lines.</p>
            <textarea value={lrnText} onChange={e => setLrnText(e.target.value)} rows={7} placeholder="e.g. 123456789012&#10;987654321098" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono" />
            <div className="text-xs mt-2 space-y-0.5">
              <div className="text-green-600">{lrnMatched.length} students matched</div>
              {lrnMissing.length > 0 && <div className="text-[hsl(var(--kp-red))]">{lrnMissing.length} not found: {lrnMissing.slice(0, 5).join(', ')}{lrnMissing.length > 5 ? '...' : ''}</div>}
            </div>
          </>
        )}

        {result && (
          <div className="mt-3 p-2.5 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> {result.error || `Enrolled ${result.count} students into ${classInfo.grade_level} - ${classInfo.section}.`}
          </div>
        )}

        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm font-medium">Close</button>
          <button onClick={run} disabled={busy || !enrollIds.length} className="flex-1 px-4 py-2 rounded-lg bg-[hsl(var(--kp-green))] text-white text-sm font-medium hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-1.5">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />} Enroll {enrollIds.length || ''}
          </button>
        </div>
      </div>
    </div>
  );
}