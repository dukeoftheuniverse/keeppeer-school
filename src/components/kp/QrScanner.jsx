import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, QrCode, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { KpButton } from '@/components/kp/ui';

/**
 * Real QR-code scanner using the native BarcodeDetector API (Chromium-based browsers).
 * Falls back to manual entry when the API or camera is unavailable.
 * props: onDetect(qrValue), disabled
 */
export default function QrScanner({ onDetect, disabled }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const lastDetectRef = useRef(0);
  const lastValueRef = useRef('');
  const [active, setActive] = useState(false);
  const [manual, setManual] = useState('');
  const [error, setError] = useState(null);
  const [lastValue, setLastValue] = useState(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'BarcodeDetector' in window);
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const start = async () => {
    setError(null);
    setLastValue(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      if (supported) scanLoop();
    } catch (err) {
      setError('Camera access denied. Enter the QR code manually below.');
    }
  };

  const scanLoop = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }
    (async () => {
      try {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const codes = await detector.detect(video);
        if (codes && codes.length > 0) {
          const value = codes[0].rawValue;
          const now = Date.now();
          // Debounce duplicate reads within 3s
          if (value && (value !== lastValueRef.current || now - lastDetectRef.current > 3000)) {
            lastValueRef.current = value;
            lastDetectRef.current = now;
            setLastValue(value);
            onDetect?.(value);
          }
        }
      } catch (e) { /* continue */ }
      rafRef.current = requestAnimationFrame(scanLoop);
    })();
  }, [onDetect, supported]);

  // Restart loop when supported/onDetect changes
  useEffect(() => {
    if (active && supported && !rafRef.current) scanLoop();
  }, [active, supported, scanLoop]);

  const handleManual = (e) => {
    e.preventDefault();
    if (!manual.trim()) return;
    setLastValue(manual.trim());
    onDetect?.(manual.trim());
  };

  return (
    <div>
      <div className="relative aspect-video max-w-md mx-auto rounded-2xl overflow-hidden bg-gray-900 mb-4">
        {active ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
            <Camera className="w-12 h-12 mb-2" />
            <p className="text-sm">Camera is off</p>
          </div>
        )}

        {active && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-44 h-44 border-2 border-white/70 rounded-xl">
              <div className="w-3 h-3 border-l-2 border-t-2 border-[hsl(var(--kp-green))] -translate-x-0.5 -translate-y-0.5" />
            </div>
          </div>
        )}
        {active && <div className="absolute inset-x-12 top-1/2 h-0.5 bg-[hsl(var(--kp-green))] animate-pulse" />}

        <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-black/50 text-white text-xs flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
          {active ? (supported ? 'Detecting QR...' : 'Manual mode') : 'Idle'}
        </div>
      </div>

      <div className="flex justify-center gap-2 mb-4">
        {!active
          ? <KpButton variant="green" onClick={start} disabled={disabled}><Camera className="w-4 h-4" /> Start Camera</KpButton>
          : <KpButton variant="danger" onClick={stop}>Stop Camera</KpButton>}
      </div>

      {error && (
        <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-600">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {lastValue && (
        <div className="mb-3 p-3 rounded-lg bg-green-50 border border-green-200 flex items-start gap-2 text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="min-w-0"><span className="font-medium">QR detected:</span> <span className="font-mono text-xs break-all">{lastValue}</span></div>
        </div>
      )}

      <form onSubmit={handleManual} className="max-w-md mx-auto">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={manual} onChange={e => setManual(e.target.value)} placeholder="Enter QR code manually..." className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
          </div>
          <KpButton type="submit" variant="teal">Scan</KpButton>
        </div>
      </form>

      {active && !supported && (
        <div className="mt-2 text-center text-[11px] text-gray-400 flex items-center justify-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Auto-detect unavailable in this browser — use manual entry.
        </div>
      )}
    </div>
  );
}