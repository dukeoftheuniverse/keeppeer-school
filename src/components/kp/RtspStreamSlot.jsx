import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, CameraOff, Radar, RefreshCw, Video, ShieldCheck } from 'lucide-react';

// Snapshot endpoints to probe for a Dahua/Hikvision DVR, derived from its RTSP URL.
const SNAPSHOT_PATHS_DAHUA = (ch) => [
  `/cgi-bin/snapshot.cgi?channel=${ch}`,
  `/cgi-bin/snapshot.cgi?${ch}`,
  `/cgi-bin/snapshot.cgi`,
];
const SNAPSHOT_PATHS_HIK = (ch) => [
  `/ISAPI/Streaming/channels/${ch}01/picture`,
  `/ISAPI/Streaming/channels/${ch}01/picture?videoType=jpg`,
  `/Streaming/channels/${ch}01/picture`,
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

/**
 * Parse a Dahua-style RTSP URL into its components.
 * rtsp://user:pass@192.168.0.250:554/cam/realmonitor?channel=3&subtype=0
 */
function parseRtsp(url) {
  try {
    const m = url.match(/^rtsp:\/\/([^:@/]+)(?::([^@/]*))?@?([0-9.]+)(?::(\d+))?(\/.*)?$/i);
    if (!m) return null;
    const [, username, password, host, port, rest = ''] = m;
    const chMatch = url.match(/channel=(\d+)/i);
    const channel = chMatch ? chMatch[1] : '1';
    return { username: decodeURIComponent(username || ''), password: decodeURIComponent(password || ''), host, port: port || '554', channel, rest };
  } catch {
    return null;
  }
}

function buildSnapshotCandidates(rtspUrl) {
  const parsed = parseRtsp(rtspUrl);
  if (!parsed) return [];
  const { host, username, password, channel } = parsed;
  const auth = username ? `${encodeURIComponent(username)}${password ? ':' + encodeURIComponent(password) : ''}@` : '';
  const list = [];
  SNAPSHOT_PORTS.forEach((port) => {
    SNAPSHOT_PATHS_DAHUA(channel).forEach((p) => list.push(`http://${auth}${host}:${port}${p}`));
    SNAPSHOT_PATHS_HIK(channel).forEach((p) => list.push(`http://${auth}${host}:${port}${p}`));
  });
  return list;
}

export default function RtspStreamSlot({ rtspUrl, ip, onStreamReady }) {
  const [probing, setProbing] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [msg, setMsg] = useState(null);
  const refreshTimer = useRef(null);

  const discover = useCallback(async () => {
    if (!rtspUrl) { setMsg('Enter an RTSP URL to derive a viewable stream.'); return null; }
    setProbing(true); setMsg('Parsing RTSP URL and probing DVR snapshot endpoints…');
    setSnapshotUrl(null);
    const candidates = buildSnapshotCandidates(rtspUrl);
    if (candidates.length === 0) { setMsg('Could not parse the RTSP URL.'); setProbing(false); return null; }
    for (const url of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await probeImage(url, 1800)) {
        setSnapshotUrl(url);
        setMsg(`Live snapshot endpoint found — rendering near-live stream from ${url.replace(/\/\/[^@]*@/, '//')}.`);
        setProbing(false);
        onStreamReady && onStreamReady(url);
        return url;
      }
    }
    setMsg('No HTTP snapshot endpoint responded. Check credentials, ensure the DVR allows HTTP on port 80, or set up a media relay for true live RTSP.');
    setProbing(false);
    return null;
  }, [rtspUrl, onStreamReady]);

  // Auto-probe on mount / when URL changes
  useEffect(() => {
    setRefreshKey(0);
    if (rtspUrl) discover();
    else { setSnapshotUrl(null); setMsg(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rtspUrl]);

  // Refresh snapshot every 2.5s for near-live motion
  useEffect(() => {
    if (snapshotUrl) refreshTimer.current = setInterval(() => setRefreshKey((k) => k + 1), 2500);
    return () => clearInterval(refreshTimer.current);
  }, [snapshotUrl]);

  const parsed = rtspUrl ? parseRtsp(rtspUrl) : null;

  return (
    <div className="space-y-3">
      <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center">
        {snapshotUrl ? (
          <>
            <img key={refreshKey} src={snapshotUrl + (snapshotUrl.includes('?') ? '&' : '?') + '_kp=' + Date.now()} alt="RTSP-derived live snapshot" className="w-full h-full object-cover" onError={() => {}} />
            <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full font-mono flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5" /> NEAR-LIVE · {parsed?.host || ip} · ch{parsed?.channel} · 2.5s</div>
            <div className="absolute bottom-2 right-2 bg-amber-500/90 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">RTSP → HTTP SNAPSHOT RELAY</div>
          </>
        ) : (
          <div className="p-4 text-center text-white/70 text-sm max-w-xs">
            {probing ? <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" /> : <Video className="w-8 h-8 mx-auto mb-2 opacity-70" />}
            <p className="mb-2">{probing ? 'Probing DVR for a viewable snapshot stream…' : 'Enter the full RTSP URL above.'}</p>
            {!probing && parsed && <button onClick={discover} className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 mx-auto"><Radar className="w-3.5 h-3.5" /> Probe Snapshot Endpoints</button>}
          </div>
        )}
      </div>
      {msg && (
        <div className="text-[11px] text-gray-500 flex items-center gap-1.5"><Radar className="w-3 h-3 shrink-0" /> {msg}</div>
      )}
      <div className="text-[11px] text-gray-500 bg-blue-50 border border-blue-200 rounded-lg p-2 flex gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
        <span>Browsers can't play RTSP directly. This slot parses your RTSP URL (host, credentials, channel) and renders a near-live snapshot from the DVR's HTTP snapshot endpoint every 2.5s. For true continuous video, run a WebRTC/HLS media relay on a local server.</span>
      </div>
    </div>
  );
}