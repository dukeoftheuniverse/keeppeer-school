import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Loader2, Award, Trash2 } from 'lucide-react';
import BadgeMedal, { BADGE_TYPES } from '@/components/kp/BadgeMedal';
import { logAudit } from '@/lib/audit';

export default function BadgeModal({ open, onClose, student, teacher, onAwarded }) {
  const [awarded, setAwarded] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');

  const load = async () => {
    if (!student?.id) return;
    setLoading(true);
    const list = await base44.entities.StudentBadge.filter({ student_id: student.id }).catch(() => []);
    list.sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
    setAwarded(list);
    setLoading(false);
  };

  useEffect(() => { if (open) { load(); setSelected(null); setNotes(''); } }, [open, student?.id]);

  const award = async () => {
    if (!selected || !student?.id) return;
    setSaving(true);
    const today = new Date().toLocaleDateString('en-CA');
    await base44.entities.StudentBadge.create({
      student_id: student.id,
      student_name: `${student.first_name} ${student.last_name}`,
      badge_type: selected,
      awarded_by_id: teacher?.id,
      awarded_by_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : '',
      date: today,
      notes: notes.trim(),
    });
    logAudit('award_badge', 'StudentBadge', student.id, `${BADGE_TYPES[selected].label} for ${student.first_name} ${student.last_name}`);
    setSelected(null); setNotes('');
    await load();
    onAwarded?.();
    setSaving(false);
  };

  const remove = async (id) => {
    await base44.entities.StudentBadge.delete(id);
    await load();
    onAwarded?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="kp-glass-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto kp-scroll-thin">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-[#006064] to-[#00838F] px-5 py-3.5 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2 text-white">
            <Award className="w-5 h-5" />
            <h3 className="text-base font-bold">Award Badges — {student?.first_name} {student?.last_name}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Badge picker */}
          <div>
            <p className="text-xs font-semibold text-[#004D40] mb-3">Select a badge to award:</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {Object.entries(BADGE_TYPES).map(([key, cfg]) => {
                const active = selected === key;
                return (
                  <button key={key} onClick={() => setSelected(key)} className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-all ${active ? 'bg-[#E0F7FA] ring-2 ring-[#00838F]' : 'bg-white/50 hover:bg-white/80 border border-gray-100'}`}>
                    <BadgeMedal type={key} size={88} showLabel={false} />
                    <span className="text-[10px] font-semibold text-[#004D40] text-center leading-tight">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes + award button */}
          {selected && (
            <div className="bg-[#E0F7FA]/40 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center gap-3">
                <BadgeMedal type={selected} size={72} showLabel={false} />
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#004D40]">{BADGE_TYPES[selected].label}</div>
                  <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes (e.g. 'For outstanding Q1 performance')" className="mt-1 w-full px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs" />
                </div>
              </div>
              <button onClick={award} disabled={saving} className="w-full py-2 rounded-full bg-[#00C853] text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />} Award this Badge
              </button>
            </div>
          )}

          {/* Already awarded */}
          <div>
            <p className="text-xs font-semibold text-[#004D40] mb-2">Awarded Badges:</p>
            {loading ? <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 text-[#00838F] animate-spin" /></div> :
              awarded.length === 0 ? <p className="text-xs text-gray-400 text-center py-4">No badges awarded yet.</p> :
              <div className="flex flex-wrap gap-3">
                {awarded.map(b => (
                  <div key={b.id} className="relative bg-white/60 rounded-xl p-2 pb-1 border border-gray-100">
                    <BadgeMedal type={b.badge_type} size={72} showLabel={false} />
                    <div className="text-[9px] text-center text-[#546E7A] mt-0.5">{b.date || ''}</div>
                    <button onClick={() => remove(b.id)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow hover:brightness-110"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>}
          </div>
        </div>
      </div>
    </div>
  );
}