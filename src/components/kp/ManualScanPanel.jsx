import React, { useState, useMemo } from 'react';
import { Avatar } from '@/components/kp/ui';
import { Search, UserCheck, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function ManualScanPanel({ people = [], onRecord }) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = t
      ? people.filter((p) => `${p.name} ${p.student_id || ''} ${p.employee_id || ''} ${p.lrn || ''}`.toLowerCase().includes(t))
      : people;
    return base.slice(0, 8);
  }, [q, people]);

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    setResult(null);
    const out = await onRecord(selected, 'manual', 100);
    setResult(out);
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Select a person from the list and record their time in / time out manually.</p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or ID..."
          className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto kp-scroll-thin">
        {matches.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p)}
            className={`flex flex-col items-center p-2 rounded-lg border transition-all ${selected?.id === p.id ? 'border-[hsl(var(--kp-teal))] bg-[hsl(var(--kp-teal))]/10' : 'border-gray-100 bg-white/50 hover:bg-gray-50'}`}
          >
            <Avatar name={p.name} src={p.photo_url} size="w-12 h-12" />
            <div className="text-xs font-medium text-gray-700 text-center mt-1 truncate w-full">{p.name}</div>
            <div className="text-[10px] text-gray-400 capitalize">{p.type}</div>
          </button>
        ))}
        {matches.length === 0 && <p className="text-sm text-gray-400 col-span-full text-center py-4">No people found.</p>}
      </div>

      {selected && (
        <div className="kp-panel-translucent rounded-xl p-3 flex items-center gap-3">
          <Avatar name={selected.name} src={selected.photo_url} size="w-12 h-12" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[hsl(var(--kp-teal))] truncate">{selected.name}</div>
            <div className="text-xs text-gray-500">{selected.student_id || selected.employee_id || selected.lrn || '—'} • <span className="capitalize">{selected.type}</span></div>
          </div>
          <button
            onClick={submit}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-[hsl(var(--kp-green))] text-white text-sm font-semibold flex items-center gap-1.5 hover:brightness-105 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />} Record
          </button>
        </div>
      )}

      {result && (
        <div className={`p-3 rounded-lg border flex items-center gap-3 text-sm ${result.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {result.ok ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
          <div className="flex-1">
            {result.ok ? `${result.person.name} — ${result.type.replace('_', ' ')} at ${result.time} (${result.status})` : result.error}
          </div>
        </div>
      )}
    </div>
  );
}