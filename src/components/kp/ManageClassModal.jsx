import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, X, Plus } from 'lucide-react';

const GRADES = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'];
const SESSIONS = ['Whole Day', 'Morning', 'Afternoon'];

export default function ManageClassModal({ open, onClose, onCreated, teacher, school }) {
  const [form, setForm] = useState({ grade_level: '', section: '', room: '', session: 'Whole Day', capacity: 40 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  if (!open) return null;

  const handleSave = async () => {
    if (!form.grade_level || !form.section) { setErr('Grade level and section are required.'); return; }
    setSaving(true); setErr('');
    try {
      const fullName = teacher ? `${teacher.first_name} ${teacher.last_name}` : '';
      await base44.entities.Class.create({
        grade_level: form.grade_level,
        section: form.section,
        adviser_id: teacher?.id,
        adviser_name: fullName,
        room: form.room,
        session: form.session,
        capacity: Number(form.capacity) || 40,
        enrolled_count: 0,
        academic_year: school?.academic_year || '2026-2027',
        status: 'active',
      });
      setForm({ grade_level: '', section: '', room: '', session: 'Whole Day', capacity: 40 });
      onCreated?.();
      onClose();
    } catch (e) { setErr('Failed to create class.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-[#004D40] flex items-center gap-2"><Plus className="w-5 h-5 text-[#00838F]" /> Add Class</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs font-medium text-[#00838F] mb-1 block">Grade Level</label>
            <select value={form.grade_level} onChange={e => setForm({ ...form, grade_level: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
              <option value="">Select</option>
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs font-medium text-[#00838F] mb-1 block">Section</label>
            <input value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} placeholder="e.g. Mansanitas" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-[#00838F] mb-1 block">Room</label>
            <input value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} placeholder="e.g. Rm 101" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-[#00838F] mb-1 block">Session</label>
            <select value={form.session} onChange={e => setForm({ ...form, session: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
              {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-[#00838F] mb-1 block">Capacity</label>
            <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </div>
        </div>
        {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm font-medium">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-[#00838F] text-white text-sm font-medium hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Class
          </button>
        </div>
      </div>
    </div>
  );
}