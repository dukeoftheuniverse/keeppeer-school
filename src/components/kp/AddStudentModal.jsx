import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, X, UserPlus, QrCode } from 'lucide-react';

export default function AddStudentModal({ open, onClose, onAdded, classInfo }) {
  const [lrn, setLrn] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const handleAdd = async () => {
    if (!lrn.trim() || !classInfo) { setMsg('Enter a valid LRN.'); return; }
    setBusy(true); setMsg('');
    try {
      const all = await base44.entities.Student.list();
      const found = all.find(s => s.lrn === lrn.trim());
      if (!found) { setMsg('No student found with that LRN.'); setBusy(false); return; }
      await base44.entities.Student.update(found.id, {
        grade: classInfo.grade_level,
        section: classInfo.section,
        enrollment_status: 'enrolled',
      });
      setLrn('');
      onAdded?.();
      onClose();
    } catch (e) { setMsg('Failed to enroll student.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-[#004D40] flex items-center gap-2"><UserPlus className="w-5 h-5 text-[#00838F]" /> Add Student to {classInfo ? `Grade ${classInfo.grade_level} - ${classInfo.section}` : 'Class'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-[#546E7A] mb-3">Enter the student's LRN to enroll them into this class.</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={lrn} onChange={e => setLrn(e.target.value)} placeholder="Enter LRN..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </div>
          <button onClick={handleAdd} disabled={busy} className="px-4 py-2 rounded-lg bg-[#00838F] text-white text-sm font-medium hover:brightness-105 disabled:opacity-50 flex items-center gap-1.5">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Enroll
          </button>
        </div>
        {msg && <p className="text-xs text-[#00838F] mt-2">{msg}</p>}
      </div>
    </div>
  );
}