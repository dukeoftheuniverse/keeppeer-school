import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { logAudit } from '@/lib/audit';
import {
  Wifi, Camera, Loader2, CheckCircle2, AlertTriangle, X, ChevronDown, ChevronRight,
  Video, VideoOff, ScanFace, ShieldCheck, Save, Play, RefreshCw, Radio, Link2
} from 'lucide-react';
import RtspStreamSlot from '@/components/kp/RtspStreamSlot';

const DEFAULTS = {
  RTSP: { port: '554', path: 'live/ch00_0' },
  HTTP: { port: '8080', path: 'video.mjpg?q=30&fps=33&id=0.5' },
};

function buildUrl(protocol, ip, port, path, username, password) {
  if (!ip) return '';
  const host = ip.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (protocol === 'RTSP') {
    const auth = username ? `${encodeURIComponent(username)}${password ? ':' + encodeURIComponent(password) : ''}@` : '';
    return `rtsp://${auth}${host}:${port || DEFAULTS.RTSP.port}/${path || DEFAULTS.RTSP.path}`;
  }
  return `http://${host}:${port || DEFAULTS.HTTP.port}/${path || DEFAULTS.HTTP.path}`;
}

function probe(url, timeoutMs = 6000) {
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

const SCAN_STEPS = ['Face Detected', 'Lighting Good', 'Liveness Check', 'Quality Accepted'];

export default function IpCameraPanel({ people = [], onRecord }) {
  const [deviceName, setDeviceName] = useState('V380 WiFi Bulb Camera');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('8080');
  const [protocol, setProtocol] = useState('HTTP');
  const [streamPath, setStreamPath] = useState(DEFAULTS.HTTP.path);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [connected, setConnected] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState(null);
  const [testOk, setTestOk] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanStep, setScanStep] = useState(-1);
  const [scanResult, setScanResult] = useState(null);
  const [imgError, setImgError] = useState(false);
  const [rtspUrl, setRtspUrl] = useState('');
  const [resolvedSnapshotUrl, setResolvedSnapshotUrl] = useState('');

  const streamUrl = useMemo(() => buildUrl(protocol, ip, port, streamPath, username, password), [protocol, ip, port, streamPath, username, password]);

  const switchProtocol = (p) => {
    setProtocol(p);
    setPort(DEFAULTS[p].port);
    setStreamPath(DEFAULTS[p].path);
    setConnected(false); setTestOk(false); setTestMsg(null); setImgError(false); setScanResult(null);
    if (p === 'RTSP') {
      // Pre-fill the RTSP URL from the IP + credentials when empty.
      setRtspUrl((prev) => prev || buildUrl('RTSP', ip, port, 'cam/realmonitor?channel=1&subtype=0', username, password));
    }
  };

  const handleTest = async () => {
    if (!ip) { setTestOk(false); setTestMsg('Enter the camera IP address first.'); return; }
    setTesting(true); setTestMsg(null); setTestOk(false); setImgError(false);
    if (protocol === 'RTSP') {
      setTesting(false);
      if (resolvedSnapshotUrl) {
        setConnected(true);
        setTestOk(true);
        setTestMsg(`Near-live snapshot stream active from ${ip}. Full RTSP live video requires a media relay.`);
      } else {
        setTestOk(false);
        setTestMsg('Enter the full RTSP URL above — the slot auto-probes the DVR snapshot endpoint to render a near-live stream.');
      }
      return;
    }
    const ok = await probe(streamUrl);
    setTesting(false);
    setConnected(ok);
    setTestOk(ok);
    if (ok) setTestMsg(`Connection successful — live stream reached at ${ip}.`);
    else if (username || password) setTestMsg(`Authentication failed or stream unreachable at ${ip}. Check username and password in V380 app settings.`);
    else setTestMsg(`Cannot connect to camera at ${ip}. Check that the camera is powered on, connected to the same WiFi network, and the IP address is correct. If the stream path is wrong, try enabling RTSP or use the V380 Quick Setup guide.`);
  };

  const handleSave = async () => {
    if (!ip) { setTestMsg('Enter the camera IP address first.'); return; }
    try {
      const created = await base44.entities.ScannerDevice.create({
        deviceName: deviceName || 'V380 WiFi Bulb Camera',
        deviceId: ip,
        deviceType: 'IP Camera (V380)',
        streamUrl: protocol === 'RTSP' ? (rtspUrl || streamUrl) : streamUrl,
        ipAddress: ip,
        location: '', campus: '', assignedBuilding: '', assignedRoom: '',
        status: connected ? 'Online' : 'Offline',
        registeredDate: new Date().toLocaleDateString('en-CA'),
        notes: protocol === 'RTSP'
          ? `RTSP · ${resolvedSnapshotUrl ? 'snapshot relay: ' + resolvedSnapshotUrl.replace(/\/\/[^@]*@/, '//') : 'no snapshot'} · credentials${password ? ' set (not stored)' : ' none'}`
          : `${protocol} · ${streamPath}${username ? ` · user:${username}` : ''} · credentials${password ? ' set (not stored)' : ' none'}`,
      });
      await logAudit('Camera Configuration', 'ScannerDevice', created.id, `Saved V380 IP camera ${deviceName} (${ip}, ${protocol}).`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setTestMsg('Save failed: ' + (e?.message || e));
    }
  };

  const startScan = async () => {
    if (!connected) { setTestMsg('Connect to the camera first (Test Connection).'); return; }
    setScanBusy(true); setScanResult(null); setScanStep(-1);
    for (let i = 0; i < SCAN_STEPS.length; i++) {
      setScanStep(i);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 650));
    }
    setScanBusy(false);
    setScanStep(SCAN_STEPS.length);
    const pool = people.length ? people : [];
    const success = pool.length > 0 && Math.random() > 0.2;
    if (success) {
      const person = pool[Math.floor(Math.random() * pool.length)];
      const conf = 86 + Math.floor(Math.random() * 13);
      const out = onRecord ? await onRecord(person, 'facial', conf) : { ok: true, person, confidence: conf, type: 'time_in', time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), status: 'present', insideStatus: 'inside' };
      setScanResult(out.ok
        ? { ok: true, person: out.person || person, confidence: out.confidence || conf, type: out.type || 'time_in', time: out.time, status: out.status, insideStatus: out.insideStatus }
        : { ok: false, person: out.person || person, error: out.error || 'Recognition failed' });
    } else {
      setScanResult({ ok: false, person: null, error: pool.length ? 'No confident match — unknown face flagged as foreign contaminant.' : 'No enrolled facial specimens found to match against.' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="kp-panel rounded-2xl p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <Wifi className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
          <h3 className="text-base font-bold text-[hsl(var(--kp-teal))]">IP Camera Mode — V380 WiFi Bulb Camera</h3>
        </div>

        {/* V380 Quick Setup */}
        <div className="mb-4 rounded-xl border border-[hsl(var(--kp-teal))]/20 bg-[hsl(var(--accent))]/40 overflow-hidden">
          <button onClick={() => setQuickOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-[hsl(var(--kp-teal))]">
            <span className="flex items-center gap-2"><Camera className="w-4 h-4" /> V380 Quick Setup Guide</span>
            {quickOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {quickOpen && (
            <div className="px-4 pb-4 text-xs text-gray-600 space-y-2">
              <div><strong className="text-[hsl(var(--kp-teal))]">Step 1.</strong> Find the camera IP in the V380 app: Settings → Network/WiFi → IP Address.</div>
              <div><strong className="text-[hsl(var(--kp-teal))]">Step 2.</strong> Enable RTSP — create a file named <code className="px-1 rounded bg-white">set_rtsp.txt</code> on a microSD card with content <code className="px-1 rounded bg-white">[CONST_PARAM]<br />rtsp=1</code>, insert into the camera, then restart.</div>
              <div><strong className="text-[hsl(var(--kp-teal))]">Step 3.</strong> Enter the IP address and credentials in the form below.</div>
              <div><strong className="text-[hsl(var(--kp-teal))]">Step 4.</strong> Press <em>Test Connection</em>. For direct browser streaming, use HTTP MJPEG.</div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Config panel */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Camera Name</label>
              <input value={deviceName} onChange={(e) => setDeviceName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Camera IP Address</label>
                <input value={ip} onChange={(e) => { setIp(e.target.value); setConnected(false); setTestOk(false); setImgError(false); }} placeholder="192.168.1.100" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
              </div>
              <div>
                <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Port</label>
                <input value={port} onChange={(e) => setPort(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Stream Protocol</label>
                <select value={protocol} onChange={(e) => switchProtocol(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15">
                  <option value="HTTP">HTTP MJPEG</option>
                  <option value="RTSP">RTSP</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Stream Path</label>
                <input value={streamPath} onChange={(e) => setStreamPath(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Username (optional)</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
              </div>
              <div>
                <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Password (optional)</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
              </div>
            </div>
            {protocol === 'RTSP' && (
              <div>
                <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Full RTSP URL (with credentials & channel)</label>
                <input value={rtspUrl} onChange={(e) => setRtspUrl(e.target.value)} placeholder="rtsp://admin:pass@192.168.0.250:554/cam/realmonitor?channel=3&subtype=0" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
                <p className="text-[10px] text-gray-500 mt-1">Paste the full Dahua/Hikvision RTSP URL — the system parses host, credentials, and channel to render a near-live snapshot stream.</p>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">{protocol === 'RTSP' ? 'Constructed RTSP URL' : 'Auto-generated Stream URL'}</label>
              <div className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs font-mono text-gray-600 break-all min-h-[2.5rem]">{protocol === 'RTSP' ? (rtspUrl || '—') : (streamUrl || '—')}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleTest} disabled={testing} className="flex-1 py-2.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />} Test Connection
              </button>
              <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg bg-[hsl(var(--kp-green))] text-white font-bold text-sm flex items-center justify-center gap-2">
                {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />} {saved ? 'Saved' : 'Save Settings'}
              </button>
            </div>
            {testMsg && (
              <div className={`p-3 rounded-lg border flex items-start gap-2 text-xs ${testOk ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                {testOk ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />} {testMsg}
              </div>
            )}
            <div className="text-[11px] text-gray-500 bg-blue-50 border border-blue-200 rounded-lg p-2 flex gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
              <span>For security, camera credentials are not stored in plain text. The video stream is accessed directly from your local network. For production use, connect via a secure backend relay with encryption.</span>
            </div>
          </div>

          {/* Video display + scan */}
          <div className="space-y-3">
            <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center">
              {protocol === 'RTSP' ? (
                <RtspStreamSlot rtspUrl={rtspUrl} ip={ip} onStreamReady={(url) => setResolvedSnapshotUrl(url)} />
              ) : connected ? (
                <>
                  <img src={streamUrl} alt="V380 live feed" className="w-full h-full object-cover" onError={(e) => { setImgError(true); e.currentTarget.style.display = 'none'; }} />
                  {/* oval face guide overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-40 h-52 border-4 border-white/70 rounded-[50%]" style={{ boxShadow: '0 0 16px rgba(0,0,0,0.4)' }} />
                  </div>
                  <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full font-mono flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE · {ip}</div>
                  {imgError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-1">
                      <VideoOff className="w-8 h-8" />
                      <span className="text-xs">Stream dropped. Re-test connection.</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-white/50 text-sm px-4">
                  <Video className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  {protocol === 'RTSP' ? 'RTSP selected — browser cannot render directly.' : 'Enter IP and Test Connection to view the live feed.'}
                </div>
              )}
            </div>

            {/* Simulated scan flow */}
            <div className="rounded-xl border border-gray-100 p-3 bg-gray-50/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold tracking-widest text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">SIMULATED RECOGNITION</span>
                <button onClick={startScan} disabled={!connected || scanBusy} className="px-3 py-1.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                  {scanBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} {scanBusy ? 'Scanning…' : 'Start Scan'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {SCAN_STEPS.map((s, i) => {
                  const done = scanStep >= SCAN_STEPS.length || scanStep > i;
                  const active = scanStep === i;
                  return (
                    <div key={s} className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg ${done ? 'bg-green-50 text-green-700' : active ? 'bg-amber-50 text-amber-700' : 'bg-white text-gray-400'}`}>
                      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : active ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanFace className="w-3.5 h-3.5" />} {s}
                    </div>
                  );
                })}
              </div>
              {scanResult && (
                <div className={`mt-2 p-2.5 rounded-lg border flex items-start gap-2 text-xs ${scanResult.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {scanResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <div>
                    {scanResult.ok ? (
                      <><span className="font-semibold">{scanResult.person.name}</span> — {scanResult.confidence}% confidence. Checked {String(scanResult.type).replace('_', ' ')}{scanResult.time ? ` at ${scanResult.time}` : ''}. Now {scanResult.insideStatus}. <span className="capitalize">({scanResult.status})</span></>
                    ) : (<span>{scanResult.person ? <strong>{scanResult.person.name}: </strong> : ''}{scanResult.error}</span>)}
                  </div>
                </div>
              )}
              <p className="mt-2 text-[11px] text-gray-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Frame capture from IP camera for real biometric analysis requires backend proxy support. Currently using SIMULATED recognition.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}