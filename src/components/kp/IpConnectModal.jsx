import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { logAudit } from '@/lib/audit';
import { X, Loader2, CheckCircle2, AlertTriangle, Wifi, Radar, Camera, Plus } from 'lucide-react';

// Common IP-camera MJPEG / snapshot endpoints to auto-probe from a bare IP.
const PATHS = ['', '/video', '/mjpg/video.mjpg', '/video.mjpg', '/stream', '/cgi-bin/video', '/live', '/mjpg/1/video.mjpg'];
const COMMON_PORTS = [8080, 80, 8000];

function probe(url, timeoutMs = 2500) {
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

function buildCandidates(ip) {
  let proto = 'http';
  let host = ip.trim();
  if (/^https:\/\//i.test(host)) proto = 'https';
  host = host.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (!host) return [];
  const hasPort = /:\d+$/.test(host);
  const hosts = hasPort ? [host] : [host, `${host}:8080`];
  const list = [];
  hosts.forEach((h) => PATHS.forEach((p) => list.push(`${proto}://${h}${p}`)));
  return list;
}

async function discoverIp(ip, ports = COMMON_PORTS, perTimeout = 2500) {
  const results = [];
  for (const port of ports) {
    for (const p of PATHS) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await probe(`http://${ip}:${port}${p}`, perTimeout);
      if (ok) results.push({ url: `http://${ip}:${port}${p}`, port, path: p });
    }
  }
  return results;
}

export default function IpConnectModal({ open, onClose, onConnected }) {
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [streamUrl, setStreamUrl] = useState('');

  // Auto-scan network state
  const [subnet, setSubnet] = useState('192.168.1');
  const [scanPorts, setScanPorts] = useState('8080,80');
  const [scanRange, setScanRange] = useState('1-254');
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);
  const [foundCameras, setFoundCameras] = useState([]);
  const [scanLog, setScanLog] = useState('');
  const scanAbort = useRef(false);

  if (!open) return null;

  const reset = () => { setName(''); setIp(''); setLocation(''); setResult(null); setStreamUrl(''); setBusy(false); setFoundCameras([]); setScanProgress(0); setScanTotal(0); setScanLog(''); scanAbort.current = false; };

  const discover = async (hostIp) => {
    const candidates = buildCandidates(hostIp);
    if (candidates.length === 0) return '';
    for (const c of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await probe(c)) return c;
    }
    return '';
  };

  const parseRange = (str) => {
    const m = str.match(/^(\d+)-(\d+)$/);
    if (m) { const a = parseInt(m[1]); const b = parseInt(m[2]); return [a, b]; }
    const n = parseInt(str);
    if (!isNaN(n)) return [n, n];
    return [1, 254];
  };

  const handleScan = async () => {
    scanAbort.current = false;
    setScanning(true);
    setFoundCameras([]);
    setScanLog('Starting network scan…');
    const [start, end] = parseRange(scanRange);
    const ports = scanPorts.split(',').map((s) => s.trim()).filter(Boolean).map(Number).filter((n) => !isNaN(n));
    const portList = ports.length ? ports : COMMON_PORTS;
    const total = (end - start + 1);
    setScanTotal(total);
    setScanProgress(0);
    let checked = 0;
    const found = [];

    // Probe IPs with limited concurrency for speed
    const concurrency = 12;
    let cursor = start;
    const worker = async () => {
      while (cursor <= end && !scanAbort.current) {
        const host = cursor++;
        const ipFull = `${subnet}.${host}`;
        for (const port of portList) {
          for (const p of PATHS) {
            if (scanAbort.current) return;
            // eslint-disable-next-line no-await-in-loop
            const ok = await probe(`http://${ipFull}:${port}${p}`, 1200);
            if (ok) {
              const url = `http://${ipFull}:${port}${p}`;
              found.push({ ip: ipFull, port, path: p, url });
              setFoundCameras([...found]);
              setScanLog(`✓ Camera found at ${ipFull}:${port}${p}`);
              return;
            }
          }
        }
        checked++;
        setScanProgress(checked);
      }
    };
    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);
    setScanning(false);
    setScanLog(scanAbort.current ? 'Scan stopped.' : (found.length ? `Scan complete — ${found.length} camera(s) found.` : `Scan complete — no cameras responded on ${subnet}.* ports ${portList.join('/')}.`));
  };

  const stopScan = () => { scanAbort.current = true; setScanning(false); };

  const addFoundCamera = async (cam) => {
    try {
      const created = await base44.entities.ScannerDevice.create({
        deviceName: `IP Camera ${cam.ip}`,
        deviceId: 'IP-' + Date.now().toString().slice(-6),
        deviceType: 'IP Camera',
        streamUrl: cam.url,
        ipAddress: cam.ip,
        location: '',
        campus: '', assignedBuilding: '', assignedRoom: '',
        status: 'Online',
        registeredDate: new Date().toLocaleDateString('en-CA'),
        notes: `Auto-discovered — port ${cam.port}${cam.path}`,
      });
      await logAudit('Camera Configuration', 'ScannerDevice', created.id, `Auto-discovered IP camera at ${cam.ip} → ${cam.url}.`);
      setFoundCameras((prev) => prev.filter((c) => c.ip !== cam.ip));
    } catch (e) {
      setScanLog('Save failed: ' + (e?.message || e));
    }
  };

  const handleConnect = async () => {
    if (!name || !ip) { setResult({ ok: false, msg: 'Device name and IP address are required.' }); return; }
    setBusy(true); setResult(null); setStreamUrl('');
    const found = await discover(ip);
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
      <div className="kp-panel rounded-2xl shadow-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto kp-scroll-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
            <h3 className="text-base font-bold text-[hsl(var(--kp-teal))]">Connect IP Camera</h3>
          </div>
          <button onClick={() => { reset(); onClose(); }} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {/* Auto-Scan Network */}
        <div className="mb-4 rounded-xl border border-[hsl(var(--kp-teal))]/20 bg-[hsl(var(--accent))]/40 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Radar className="w-4 h-4 text-[hsl(var(--kp-teal))]" />
            <span className="text-sm font-bold text-[hsl(var(--kp-teal))]">Auto-Scan Network</span>
          </div>
          <p className="text-[11px] text-gray-500 mb-2">Scans your local network for cameras with reachable MJPEG/snapshot streams. Requires the camera to allow HTTP access and be on the same network as this device.</p>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div>
              <label className="text-[10px] font-medium text-[hsl(var(--kp-teal))] mb-0.5 block">Subnet</label>
              <input value={subnet} onChange={(e) => setSubnet(e.target.value)} placeholder="192.168.1" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-[hsl(var(--kp-teal))] mb-0.5 block">IP Range</label>
              <input value={scanRange} onChange={(e) => setScanRange(e.target.value)} placeholder="1-254" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-[hsl(var(--kp-teal))] mb-0.5 block">Ports</label>
              <input value={scanPorts} onChange={(e) => setScanPorts(e.target.value)} placeholder="8080,80" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
            </div>
          </div>
          <div className="flex gap-2 mb-2">
            {!scanning ? (
              <button onClick={handleScan} className="flex-1 py-2 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-xs font-bold flex items-center justify-center gap-1.5">
                <Radar className="w-3.5 h-3.5" /> Scan Network
              </button>
            ) : (
              <button onClick={stopScan} className="flex-1 py-2 rounded-lg bg-gray-500 text-white text-xs font-bold flex items-center justify-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Stop ({scanProgress}/{scanTotal})
              </button>
            )}
          </div>
          {scanning && (
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-[hsl(var(--kp-teal))] transition-all" style={{ width: `${scanTotal ? (scanProgress / scanTotal) * 100 : 0}%` }} />
            </div>
          )}
          {scanLog && <div className="text-[11px] text-gray-500 mb-2">{scanLog}</div>}
          {foundCameras.length > 0 && (
            <div className="space-y-1.5">
              {foundCameras.map((cam) => (
                <div key={cam.ip} className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200">
                  <Camera className="w-4 h-4 text-green-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-green-700">{cam.ip}:{cam.port}</div>
                    <div className="text-[10px] text-gray-500 font-mono truncate">{cam.url}</div>
                  </div>
                  <button onClick={() => addFoundCamera(cam)} className="px-2 py-1 rounded-lg bg-[hsl(var(--kp-green))] text-white text-[11px] font-bold flex items-center gap-1 shrink-0">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative mb-3">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
          <div className="relative flex justify-center"><span className="bg-white px-2 text-[11px] text-gray-400">or connect manually</span></div>
        </div>

        <p className="text-xs text-gray-500 mb-3">Enter the camera name and IP address — the system auto-probes common stream paths.</p>

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
      </div>
    </div>
  );
}