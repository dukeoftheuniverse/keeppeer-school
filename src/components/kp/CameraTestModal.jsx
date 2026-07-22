import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import CameraViewfinder from '@/components/kp/CameraViewfinder';
import { X, Loader2, CheckCircle2, AlertTriangle, Sun, CameraOff, Link2, Radar, RefreshCw } from 'lucide-react';

// Common HTTP snapshot endpoints for DVRs/NVRs that browsers CAN render as <img>.
// Dahua: /cgi-bin/snapshot.cgi?channel=N  |  Hikvision: /ISAPI/Streaming/channels/101/picture
const SNAPSHOT_PATHS = [
  '/cgi-bin/snapshot.cgi?channel=1',
  '/cgi-bin/snapshot.cgi?1',
  '/cgi-bin/snapshot.cgi?channel=3',
  '/ISAPI/Streaming/channels/101/picture',
  '/ISAPI/Streaming/channels/1/picture',
  '/Streaming/channels/1/picture',
  '/snap.jpg',
  '/cgi-bin/viewer/video.jpg?channel=1',
];
const SNAPSHOT_PORTS = [80, 8080];

function probeImage(url, timeoutMs = 2000) {
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

function isRtsp(url) { return /^rtsp:/i.test(url || ''); }
function ipFromDevice(device) {
  if (device?.ipAddress) return device.ipAddress.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').split(':')[0];
  const m = (device?.streamUrl || '').match(/^rtsp:\/\/[^@]*@?([0-9.]+)/);
  return m ? m[1] : '';
}

/** Test a camera feed before activation: live preview + low-light check. */
export default function CameraTestModal({ open, onClose, device }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [probing, setProbing] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState(null);
  const [probeMsg, setProbeMsg] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshTimer = useRef(null);

  const isRtspStream = isRtsp(device?.streamUrl);
  const ip = ipFromDevice(device);

  const discoverSnapshot = useCallback(async () => {
    if (!ip) { setProbeMsg('No IP address available to probe for snapshots.'); return null; }
    setProbing(true); setProbeMsg('Probing common DVR snapshot endpoints…');
    for (const port of SNAPSHOT_PORTS) {
      for (const path of SNAPSHOT_PATHS) {
        const url = `http://${ip}:${port}${path}`;
        // eslint-disable-next-line no-await-in-loop
        if (await probeImage(url, 1800)) {
          setSnapshotUrl(url);
          setProbeMsg(`Snapshot endpoint found: ${url}`);
          setProbing(false);
          return url;
        }
      }
    }
    setProbeMsg('No HTTP snapshot endpoint responded. The camera may require authentication, use a non-standard port, or block browser access.');
    setProbing(false);
    return null;
  }, [ip]);

  // Auto-probe snapshot when opening an RTSP device (or when the saved streamUrl fails to render)
  useEffect(() => {
    if (!open || !device?.streamUrl) return;
    setSnapshotUrl(null); setProbeMsg(null); setRefreshKey(0);
    if (isRtspStream) {
      discoverSnapshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, device?.streamUrl]);

  // Auto-refresh the snapshot every 2.5s for a "near-live" view
  useEffect(() => {
    if (snapshotUrl) {
      refreshTimer.current = setInterval(() => setRefreshKey((k) => k + 1), 2500);
    }
    return () => clearInterval(refreshTimer.current);
  }, [snapshotUrl]);

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
              {isRtspStream ? (
                snapshotUrl ? (
                  <>
                    <img key={refreshKey} src={snapshotUrl + (snapshotUrl.includes('?') ? '&' : '?') + '_kp=' + Date.now()} alt="Camera snapshot" className="w-full h-full object-cover" onError={() => {}} />
                    <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full font-mono flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5" /> SNAPSHOT · {ip} · 2.5s</div>
                  </>
                ) : (
                  <div className="p-4 text-center text-white/70 text-sm max-w-xs">
                    {probing ? <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" /> : <CameraOff className="w-8 h-8 mx-auto mb-2 opacity-70" />}
                    <p className="mb-2">RTSP streams cannot play directly in a browser. {probing ? 'Searching for a viewable snapshot endpoint…' : 'No snapshot endpoint found yet.'}</p>
                    {!probing && <button onClick={discoverSnapshot} className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 mx-auto"><Radar className="w-3.5 h-3.5" /> Probe Snapshot Endpoints</button>}
                  </div>
                )
              ) : (
                <>
                  <img src={device.streamUrl} alt="IP stream" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.querySelector('.kp-ip-fallback').style.display = 'flex'; }} />
                  <div className="kp-ip-fallback absolute inset-0 hidden flex-col items-center justify-center text-white/70 gap-2">
                    <CameraOff className="w-8 h-8" />
                    <span className="text-xs">Stream not displayable in-browser</span>
                    <button onClick={discoverSnapshot} className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5"><Radar className="w-3.5 h-3.5" /> Try Snapshot Endpoints</button>
                  </div>
                  <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">IP STREAM{device.ipAddress ? ` · ${device.ipAddress}` : ''}</div>
                </>
              )}
            </div>
            {probeMsg && (
              <div className="mt-2 text-[11px] text-gray-500 flex items-center gap-1.5"><Radar className="w-3 h-3 shrink-0" /> {probeMsg}</div>
            )}
            <div className="mt-3 flex gap-2">
              <a href={device.streamUrl} target="_blank" rel="noreferrer" className="flex-1 py-2.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white font-bold text-sm flex items-center justify-center gap-2"><Link2 className="w-4 h-4" /> Open Stream</a>
              <button onClick={onClose} className="px-4 py-2.5 rounded-lg bg-[hsl(var(--kp-green))] text-white font-bold text-sm">Done</button>
            </div>
            <div className="mt-3 text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-2">
              {isRtspStream
                ? 'RTSP (port 554) cannot be rendered by browsers. The system probes for an HTTP snapshot endpoint on port 80/8080 (Dahua /cgi-bin/snapshot.cgi, Hikvision /ISAPI/Streaming/.../picture). For true live video, set up a media relay (WebRTC/HLS transcoder) on a local server.'
                : 'If the preview is blank, the camera may block cross-origin browser access (CORS) or require authentication. Use an MJPEG or HTTP snapshot URL for in-browser preview.'}
            </div>
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