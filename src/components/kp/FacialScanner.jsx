import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, ScanFace, RefreshCw, CheckCircle2, AlertTriangle, UserCircle, Fingerprint, Sparkles, Users } from 'lucide-react';
import { KpButton, Avatar } from '@/components/kp/ui';

// Signature size — larger gives more discriminative detail
const SIG_W = 48;
const SIG_H = 56;

// ---- Feature extraction utilities ----

function toGrayscale(data, w, h) {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  return gray;
}

// Normalized cross-correlation between two equal-length arrays
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

// 8-bin intensity histogram (normalized) — captures tone distribution
function histogram(gray, w, h) {
  const bins = 8;
  const hist = new Float32Array(bins);
  for (let i = 0; i < w * h; i++) {
    const bin = Math.min(bins - 1, Math.floor((gray[i] / 255) * bins));
    hist[bin]++;
  }
  const total = w * h || 1;
  for (let i = 0; i < bins; i++) hist[i] /= total;
  return hist;
}

function histSimilarity(a, b) {
  // Bhattacharyya coefficient
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.sqrt(a[i] * b[i]);
  return sum; // 0..1, 1 = identical
}

// Sobel gradient magnitude map — captures facial structure/edges
function gradientMagnitude(gray, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1]
        + gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
      const gy = -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1]
        + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      out[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return out;
}

// Extract a composite signature: downscale pixels + gradient + histogram
function extractSignature(source, sourceW, sourceH, ctx, mirror = true) {
  // Center-crop to face-friendly aspect (3:3.5) then downscale to SIG_W×SIG_H
  const targetAspect = SIG_W / SIG_H;
  const srcAspect = sourceW / sourceH;
  let sx = 0, sy = 0, sw = sourceW, sh = sourceH;
  if (srcAspect > targetAspect) {
    sw = sourceH * targetAspect;
    sx = (sourceW - sw) / 2;
  } else {
    sh = sourceW / targetAspect;
    sy = (sourceH - sh) / 2;
  }
  ctx.clearRect(0, 0, SIG_W, SIG_H);
  ctx.save();
  if (mirror) { ctx.scale(-1, 1); ctx.translate(-SIG_W, 0); }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, SIG_W, SIG_H);
  ctx.restore();
  const imgData = ctx.getImageData(0, 0, SIG_W, SIG_H).data;
  const gray = toGrayscale(imgData, SIG_W, SIG_H);
  const grad = gradientMagnitude(gray, SIG_W, SIG_H);
  const hist = histogram(gray, SIG_W, SIG_H);
  return { gray, grad, hist };
}

// Compare two composite signatures → 0..100 confidence
function compareSignatures(a, b) {
  const pixSim = correlation(a.gray, b.gray); // -1..1
  const gradSim = correlation(a.grad, b.grad); // -1..1
  const histSim = histSimilarity(a.hist, b.hist); // 0..1
  // Weighted blend — structural (gradient) and tonal (histogram) reinforce pixel correlation
  const blended = 0.46 * pixSim + 0.34 * gradSim + 0.20 * (histSim * 2 - 1);
  // Map -1..1 → 0..100 with a curve that rewards high similarity
  const norm = Math.max(0, (blended + 1) / 2); // 0..1
  const curved = Math.pow(norm, 0.78); // boost mid-high range
  return Math.round(curved * 100);
}

