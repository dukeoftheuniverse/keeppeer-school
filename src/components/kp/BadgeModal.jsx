import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Loader2, Award } from 'lucide-react';
import BadgeMedal, { BADGES } from '@/components/kp/BadgeMedal';

export default function BadgeModal({ open, onClose, student, teacher, onAwarded }) {
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const award = async () => {
    if (!student || !selected) return;
    setSaving(true);
    try {
      const badge = BADGES.find(b => b.type === selected);
      await base44.entities.StudentBadge.create({
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        badge_type: selected,
        badge_label: badge.label,
        awarded_by_id: teacher?.id,
        awarded_by_name: teacher ? `${teacher.first_name} ${teacher.last_name}` : '',
        reason: reason.trim(),
        date: new Date().toLocaleDateString('en-CA'),
      });
      setReason(''); setSelected(null);
      onAwarded?.();
      onClose?.();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="kp-panel rounded-2xl w-full max-w-lg p-5 relative">
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-[#00838F]"><X className="w-4 h-4" /></button>
        <div className="flex items-center gap-2 mb-1">
          <Award className="w-5 h-5 text-[#FFC107]" />
          <h3 className="text-lg font-bold text-[hsl(var(--kp-teal))]">Award a Badge</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">Choose an achievement for {student?.first_name} {student?.last_name}.</p>

        <div className="grid grid-cols-5 gap-1.5 mb-4">
          {BADGES.map(b => (
            <button key={b.type} onClick={() => setSelected(b.type)}
              className={`p-1.5 rounded-xl flex flex-col items-center justify-end transition-all ${selected === b.type ? 'bg-[#E0F7FA] ring-2 ring-[#00838F]' : 'hover:bg-white/60'}`}>
              <BadgeMedal type={b.type} size={62} />
            </button>
          ))}
        </div>

        <div className="mb-3">
          <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Reason / Note (optional)</label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Top scorer in Q1 Math"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white/70" />
        </div>

        <button onClick={award} disabled={saving || !selected}
          className="w-full py-2.5 rounded-full bg-[#16A34A] text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />} Award Badge
        </button>
      </div>
    </div>
  );
}