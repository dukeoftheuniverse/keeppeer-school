import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { logAudit } from '@/lib/audit';
import { X, Loader2, CheckCircle2, AlertTriangle, Wifi } from 'lucide-react';

// Common IP-camera MJPEG / snapshot endpoints to auto-probe from a bare IP.
const PATHS = ['', '/video', '/mjpg/video.mjpg', '/video.mjpg', '/stream', '/cgi-bin/video', '/live', '/mjpg/1/video.mjpg'];

function buildCandidates(ip) {
  let proto = 'http';
  let host = ip.trim();
  if (/^https:\/\//i.test(host)) proto = 'https';
  host = host.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (!host) return [];
  // If a port is already present, keep it; otherwise also try :8080.
  const hasPort = /:\d+$/.test(host);
  const hosts = hasPort ? [host] : [host, `${host}:8080`];
  const list = [];
  hosts.forEach((h) => PATHS.forEach((p) => list.push(`${proto}://${h}${p}`)));
  return list;
}

function probe(url, timeoutMs = 3500) {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (ok) => { if (done) return; done = true; img.onload = null; img.onerror = null; resolve(ok); };
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    setTimeout(() => finish(false), timeoutMs);
    img.src = url + (url.includes('?') ? '&' : '?') + '_kp=' + Date.now();
  });
}

export default function IpConnectModal({ open, onClose, onConnected }) {
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [streamUrl, setStreamUrl] = useState('');

  if (!open) return null;

  const reset = () => { setName(''); setIp(''); setLocation(''); setResult(null); setStreamUrl(''); setBusy(false); };

  const discover = async () => {
    const candidates = buildCandidates(ip);
    if (candidates.length === 0) return '';
    for (const c of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await probe(c)) return c;
    }
    return '';
  };

  const handleConnect = async () => {
    if (!name || !ip) { setResult({ ok: false, msg: 'Device name and IP address are required.' }); return; }
    setBusy(true); setResult(null); setStreamUrl('');
    const found = await discover();
    const url = found || `http://${ip.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')}/video`;
    setStreamUrl(url);
    try {
      const created = await base44.entities.ScannerDevice.create({
        deviceName: name,
        deviceId: 'IP-' + Date.now().toString().slice(-6),
        deviceType: 'IP Camera',
        streamUrl: url,
        ipAddress: ip,
        location: location || '',
        campus: '', assignedBuilding: '', assignedRoom: '',
        status: found ? 'Online' : 'Offline',
        registeredDate: new Date().toLocaleDateString('en-CA'),
        notes: found ? 'IP camera — auto-discovered stream' : 'IP camera — stream not reachable, saved for retry',
      });
      await logAudit('Camera Configuration', 'ScannerDevice', created.id, `Connected IP camera "${name}" (${ip}) → ${url}.`);
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
      <div className="kp-panel rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
            <h3 className="text-base font-bold text-[hsl(var(--kp-teal))]">Connect IP Camera</h3>
          </div>
          <button onClick={() => { reset(); onClose(); }} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-3">Just enter the camera name and IP address — the system auto-discovers a working stream.</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Device Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Gate Cam" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
          </div>
          <div>
            <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">IP Address</label>
            <input value={ip} onChange={(e) => { setIp(e.target.value); setStreamUrl(''); setResult(null); }} placeholder="192.168.1.50" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
          </div>
          <div>
            <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Location (optional)</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Main Entrance" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
          </div>
        </div>

        {streamUrl && (
          <div className="mt-3 relative aspect-video bg-gray-900 rounded-xl overflow-hidden">
            <img src={streamUrl} alt="IP stream preview" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">LIVE PREVIEW · {ip}</div>
          </div>
        )}

        {result && (
          <div className={`mt-3 p-3 rounded-lg border flex items-start gap-2 text-sm ${result.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {result.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
            <div>{result.msg}</div>
          </div>
        )}

        <button onClick={handleConnect} disabled={busy} className="mt-4 w-full py-2.5 rounded-lg bg-[hsl(var(--kp-green))] text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />} {busy ? 'Connecting…' : 'Connect'}
        </button>
        <div className="mt-2 text-[11px] text-gray-400 text-center">Auto-probes common camera endpoints (MJPEG / snapshot). If none respond, the camera is saved offline for retry.</div>
      </div>
    </div>
  );
}