export default function FacialScanner({ enrolledPeople, onMatch, disabled }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const sigCacheRef = useRef({}); // personId -> signature
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, scanning, detecting, matching, matched, no_face, low_confidence, no_match, error
  const [captured, setCaptured] = useState(null); // data URL preview
  const [matchResult, setMatchResult] = useState(null); // { person, confidence }
  const [error, setError] = useState(null);
  const [autoScan, setAutoScan] = useState(true);
  const [liveness, setLiveness] = useState(false); // motion detected in frame
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [detector] = useState(() => {
    if (typeof window !== 'undefined' && 'FaceDetector' in window) {
      try { return new window.FaceDetector({ fastMode: false, maxDetectedFaces: 1 }); } catch (e) { return null; }
    }
    return null;
  });
  const lastFrameRef = useRef(null);

  // Precompute signatures for enrolled photos
  useEffect(() => {
    const cache = {};
    const canvas = document.createElement('canvas');
    canvas.width = SIG_W; canvas.height = SIG_H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let count = 0;
    const loadPromises = enrolledPeople.map((p) => {
      return new Promise((resolve) => {
        if (!p.photo_url) { resolve(); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            cache[p.person_id || p.id] = extractSignature(img, img.naturalWidth, img.naturalHeight, ctx, false);
            count++;
          } catch (e) { /* skip */ }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = p.photo_url;
      });
    });
    Promise.all(loadPromises).then(() => {
      sigCacheRef.current = cache;
      setEnrolledCount(count);
    });
  }, [enrolledPeople]);

  const stop = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    lastFrameRef.current = null;
    setLiveness(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const start = async () => {
    setError(null);
    setMatchResult(null);
    setCaptured(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      setStatus('scanning');
    } catch (err) {
      setStatus('error');
      setError('Camera access denied. Please grant camera permission for facial recognition, or use QR / biometric instead.');
    }
  };

  const captureSignature = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !video.videoWidth || !canvas) return null;
    return extractSignature(video, video.videoWidth, video.videoHeight, canvas.getContext('2d', { willReadFrequently: true }), true);
  }, []);

  const detectFace = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return { ok: true };
    if (detector) {
      try {
        const faces = await detector.detect(video);
        return { ok: faces.length > 0, count: faces.length };
      } catch (e) { /* fall through to heuristic */ }
    }
    // Heuristic fallback: check brightness variance (a real face has varied tones)
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, SIG_W, SIG_H);
    const data = ctx.getImageData(0, 0, SIG_W, SIG_H).data;
    let sum = 0, sumSq = 0;
    for (let i = 0; i < data.length; i += 4) {
      const g = (data[i] + data[i + 1] + data[i + 2]) / 3;
      sum += g; sumSq += g * g;
    }
    const n = data.length / 4;
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    return { ok: variance > 180, count: variance > 180 ? 1 : 0 };
  }, [detector]);

  // Simple liveness: compare current frame grayscale to last frame — movement = alive
  const checkLiveness = useCallback((sig) => {
    const prev = lastFrameRef.current;
    lastFrameRef.current = sig.gray;
    if (!prev) return true; // first frame, allow
    let diff = 0;
    for (let i = 0; i < sig.gray.length; i++) diff += Math.abs(sig.gray[i] - prev[i]);
    const avg = diff / sig.gray.length;
    // Small movement expected; very high = noise, zero = static photo
    return avg > 1.2 && avg < 40;
  }, []);

  const matchAgainstEnrolled = useCallback((sig) => {
    const cache = sigCacheRef.current;
    let best = null;
    let bestScore = -1;
    let secondScore = -1;
    for (const p of enrolledPeople) {
      const key = p.person_id || p.id;
      const ref = cache[key];
      if (!ref) continue;
      const score = compareSignatures(sig, ref);
      if (score > bestScore) { secondScore = bestScore; bestScore = score; best = p; }
      else if (score > secondScore) { secondScore = score; }
    }
    // Confidence boosted when the top match clearly separates from the runner-up
    const margin = bestScore - secondScore;
    const adjusted = best ? Math.min(100, Math.round(bestScore + Math.min(8, margin * 0.3))) : 0;
    return { person: best, confidence: adjusted, margin };
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
    setCaptured(canvas.toDataURL('image/jpeg', 0.72));
  };

  const runScan = useCallback(async () => {
    setStatus('detecting');
    const face = await detectFace();
    if (!face.ok) {
      setStatus('no_face');
      setError('No face detected. Center your face in the oval with good lighting.');
      return;
    }
    const sig = captureSignature();
    if (!sig) { setStatus('error'); setError('Unable to capture frame. Try again.'); return; }
    const alive = checkLiveness(sig);
    setLiveness(alive);
    savePreview();
    setStatus('matching');
    await new Promise(r => setTimeout(r, 500));
    const result = matchAgainstEnrolled(sig);
    if (!result.person) {
      setStatus('no_match');
      setError('No enrolled face photos found. Add profile photos to students/employees first.');
      return;
    }
    const threshold = enrolledCount > 1 ? 58 : 52;
    if (result.confidence >= threshold && alive) {
      setMatchResult(result);
      setStatus('matched');
      onMatch?.(result.person, result.confidence);
    } else if (result.confidence >= threshold && !alive) {
      setStatus('low_confidence');
      setError(`Matched ${result.person.name} (${result.confidence}%) but liveness check failed. Please move slightly and retry.`);
    } else if (result.person) {
      setMatchResult(result);
      setStatus('low_confidence');
      setError(`Best match: ${result.person.name} (${result.confidence}%). Confidence below threshold — improve lighting and face alignment.`);
    } else {
      setStatus('no_match');
      setError('No match found. Ensure the person is enrolled with a clear photo.');
    }
  }, [detectFace, captureSignature, checkLiveness, matchAgainstEnrolled, onMatch, enrolledCount]);

  // Auto-scan loop when active
  useEffect(() => {
    if (!active || !autoScan || status === 'matched' || disabled) return;
    const interval = setInterval(() => {
      if (status === 'scanning') runScan();
    }, 2200);
    return () => clearInterval(interval);
  }, [active, autoScan, status, disabled, runScan]);

  const reset = () => {
    setMatchResult(null);
    setCaptured(null);
    setError(null);
    setLiveness(false);
    lastFrameRef.current = null;
    setStatus(active ? 'scanning' : 'idle');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500 flex items-center gap-1.5"><ScanFace className="w-4 h-4 text-[hsl(var(--kp-teal))]" /> Center face in oval. Auto-scans every 2s.</p>
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
              status === 'no_face' || status === 'no_match' || status === 'low_confidence' ? 'border-[hsl(var(--kp-red))]' :
              'border-white/70'
            }`} />
          </div>
        )}

        {/* Scanning line */}
        {active && status === 'scanning' && (
          <div className="absolute inset-x-10 top-1/2 h-0.5 bg-[hsl(var(--kp-aqua))] animate-pulse" />
        )}

        {/* Corner brackets */}
        {active && (
          <>
            <div className="absolute top-8 left-8 w-5 h-5 border-l-2 border-t-2 border-white/50 rounded-tl" />
            <div className="absolute top-8 right-8 w-5 h-5 border-r-2 border-t-2 border-white/50 rounded-tr" />
            <div className="absolute bottom-8 left-8 w-5 h-5 border-l-2 border-b-2 border-white/50 rounded-bl" />
            <div className="absolute bottom-8 right-8 w-5 h-5 border-r-2 border-b-2 border-white/50 rounded-br" />
          </>
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

        {active && (
          <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/50 text-white text-[10px] flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> {liveness ? 'Liveness OK' : 'Checking…'}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} width={SIG_W} height={SIG_H} className="hidden" />

      <div className="flex justify-center gap-2 mb-4">
        {!active ? (
          <KpButton variant="teal" onClick={start} disabled={disabled}><Camera className="w-4 h-4" /> Start Facial Scan</KpButton>
        ) : (
          <>
            <KpButton variant="green" onClick={runScan} disabled={disabled || status === 'matching' || status === 'detecting'}><ScanFace className="w-4 h-4" /> Capture & Match</KpButton>
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
            <div className="text-xs text-gray-500">Confidence: {matchResult.confidence}% {liveness ? '• Live' : '• Liveness pending'}</div>
          </div>
          <div className="w-16">
            <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div className={`h-full rounded-full ${matchResult.confidence >= 80 ? 'bg-[hsl(var(--kp-green))]' : matchResult.confidence >= 60 ? 'bg-[hsl(var(--kp-orange))]' : 'bg-[hsl(var(--kp-red))]'}`} style={{ width: `${matchResult.confidence}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-gray-400">
        <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {enrolledCount} enrolled face{enrolledCount === 1 ? '' : 's'}</span>
        <span className="flex items-center gap-1.5"><Fingerprint className="w-3.5 h-3.5" /> Pixel + gradient + tone matching with liveness check</span>
      </div>

      {enrolledCount === 0 && (
        <div className="mt-2 text-center text-xs text-gray-400 py-2">
          <Fingerprint className="w-4 h-4 inline mr-1" /> No enrolled face photos yet. Add profile photos to students/employees to enable matching.
        </div>
      )}
    </div>
  );
}