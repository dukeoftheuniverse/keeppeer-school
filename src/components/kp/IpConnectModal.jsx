import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { logAudit } from '@/lib/audit';
import { X, Loader2, CheckCircle2, AlertTriangle, Wifi, Link2 } from 'lucide-react';

/**
 * IpConnectModal — connect an IP/network camera by its live stream URL.
 * Browsers can display MJPEG / HTTP-snapshot streams inline via <img>.
 * RTSP is NOT playable in-browser (no native support) — recommend an MJPEG URL.
 */
export default function IpConnectModal({ open, onClose, onConnected }) {
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [url, setUrl] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [previewOk, setPreviewOk] = useState(false);

  if (!open) return null;

  const reset = () => { setName(''); setIp(''); setUrl(''); setLocation(''); setResult(null); setPreviewOk(false); setBusy(false); };

  const testStream = () => new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (ok, msg) => { if (done) return; done = true; img.onload = null; img.onerror = null; resolve({ ok, msg }); };
    img.onload = () => finish(true, 'Connection successful — first frame received.');
    img.onerror = () => finish(false, 'Could not load the stream. Verify the URL, that the camera serves MJPEG/HTTP snapshot, and that browser access is allowed.');
    setTimeout(() => finish(false, 'Connection timed out. The camera may be offline, blocking cross-origin requests, or serving RTSP (not supported in-browser).'), 7000);
    img.src = url + (url.includes('?') ? '&' : '?') + '_kp=' + Date.now();
  });

  const handleTest = async () => {
    if (!url) { setResult({ ok: false, msg: 'Enter a stream URL first.' }); return; }
    setBusy(true); setResult(null); setPreviewOk(false);
    const r = await testStream();
    setResult(r);
    if (r.ok) setPreviewOk(true);
    setBusy(false);
  };

  const handleConnect = async () => {
    if (!name || !url) { setResult({ ok: false, msg: 'Device name and stream URL are required.' }); return; }
    setBusy(true); setResult(null);
    const r = await testStream();
    if (!r.ok) { setResult(r); setBusy(false); return; }
    try {
      const created = await base44.entities.ScannerDevice.create({
        deviceName: name,
        deviceId: 'IP-' + Date.now().toString().slice(-6),
        deviceType: 'IP Camera',
        streamUrl: url,
        ipAddress: ip || '',
        location: location || '',
        campus: '', assignedBuilding: '', assignedRoom: '',
        status: 'Online',
        registeredDate: new Date().toLocaleDateString('en-CA'),
        notes: 'IP camera stream',
      });
      await logAudit('Camera Configuration', 'ScannerDevice', created.id, `Connected IP camera "${name}" at ${url}.`);
      setBusy(false);
      onConnected && onConnected();
      reset();
      onClose();
    } catch (e) {
      setBusy(false);
      setResult({ ok: false, msg: 'Save failed: ' + (e?.message || e) });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { reset(); onClose(); }}>
      <div className="kp-panel rounded-2xl shadow-2xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
            <h3 className="text-base font-bold text-[hsl(var(--kp-teal))]">Connect IP Camera</h3>
          </div>
          <button onClick={() => { reset(); onClose(); }} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-3">Enter the camera's live stream URL. <strong>MJPEG</strong> or <strong>HTTP snapshot</strong> URLs play in-browser; RTSP is not supported directly.</p>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Device Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Gate IP Cam" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">IP Address</label>
              <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.168.1.50" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Stream URL</label>
            <input value={url} onChange={(e) => { setUrl(e.target.value); setPreviewOk(false); setResult(null); }} placeholder="http://192.168.1.50:8080/video" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
          </div>
          <div>
            <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Location (optional)</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Main Entrance" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
          </div>
        </div>

        {previewOk && (
          <div className="mt-3 relative aspect-video bg-gray-900 rounded-xl overflow-hidden">
            <img src={url} alt="IP stream preview" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">LIVE PREVIEW</div>
          </div>
        )}

        {result && (
          <div className={`mt-3 p-3 rounded-lg border flex items-start gap-2 text-sm ${result.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {result.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
            <div>{result.msg}</div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button onClick={handleTest} disabled={busy} className="flex-1 py-2.5 rounded-lg border border-[hsl(var(--kp-teal))] text-[hsl(var(--kp-teal))] font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Test Connection
          </button>
          <button onClick={handleConnect} disabled={busy} className="flex-1 py-2.5 rounded-lg bg-[hsl(var(--kp-green))] text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />} Connect & Save
          </button>
        </div>
        <div className="mt-2 text-[11px] text-gray-400">Tip: many IP cams expose MJPEG at <code>/video/mjpg.cgi</code> or <code>/stream</code>. If the preview is blank, the camera may block cross-origin access — serve it through a proxy if needed.</div>
      </div>
    </div>
  );
}