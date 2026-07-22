import React, { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Loader2, RefreshCw, Camera, Wifi, Usb, Bluetooth, Maximize2, X } from 'lucide-react';
import RtspStreamSlot from '@/components/kp/RtspStreamSlot';

// Determine if a device is a local USB/webcam (no IP/stream URL)
function isLocalUsb(d) {
  if (/IP Camera/i.test(d.deviceType || '')) return false;
  if (d.streamUrl) return false;
  if (/^(BT-)/.test(d.deviceId)) return false;
  return true;
}

// Live tile for a single camera
function LiveTile({ device }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [state, setState] = useState('idle'); // idle | loading | live | error
  const [err, setErr] = useState(null);
  const isRtsp = /^rtsp:/i.test(device.streamUrl || '');
  const isIp = /IP Camera/i.test(device.deviceType || '') && !isRtsp && !!device.streamUrl;
  const isUsb = isLocalUsb(device);
  const isBt = /Bluetooth/i.test(device.deviceType || '');

  const start = async () => {
    if (!isUsb) return;
    setState('loading'); setErr(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera not supported.');
      const constraints = device.deviceId
        ? { video: { deviceId: { exact: device.deviceId } }, audio: false }
        : { video: true, audio: false };
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia(constraints); }
      catch (e) { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); }
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      setState('live');
    } catch (e) {
      const msg = e?.name === 'NotAllowedError' ? 'Camera permission denied.' : (e?.message || 'Camera unavailable.');
      setErr(msg); setState('error');
    }
  };

  const stop = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    if (isUsb) start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device.id]);

  const typeIcon = isUsb ? Usb : isBt ? Bluetooth : isRtsp ? Wifi : Camera;
  const TypeIcon = typeIcon;

  const [expanded, setExpanded] = useState(false);

  const inner = (
    <div className="relative w-full h-full bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center">
      {isUsb && (
        <>
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover -scale-x-100" style={{ opacity: state === 'live' ? 1 : 0 }} />
          {state === 'loading' && <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2"><Loader2 className="w-8 h-8 animate-spin" /><span className="text-xs">Starting camera…</span></div>}
          {state === 'idle' && <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 gap-2"><Camera className="w-8 h-8" /><span className="text-xs">Camera idle</span></div>}
          {state === 'error' && <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-2 text-center px-2"><VideoOff className="w-8 h-8 text-red-400" /><span className="text-xs text-red-300">{err}</span><button onClick={start} className="mt-1 px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5"><RefreshCw className="w-3 h-3" /> Retry</button></div>}
        </>
      )}
      {isIp && (
        <>
          <img src={device.streamUrl} alt={device.deviceName} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.dataset.err = '1'; }} />
          <div className="absolute inset-0 flex items-center justify-center text-white/40 pointer-events-none" data-fallback="1"><VideoOff className="w-8 h-8" /></div>
        </>
      )}
      {isRtsp && <RtspStreamSlot rtspUrl={device.streamUrl} ip={device.ipAddress} compact />}
      {isBt && <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 gap-2"><Bluetooth className="w-8 h-8" /><span className="text-xs text-center px-3">Bluetooth device — no video feed (BLE). Track pairing only.</span></div>}

      <div className="absolute top-2 left-2 bg-black/55 text-white text-[10px] px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
        <span className={`w-1.5 h-1.5 rounded-full ${state === 'live' || isIp || isRtsp ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} /> LIVE
      </div>
      <div className="absolute top-2 right-2 bg-black/55 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"><TypeIcon className="w-3 h-3" /> {isUsb ? 'USB' : isBt ? 'BT' : isRtsp ? 'RTSP' : 'IP'}</div>
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
        <div className="text-xs font-semibold text-white truncate">{device.deviceName}</div>
        <div className="text-[10px] text-white/60 truncate">{device.ipAddress || device.location || '—'}</div>
      </div>
    </div>
  );

  return (
    <div className="relative">
      <div className="aspect-video">{inner}</div>
      <button onClick={() => setExpanded(true)} className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70" title="Expand"><Maximize2 className="w-3.5 h-3.5" /></button>
      {expanded && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setExpanded(false)}>
          <div className="relative w-full max-w-4xl aspect-video" onClick={(e) => e.stopPropagation()}>{inner}</div>
          <button className="absolute top-4 right-4 p-2 rounded-lg bg-white/20 text-white"><X className="w-5 h-5" /></button>
        </div>
      )}
    </div>
  );
}

export default function CameraLiveMonitor({ devices = [] }) {
  const live = devices.filter((d) => d.status !== 'Disabled' && d.status !== 'Offline');
  return (
    <div className="kp-panel rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><Video className="w-4 h-4 text-[hsl(var(--kp-teal))]" /><h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">Live Monitor ({live.length})</h3></div>
        <span className="text-[11px] text-gray-400">Real-time feeds from all available cameras</span>
      </div>
      {live.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No live cameras available. Add or enable cameras to see live feeds.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {live.map((d) => <LiveTile key={d.id} device={d} />)}
        </div>
      )}
    </div>
  );
}