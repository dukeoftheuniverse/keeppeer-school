import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Loader2, Save } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ScheduleModal({ open, onClose, onSaved, teacher, presetClass }) {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    class_id: '',
    subject_name: '',
    day: 'Monday',
    start_time: '07:30',
    end_time: '08:30',
    room: '',
    notes: ''
  });

  useEffect(() => {
    if (!open) return;
    Promise.all([
      base44.entities.Class.list().catch(() => []),
      base44.entities.Subject.list().catch(() => []),
      base44.entities.Room.list().catch(() => [])
    ]).then(([cls, subs, rms]) => {
      setClasses(cls);
      setSubjects(subs);
      setRooms(rms);
      if (presetClass) {
        setForm((f) => ({ ...f, class_id: presetClass.id || f.class_id }));
      }
    });
  }, [open]);

  if (!open) return null;

  const selectedClass = classes.find((c) => c.id === form.class_id);
  const classLabel = selectedClass ? `${selectedClass.grade_level} - ${selectedClass.section}` : '';

  const save = async () => {
    setError('');
    if (!form.class_id || !form.day || !form.start_time || !form.end_time) {
      setError('Please select a class, day, and time.');
      return;
    }
    if (form.start_time >= form.end_time) {
      setError('End time must be after start time.');
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Schedule.create({
        class_id: form.class_id,
        class_name: classLabel,
        subject_name: form.subject_name || 'Class',
        day: form.day,
        start_time: form.start_time,
        end_time: form.end_time,
        room: form.room,
        teacher_id: teacher?.id,
        teacher_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : '',
        notes: form.notes
      });
      onSaved && onSaved();
      onClose();
    } catch (e) {
      setError(e?.message || 'Failed to save schedule.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto kp-scroll-thin">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-base font-bold text-[#004D40]">Add Class Schedule</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Class">
            <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
              <option value="">Select class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>Grade {c.grade_level} - {c.section}</option>)}
            </select>
          </Field>
          <Field label="Subject">
            <input list="kp-sched-subjects" value={form.subject_name} onChange={(e) => setForm({ ...form, subject_name: e.target.value })} placeholder="e.g. Mathematics" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <datalist id="kp-sched-subjects">
              {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Day">
              <select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Room">
              <input list="kp-sched-rooms" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="e.g. Room 101" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <datalist id="kp-sched-rooms">
                {rooms.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
              </datalist>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Time">
              <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </Field>
            <Field label="End Time">
              <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </Field>
          </div>
          <Field label="Notes (optional)">
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Lab session" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </Field>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-[hsl(var(--kp-green))] text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50 flex items-center gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-[#006064] mb-1 block">{label}</label>
      {children}
    </div>
  );
}