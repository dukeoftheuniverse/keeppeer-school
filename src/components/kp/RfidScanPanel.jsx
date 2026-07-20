import React, { useState } from 'react';
import { matchPersonByText } from '@/lib/attendanceMatch';
import { Radio, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function RfidScanPanel({ people = [], onRecord }) {
  const [tag, setTag] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const scan = async () => {
    const t = tag.trim();
    if (!t) return;
    setBusy(true);
    setResult(null);
    const person = matchPersonByText(t, people);
    if (!person) {
      setResult({ ok: false, error: `No person matches RFID tag "${t}".` });
      setBusy(false);
      return;
    }
    const out = await onRecord(person, 'rfid', 100);
    setResult(out);
    if (out.ok) setTag('');
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Tap or scan an RFID card. The tag is matched to a student or staff member to record attendance.</p>

      <div className="kp-panel-translucent rounded-xl p-4 space-y-3">
        <label className="text-xs font-medium text-[hsl(var(--kp-teal))]">RFID Tag</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Radio className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && scan()}
              placeholder="e.g. 04A7F2B9"
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15"
            />
          </div>
          <button
            onClick={scan}
            disabled={busy || !tag.trim()}
            className="px-4 py-2 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-semibold flex items-center gap-1.5 hover:brightness-105 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />} Scan
          </button>
        </div>
      </div>

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