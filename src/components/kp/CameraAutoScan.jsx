import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { logAudit } from '@/lib/audit';
import { X, Loader2, CheckCircle2, Radar, Camera, Usb, Wifi, Bluetooth, Plus, RefreshCw, AlertTriangle } from 'lucide-react';

const PATHS = ['', '/video', '/mjpg/video.mjpg', '/video.mjpg', '/stream', '/cgi-bin/video', '/live', '/mjpg/1/video.mjpg', '/cgi-bin/snapshot.cgi', '/onvif/snapshot'];
const COMMON_PORTS = [8080, 80, 8000, 554];

function probe(url, timeoutMs = 1400) {
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

function parseRange(str) {
  const m = str.match(/^(\d+)-(\d+)$/);
  if (m) return [parseInt(m[1]), parseInt(m[2])];
  const n = parseInt(str);
  return isNaN(n) ? [1, 254] : [n, n];
}

// Result shape: { id, type: 'usb'|'ip'|'rtsp'|'bluetooth', label, detail, url?, rtspUrl?, ip?, raw? }

export default function CameraAutoScan({ open, onClose, onConnected, existingDevices = [] }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState([]);
  const [subnet, setSubnet] = useState('192.168.1');
  const [scanRange, setScanRange] = useState('1-254');
  const [scanPorts, setScanPorts] = useState('8080,80,554');
  const [log, setLog] = useState('');
  const [err, setErr] = useState(null);
  const abortRef = useRef(false);

  if (!open) return null;

  const reset = () => { setResults([]); setProgress(''); setLog(''); setErr(null); abortRef.current = false; };

  // USB / webcam detection
  const scanUsb = async () => {
    setErr(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) { setErr('Browser does not support device enumeration.'); return []; }
    try {
      try { const s = await navigator.mediaDevices.getUserMedia({ video: true }); s.getTracks().forEach((t) => t.stop()); } catch (e) { /* permission needed for labels */ }
      const devs = await navigator.mediaDevices.enumerateDevices();
      const cams = devs.filter((d) => d.kind === 'videoinput');
      const existingIds = new Set(existingDevices.map((d) => d.deviceId));
      return cams.map((c, i) => ({
        id: 'usb-' + (c.deviceId || i),
        type: 'usb',
        label: (c.label || `USB Camera ${i + 1}`).replace(/\s*\(.*?\)\s*/g, '').trim(),
        deviceId: c.deviceId || `CAM-${Date.now()}-${i}`,
      })).filter((c) => !existingIds.has(c.deviceId));
    } catch (e) { setErr('Camera access denied: ' + (e?.message || e)); return []; }
  };

  // Bluetooth pairing
  const scanBluetooth = async () => {
    setErr(null);
    if (!navigator.bluetooth) { return []; }
    try {
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
      if (!device) return [];
      return [{
        id: 'bt-' + (device.id || Date.now()),
        type: 'bluetooth',
        label: device.name || 'Bluetooth Camera',
        deviceId: 'BT-' + (device.id || Date.now().toString().slice(-6)),
        bluetoothId: device.id || '',
      }];
    } catch (e) { if (e?.name !== 'NotFoundError') setErr('Bluetooth: ' + (e?.message || e)); return []; }
  };

  // Network IP / RTSP scan
  const scanNetwork = async () => {
    setErr(null);
    const [start, end] = parseRange(scanRange);
    const ports = scanPorts.split(',').map((s) => s.trim()).filter(Boolean).map(Number).filter((n) => !isNaN(n));
    const portList = ports.length ? ports : COMMON_PORTS;
    const total = (end - start + 1) * portList.length * PATHS.length;
    const found = [];
    let checked = 0;
    setProgress(`Scanning ${subnet}.* ports ${portList.join('/')}…`);

    const concurrency = 14;
    let cursor = start;
    const worker = async () => {
      while (cursor <= end && !abortRef.current) {
        const host = cursor++;
        const ipFull = `${subnet}.${host}`;
        for (const port of portList) {
          for (const p of PATHS) {
            if (abortRef.current) return;
            // eslint-disable-next-line no-await-in-loop
            const ok = await probe(`http://${ipFull}:${port}${p}`, 1100);
            checked++;
            if (ok) {
              const url = `http://${ipFull}:${port}${p}`;
              const rtspUrl = `rtsp://${ipFull}:554/cam/realmonitor?channel=1&subtype=0`;
              found.push({
                id: 'ip-' + ipFull + '-' + port + p,
                type: port === 554 || p.includes('rtsp') ? 'rtsp' : 'ip',
                label: `Camera ${ipFull}:${port}`,
                detail: p || '/',
                url,
                rtspUrl,
                ip: ipFull,
                port,
              });
              setResults((prev) => {
                if (prev.some((r) => r.ip === ipFull)) return prev;
                return [...prev, found[found.length - 1]];
              });
            }
          }
        }
        if (checked % 20 === 0) setProgress(`Scanning… ${Math.min(100, Math.round((checked / total) * 100))}% (${found.length} found)`);
      }
    };
    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);
    return found;
  };

  const runFullScan = async () => {
    setBusy(true); setResults([]); setLog(''); setErr(null); abortRef.current = false;
    setLog('1/3 Detecting USB / webcam cameras…');
    const usb = await scanUsb();
    if (usb.length) setResults((prev) => [...prev, ...usb]);

    setLog('2/3 Scanning local network for IP / RTSP cameras…');
    const net = await scanNetwork();
    if (net.length) setResults((prev) => [...prev.filter((r) => !r.ip), ...net]);

    setLog('3/3 Pair a Bluetooth camera (optional — click to open picker)…');
    // Bluetooth requires user gesture and is interactive; we surface a button instead of auto-running.
    setBusy(false);
    setProgress(net.length || usb.length ? `Scan complete — ${usb.length + net.length} camera(s) found.` : 'Scan complete — no new cameras found.');
  };

  const addResult = async (r) => {
    try {
      const isRtsp = r.type === 'rtsp';
      const isBt = r.type === 'bluetooth';
      const created = await base44.entities.ScannerDevice.create({
        deviceName: isBt ? r.label : `IP Camera ${r.ip || ''}`.trim() || r.label,
        deviceId: r.deviceId || ('IP-' + Date.now().toString().slice(-6)),
        deviceType: isBt ? 'Bluetooth Camera' : (isRtsp ? 'IP Camera' : 'IP Camera'),
        streamUrl: isRtsp ? r.rtspUrl : (r.url || ''),
        ipAddress: r.ip || '',
        bluetoothId: r.bluetoothId || '',
        location: '', campus: '', assignedBuilding: '', assignedRoom: '',
        status: 'Online',
        registeredDate: new Date().toLocaleDateString('en-CA'),
        notes: isBt ? 'Paired via Bluetooth (BLE — no video).' : (isRtsp ? `Auto-discovered RTSP. Snapshot: ${r.url}` : `Auto-discovered — port ${r.port}${r.detail}`),
      });
      await logAudit('Camera Configuration', 'ScannerDevice', created.id, `Auto-scan added ${r.type} camera "${r.label}".`);
      setResults((prev) => prev.filter((x) => x.id !== r.id));
      onConnected && onConnected();
    } catch (e) { setErr('Save failed: ' + (e?.message || e)); }
  };

  const addBluetoothInline = async () => {
    const bt = await scanBluetooth();
    if (bt.length) { for (const b of bt) await addResult(b); }
  };

  const iconFor = (t) => t === 'usb' ? Usb : t === 'bluetooth' ? Bluetooth : t === 'rtsp' ? Wifi : Camera;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { reset(); onClose(); }}>
      <div className="kp-panel rounded-2xl shadow-2xl w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto kp-scroll-thin" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Radar className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
            <h3 className="text-base font-bold text-[hsl(var(--kp-teal))]">Auto-Scan All Cameras</h3>
          </div>
          <button onClick={() => { abortRef.current = true; reset(); onClose(); }} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <p className="text-xs text-gray-500 mb-3">One-click scan for <strong>USB/webcams</strong> (this device), <strong>IP cameras</strong> (local network), and <strong>RTSP streams</strong>. Bluetooth pairing opens on demand.</p>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div>
            <label className="text-[10px] font-medium text-[hsl(var(--kp-teal))] mb-0.5 block">Subnet</label>
            <input value={subnet} onChange={(e) => setSubnet(e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-[hsl(var(--kp-teal))] mb-0.5 block">IP Range</label>
            <input value={scanRange} onChange={(e) => setScanRange(e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-[hsl(var(--kp-teal))] mb-0.5 block">Ports</label>
            <input value={scanPorts} onChange={(e) => setScanPorts(e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          {!busy ? (
            <button onClick={runFullScan} className="flex-1 py-2.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-bold flex items-center justify-center gap-2">
              <Radar className="w-4 h-4" /> Start Full Scan
            </button>
          ) : (
            <button onClick={() => { abortRef.current = true; setBusy(false); }} className="flex-1 py-2.5 rounded-lg bg-gray-500 text-white text-sm font-bold flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Stop Scan
            </button>
          )}
          <button onClick={addBluetoothInline} className="px-3 py-2.5 rounded-lg border border-[hsl(var(--kp-teal))]/30 text-[hsl(var(--kp-teal))] text-sm font-bold flex items-center gap-1.5">
            <Bluetooth className="w-4 h-4" /> Pair BT
          </button>
        </div>

        {progress && <div className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />} {progress}</div>}
        {log && <div className="text-[11px] text-gray-400 mb-2">{log}</div>}
        {err && <div className="mb-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {err}</div>}

        {results.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-[hsl(var(--kp-teal))]">Discovered Cameras ({results.length})</div>
            {results.map((r) => {
              const Icon = iconFor(r.type);
              return (
                <div key={r.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 border border-green-200">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-green-600" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-green-700">{r.label} <span className="text-[10px] uppercase font-mono text-gray-400 ml-1">{r.type}</span></div>
                    {r.detail && <div className="text-[10px] text-gray-500 font-mono truncate">{r.type === 'rtsp' ? r.rtspUrl : (r.url || r.detail)}</div>}
                  </div>
                  <button onClick={() => addResult(r)} className="px-2.5 py-1.5 rounded-lg bg-[hsl(var(--kp-green))] text-white text-xs font-bold flex items-center gap-1 shrink-0">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!busy && results.length === 0 && progress && (
          <div className="text-center py-6 text-gray-400 text-sm">No new cameras discovered. Try adjusting the subnet or ports.</div>
        )}
      </div>
    </div>
  );
}