import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, X, Search, Link2, Check, Unlink, GraduationCap } from 'lucide-react';

export default function SyncClassModal({ open, onClose, onLinked, teacher }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const fullName = teacher ? `${teacher.first_name} ${teacher.last_name}` : '';

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    base44.entities.Class.list().then(setClasses).finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const reload = () => base44.entities.Class.list().then(setClasses);
  const isMine = (c) => (teacher?.id && c.adviser_id === teacher.id) || (fullName && c.adviser_name === fullName);

  const link = async (c) => {
    setBusyId(c.id);
    try {
      await base44.entities.Class.update(c.id, { adviser_id: teacher?.id, adviser_name: fullName });
      await reload();
      onLinked?.();
    } finally { setBusyId(null); }
  };
  const unlink = async (c) => {
    setBusyId(c.id);
    try {
      await base44.entities.Class.update(c.id, { adviser_id: null, adviser_name: '' });
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
        <p className="text-xs text-[#546E7A] mb-3">Search classes already created by the admin and link the ones you teach. Your name will be set as adviser.</p>
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
            const mine = isMine(c);
            const taken = !mine && (c.adviser_id || c.adviser_name);
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 bg-gray-50/50">
                <div className="w-9 h-9 rounded-lg bg-[#E0F7FA] flex items-center justify-center shrink-0"><GraduationCap className="w-4 h-4 text-[#00838F]" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#004D40] truncate">Grade {c.grade_level} - {c.section}</div>
                  <div className="text-[11px] text-[#546E7A] truncate">
                    {c.adviser_name ? `Adviser: ${c.adviser_name}` : 'No adviser set'}
                    {c.room ? ` • ${c.room}` : ''} • {c.enrolled_count || 0}/{c.capacity || '—'}
                  </div>
                </div>
                {mine ? (
                  <button onClick={() => unlink(c)} disabled={busyId === c.id} className="px-3 py-1.5 rounded-lg bg-green-100 text-green-700 text-xs font-medium hover:bg-green-200 flex items-center gap-1">
                    {busyId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Linked</>}
                  </button>
                ) : taken ? (
                  <span className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-400 text-xs font-medium">Taken</span>
                ) : (
                  <button onClick={() => link(c)} disabled={busyId === c.id} className="px-3 py-1.5 rounded-lg bg-[#00838F] text-white text-xs font-medium hover:brightness-105 flex items-center gap-1">
                    {busyId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Link2 className="w-3.5 h-3.5" /> Link</>}
                  </button>
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