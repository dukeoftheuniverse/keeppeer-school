import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, ScanFace, RefreshCw, CheckCircle2, AlertTriangle, UserCircle, Fingerprint } from 'lucide-react';
import { KpButton, Avatar } from '@/components/kp/ui';

const SIZE = 28; // downscale size for comparison

function toGrayscale(data, w, h) {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  return gray;
}

function correlation(a, b) {
  const n = a.length;
  let meanA = 0, meanB = 0;
  for (let i = 0; i < n; i++) { meanA += a[i]; meanB += b[i]; }
  meanA /= n; meanB /= n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA, db = b[i] - meanB;
    num += da * db; denA += da * da; denB += db * db;
  }
  const denom = Math.sqrt(denA * denB);
  return denom === 0 ? 0 : num / denom;
}

function drawToCanvas(ctx, source, w, h) {
  ctx.drawImage(source, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

export default function FacialScanner({ enrolledPeople, onMatch, disabled }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const photoCacheRef = useRef({}); // personId -> Float32Array grayscale
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, scanning, detecting, matching, matched, no_face, error
  const [captured, setCaptured] = useState(null); // data URL preview
  const [matchResult, setMatchResult] = useState(null); // { person, confidence }
  const [error, setError] = useState(null);
  const [autoScan, setAutoScan] = useState(true);
  const [detector] = useState(() => {
    if (typeof window !== 'undefined' && 'FaceDetector' in window) {
      try { return new window.FaceDetector({ fastMode: true }); } catch (e) { return null; }
    }
    return null;
  });

  // Precompute grayscale signatures for enrolled photos
  useEffect(() => {
    const cache = {};
    const canvas = document.createElement('canvas');
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const loadPromises = enrolledPeople.map((p) => {
      return new Promise((resolve) => {
        if (!p.photo_url) { resolve(); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const data = drawToCanvas(ctx, img, SIZE, SIZE);
          cache[p.person_id || p.id] = toGrayscale(data, SIZE, SIZE);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = p.photo_url;
      });
    });
    Promise.all(loadPromises).then(() => { photoCacheRef.current = cache; });
  }, [enrolledPeople]);

  const stop = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const start = async () => {
    setError(null);
    setMatchResult(null);
    setCaptured(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      setStatus('scanning');
    } catch (err) {
      setStatus('error');
      setError('Camera access denied. Please grant camera permission for facial recognition.');
    }
  };

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = canvasRef.current;
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    // Mirror horizontally to match the front-camera preview
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-SIZE, 0);
    ctx.drawImage(video, 0, 0, SIZE, SIZE);
    ctx.restore();
    const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
    return toGrayscale(data, SIZE, SIZE);
  }, []);

  const detectFace = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return true; // assume face present if no detector
    if (!detector) return true; // no native FaceDetector — skip detection
    try {
      const faces = await detector.detect(video);
      return faces.length > 0;
    } catch (e) {
      return true; // fallback: assume present
    }
  }, [detector]);

  const matchAgainstEnrolled = useCallback((capturedGray) => {
    const cache = photoCacheRef.current;
    let best = null;
    let bestScore = -1;
    for (const p of enrolledPeople) {
      const key = p.person_id || p.id;
      const sig = cache[key];
      if (!sig) continue;
      const score = correlation(capturedGray, sig);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return { person: best, confidence: Math.max(0, Math.round(bestScore * 100)) };
  }, [enrolledPeople]);

  const savePreview = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0);
    ctx.restore();
    setCaptured(canvas.toDataURL('image/jpeg', 0.7));
  };

  const runScan = useCallback(async () => {
    setStatus('detecting');
    const hasFace = await detectFace();
    if (!hasFace) {
      setStatus('no_face');
      setError('No face detected. Please position your face in the guide oval.');
      return;
    }
    const capturedGray = captureFrame();
    if (!capturedGray) { setStatus('error'); return; }
    savePreview();
    setStatus('matching');
    // small delay for UX
    await new Promise(r => setTimeout(r, 400));
    const result = matchAgainstEnrolled(capturedGray);
    if (result.person && result.confidence >= 72) {
      setMatchResult(result);
      setStatus('matched');
      onMatch?.(result.person, result.confidence);
    } else if (result.person) {
      setMatchResult(result);
      setStatus('low_confidence');
      setError(`Best match: ${result.person.name} (${result.confidence}%). Confidence too low — try again with better lighting.`);
    } else {
      setStatus('no_match');
      setError('No enrolled face photos found. Please add profile photos to students/employees first.');
    }
  }, [detectFace, captureFrame, matchAgainstEnrolled, onMatch]);

  // Auto-scan loop when active
  useEffect(() => {
    if (!active || !autoScan || status === 'matched' || disabled) return;
    const interval = setInterval(() => {
      if (status === 'scanning') runScan();
    }, 2500);
    return () => clearInterval(interval);
  }, [active, autoScan, status, disabled, runScan]);

  const reset = () => {
    setMatchResult(null);
    setCaptured(null);
    setError(null);
    setStatus(active ? 'scanning' : 'idle');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500 flex items-center gap-1.5"><ScanFace className="w-4 h-4 text-[hsl(var(--kp-teal))]" /> Position face within the oval to scan.</p>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
          <input type="checkbox" checked={autoScan} onChange={e => setAutoScan(e.target.checked)} className="rounded border-gray-300" /> Auto
        </label>
      </div>

      <div className="relative aspect-square max-w-sm mx-auto rounded-2xl overflow-hidden bg-gray-900 mb-4">
        {active ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
            <ScanFace className="w-14 h-14 mb-2" />
            <p className="text-sm">Camera is off</p>
          </div>
        )}

        {/* Face guide oval */}
        {active && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-48 h-60 rounded-[50%] border-4 transition-colors ${
              status === 'matched' ? 'border-[hsl(var(--kp-green))]' :
              status === 'matching' || status === 'detecting' ? 'border-[hsl(var(--kp-teal))] animate-pulse' :
              status === 'no_face' ? 'border-[hsl(var(--kp-red))]' :
              'border-white/70'
            }`} />
          </div>
        )}

        {/* Scanning line */}
        {active && status === 'scanning' && (
          <div className="absolute inset-x-10 top-1/2 h-0.5 bg-[hsl(var(--kp-teal-light))] animate-pulse" />
        )}

        {/* Status badge */}
        <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-black/50 text-white text-xs flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${
            status === 'matched' ? 'bg-green-500' :
            status === 'scanning' ? 'bg-blue-500 animate-pulse' :
            status === 'matching' || status === 'detecting' ? 'bg-yellow-500 animate-pulse' :
            status === 'no_face' || status === 'no_match' || status === 'low_confidence' ? 'bg-red-500' :
            'bg-gray-500'
          }`} />
          {status === 'idle' && 'Idle'}
          {status === 'scanning' && 'Looking for face...'}
          {status === 'detecting' && 'Detecting...'}
          {status === 'matching' && 'Matching...'}
          {status === 'matched' && 'Matched!'}
          {status === 'no_face' && 'No face found'}
          {status === 'no_match' && 'No match'}
          {status === 'low_confidence' && 'Low confidence'}
          {status === 'error' && 'Error'}
        </div>
      </div>

      <canvas ref={canvasRef} width={SIZE} height={SIZE} className="hidden" />

      <div className="flex justify-center gap-2 mb-4">
        {!active ? (
          <KpButton variant="teal" onClick={start} disabled={disabled}><Camera className="w-4 h-4" /> Start Facial Scan</KpButton>
        ) : (
          <>
            <KpButton variant="green" onClick={runScan} disabled={disabled || status === 'matching'}><ScanFace className="w-4 h-4" /> Capture & Match</KpButton>
            <KpButton variant="danger" onClick={() => { stop(); setStatus('idle'); }}>Stop</KpButton>
          </>
        )}
        {(matchResult || error) && active && <KpButton variant="outline" onClick={reset}><RefreshCw className="w-4 h-4" /></KpButton>}
      </div>

      {captured && (
        <div className="flex justify-center mb-3">
          <img src={captured} alt="Captured face" className="w-24 h-24 rounded-xl object-cover border-2 border-[hsl(var(--kp-teal))]/30" />
        </div>
      )}

      {error && (
        <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-600">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {matchResult && (
        <div className={`p-3 rounded-lg border flex items-center gap-3 ${
          status === 'matched' ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
        }`}>
          {status === 'matched' ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" /> : <UserCircle className="w-5 h-5 text-orange-500 shrink-0" />}
          <Avatar name={matchResult.person.name} src={matchResult.person.photo_url} size="w-10 h-10" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-800">{matchResult.person.name}</div>
            <div className="text-xs text-gray-500">Confidence: {matchResult.confidence}%</div>
          </div>
          <div className="w-16">
            <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div className={`h-full rounded-full ${matchResult.confidence >= 80 ? 'bg-[hsl(var(--kp-green))]' : matchResult.confidence >= 60 ? 'bg-[hsl(var(--kp-orange))]' : 'bg-[hsl(var(--kp-red))]'}`} style={{ width: `${matchResult.confidence}%` }} />
            </div>
          </div>
        </div>
      )}

      {enrolledPeople.filter(p => p.photo_url).length === 0 && (
        <div className="text-center text-xs text-gray-400 py-2">
          <Fingerprint className="w-4 h-4 inline mr-1" /> No enrolled face photos yet. Add profile photos to students/employees to enable matching.
        </div>
      )}
    </div>
  );
}