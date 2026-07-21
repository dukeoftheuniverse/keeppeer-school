import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import CameraViewfinder from '@/components/kp/CameraViewfinder';
import { X, Loader2, CheckCircle2, AlertTriangle, Sun, CameraOff, Link2 } from 'lucide-react';

/** Test a camera feed before activation: live preview + low-light check. */
export default function CameraTestModal({ open, onClose, device }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  if (!open) return null;

  const testLighting = async () => {
    setBusy(true);
    setResult(null);
    try {
      const video = document.querySelector('video');
      if (!video) { setResult({ ok: false, msg: 'No video stream found.' }); setBusy(false); return; }
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 48;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, 64, 48);
      const { data } = ctx.getImageData(0, 0, 64, 48);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
      const brightness = Math.round(sum / (data.length / 4));
      let msg = 'Lighting is good. Camera ready to activate.';
      let ok = true;
      if (brightness < 45) { ok = false; msg = 'Low light detected. Increase lighting or reposition the camera — recognition accuracy will suffer.'; }
      else if (brightness > 230) { ok = false; msg = 'Image too bright (possible glare). Reduce backlight or move the camera away from direct light.'; }
      setResult({ ok, brightness, msg });
    } catch (e) {
      setResult({ ok: false, msg: 'Could not test: ' + (e?.message || 'error') });
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="kp-panel rounded-2xl shadow-2xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-[hsl(var(--kp-teal))]">Test Camera — {device?.deviceName || 'New'}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        {device?.streamUrl ? (
          <>
            <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center">
              <img src={device.streamUrl} alt="IP stream" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.querySelector('.kp-ip-fallback').style.display = 'flex'; }} />
              <div className="kp-ip-fallback absolute inset-0 hidden flex-col items-center justify-center text-white/70 gap-1">
                <CameraOff className="w-8 h-8" />
                <span className="text-xs">Stream not displayable in-browser</span>
              </div>
              <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">IP STREAM{device.ipAddress ? ` · ${device.ipAddress}` : ''}</div>
            </div>
            <div className="mt-3 flex gap-2">
              <a href={device.streamUrl} target="_blank" rel="noreferrer" className="flex-1 py-2.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white font-bold text-sm flex items-center justify-center gap-2"><Link2 className="w-4 h-4" /> Open Stream</a>
              <button onClick={onClose} className="px-4 py-2.5 rounded-lg bg-[hsl(var(--kp-green))] text-white font-bold text-sm">Done</button>
            </div>
            <div className="mt-3 text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-2">If the preview is blank, the camera may block cross-origin browser access (CORS) or serve RTSP. Use an MJPEG or HTTP snapshot URL for in-browser preview.</div>
          </>
        ) : (
          <>
            <CameraViewfinder active facingMode="environment" />
            <div className="mt-3 flex gap-2">
              <button onClick={testLighting} disabled={busy} className="flex-1 py-2.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sun className="w-4 h-4" />} Test Lighting
              </button>
              <button onClick={onClose} className="px-4 py-2.5 rounded-lg bg-[hsl(var(--kp-green))] text-white font-bold text-sm">Done</button>
            </div>
          </>
        )}
        {result && (
          <div className={`mt-3 p-3 rounded-lg border flex items-start gap-2 text-sm ${result.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {result.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
            <div><div>{result.msg}</div>{result.brightness != null && <div className="text-xs mt-0.5 text-gray-500">Brightness {result.brightness}/255</div>}</div>
          </div>
        )}
        <div className="mt-3 text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg p-2 flex gap-2">
          <CameraOff className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
          <span><strong>Placement guidance:</strong> Mount the camera at face height (1.4–1.6m), face-level and well-lit. Avoid backlight from windows or doors. Ensure faces fill at least 1/6 of the frame.</span>
        </div>
      </div>
    </div>
  );
}