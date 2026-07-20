import React, { useRef, useState, useEffect } from 'react';
import { Camera, CameraOff, Loader2, RefreshCw } from 'lucide-react';

/**
 * CameraViewfinder — live camera preview using getUserMedia.
 * Props:
 *   active: boolean — whether camera should be streaming
 *   onStart, onStop, onError callbacks
 *   overlay: ReactNode rendered on top of the video (e.g. face frame, status)
 *   facingMode: 'user' | 'environment' (default 'user' = front camera)
 */
export default function CameraViewfinder({ active = false, onStart, onStop, onError, overlay, facingMode = 'user', children }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
  };

  const startCamera = async () => {
    setStarting(true);
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this device/browser.');
      }
      const constraints = {
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        // Fallback without facingMode (some desktops)
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStreaming(true);
      onStart && onStart();
    } catch (e) {
      const msg = e?.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access in your browser settings.'
        : e?.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : e?.message || 'Unable to access camera.';
      setError(msg);
      onError && onError(msg);
    } finally {
      setStarting(false);
    }
  };

  // Auto-start/stop based on active prop
  useEffect(() => {
    if (active && !streaming && !starting && !error) {
      startCamera();
    }
    if (!active && streaming) {
      stopStream();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Cleanup on unmount
  useEffect(() => () => stopStream(), []);

  return (
    <div className="relative aspect-[4/3] sm:aspect-video bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center">
      {/* Live video stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''} ${streaming ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Overlay (face frame, scan line, status) */}
      {streaming && (
        <div className="absolute inset-0 pointer-events-none">{overlay}</div>
      )}

      {/* Children (status text, buttons) */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {children}
      </div>

      {/* Idle / not started state */}
      {!streaming && !starting && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 gap-3">
          <Camera className="w-12 h-12 opacity-50" />
          <p className="text-sm px-4 text-center">Tap "Start Camera" to begin live face scan</p>
          <button onClick={startCamera} className="px-4 py-2 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-semibold hover:brightness-105 flex items-center gap-2">
            <Camera className="w-4 h-4" /> Start Camera
          </button>
        </div>
      )}

      {/* Starting state */}
      {starting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2 bg-black/40">
          <Loader2 className="w-10 h-10 animate-spin" />
          <p className="text-sm">Starting camera...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 bg-black/60 px-4 text-center">
          <CameraOff className="w-12 h-12 text-red-400" />
          <p className="text-sm text-red-300 max-w-xs">{error}</p>
          <button onClick={startCamera} className="px-4 py-2 rounded-lg bg-white/20 text-white text-sm font-semibold hover:bg-white/30 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Retry Camera
          </button>
        </div>
      )}

      {/* Live indicator */}
      {streaming && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 rounded-full px-2.5 py-1">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] text-white font-semibold">LIVE</span>
        </div>
      )}
    </div>
  );
}