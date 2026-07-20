import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import CameraViewfinder from '@/components/kp/CameraViewfinder';
import { matchPersonByText } from '@/lib/attendanceMatch';
import { QrCode, CheckCircle2, XCircle, Loader2, ScanLine } from 'lucide-react';

export default function QrScanPanel({ people = [], onRecord }) {
  const camRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [decoded, setDecoded] = useState('');
  const [result, setResult] = useState(null);

  const scan = async () => {
    setResult(null);
    setDecoded('');
    if (!camRef.current || !camRef.current.isStreaming()) {
      setResult({ ok: false, error: 'Camera not ready yet.' });
      return;
    }
    setBusy(true);
    try {
      const dataURL = camRef.current.capture();
      if (!dataURL) { setResult({ ok: false, error: 'Could not capture a frame.' }); setBusy(false); return; }
      const blob = await (await fetch(dataURL)).blob();
      const file = new File([blob], 'qr.jpg', { type: 'image/jpeg' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const llm = await base44.integrations.Core.InvokeLLM({
        prompt: 'This image may contain a QR code or barcode. Read and return the exact decoded text/value. If none is visible, return an empty string. Respond ONLY as JSON: {"text": string}',
        file_urls: [file_url],
        response_json_schema: { type: 'object', properties: { text: { type: 'string' } } },
      });
      const text = (llm?.text || '').trim();
      setDecoded(text);

      if (!text) { setResult({ ok: false, error: 'No QR code or barcode detected.' }); setBusy(false); return; }

      const person = matchPersonByText(text, people);
      if (!person) { setResult({ ok: false, error: `Decoded "${text}" — no matching person.` }); setBusy(false); return; }

      const out = await onRecord(person, 'qr', 100);
      setResult(out);
    } catch (e) {
      setResult({ ok: false, error: 'Decode failed: ' + (e?.message || 'unexpected error') });
    }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Point the camera at a QR code or barcode on an ID card, then tap <strong>Scan Code</strong>. The decoded value is matched to a person to record attendance.</p>

      <CameraViewfinder ref={camRef} active facingMode="environment" overlay={
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-56 h-56 border-2 border-white/70 rounded-xl" />
        </div>
      } />

      <button
        onClick={scan}
        disabled={busy}
        className="w-full py-3 rounded-xl bg-[hsl(var(--kp-teal))] text-white font-bold text-sm hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ScanLine className="w-5 h-5" />}
        {busy ? 'Decoding...' : 'Scan Code'}
      </button>

      {decoded && (
        <div className="text-xs text-gray-500 break-all p-2 rounded-lg bg-gray-50 border border-gray-100">
          Decoded: <span className="font-mono text-gray-700">{decoded}</span>
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