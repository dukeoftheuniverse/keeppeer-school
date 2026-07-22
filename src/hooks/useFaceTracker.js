import { useState, useEffect, useRef } from 'react';

/**
 * useFaceTracker — tracks up to 5 faces in the live <video> and returns their
 * positions as normalized (0–1) boxes relative to the rendered viewfinder.
 *
 * Primary: the browser FaceDetector API (Chrome/Edge). When it returns faces,
 * those are used directly (handles object-cover scaling + mirror).
 * Fallback: motion-based centroid tracking via frame differencing — the reticle
 * follows the moving face even if FaceDetector is unavailable or finds nothing.
 * Returns [] only after ~2s of no motion, so the reticle follows faces reliably.
 */
export function useFaceTracker(camRef, mirror = true, interval = 200) {
  const [faces, setFaces] = useState([]);
  const detectorRef = useRef(null);
  const canvasRef = useRef(null);
  const prevRef = useRef(null);
  const lastMotionRef = useRef(0);
  const lastBoxRef = useRef(null);
  const hasFaceDetector = typeof window !== 'undefined' && 'FaceDetector' in window;

  useEffect(() => {
    if (hasFaceDetector) {
      try {
        detectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
      } catch {
        /* ignore */
      }
    }
    const MW = 64, MH = 48;

    const motionBox = () => {
      const video = camRef.current && camRef.current.getVideo && camRef.current.getVideo();
      if (!video || !video.videoWidth) return null;
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
        canvasRef.current.width = MW;
        canvasRef.current.height = MH;
      }
      const ctx = canvasRef.current.getContext('2d');
      ctx.drawImage(video, 0, 0, MW, MH);
      const cur = ctx.getImageData(0, 0, MW, MH).data;
      let box = null;
      if (prevRef.current) {
        let minX = MW, minY = MH, maxX = 0, maxY = 0, n = 0;
        for (let y = 0; y < MH; y++) {
          for (let x = 0; x < MW; x++) {
            const i = (y * MW + x) * 4;
            const d = Math.abs(cur[i] - prevRef.current[i])
              + Math.abs(cur[i + 1] - prevRef.current[i + 1])
              + Math.abs(cur[i + 2] - prevRef.current[i + 2]);
            if (d > 45) {
              if (x < minX) minX = x; if (x > maxX) maxX = x;
              if (y < minY) minY = y; if (y > maxY) maxY = y;
              n++;
            }
          }
        }
        if (n > 25) {
          let cx = ((minX + maxX) / 2) / MW;
          const cy = ((minY + maxY) / 2) / MH;
          // Size from motion extent → reticle zooms with apparent face size (distance)
          let bw = ((maxX - minX) / MW) * 1.35;
          let bh = ((maxY - minY) / MH) * 1.45;
          bw = Math.min(Math.max(bw, 0.13), 0.55);
          bh = Math.min(Math.max(bh, 0.17), 0.65);
          if (mirror) cx = 1 - cx;
          const left = Math.min(Math.max(cx - bw / 2, 0), 1 - bw);
          const top = Math.min(Math.max(cy - bh / 2, 0), 1 - bh);
          box = { left, top, w: bw, h: bh };
        }
      }
      prevRef.current = cur;
      return box;
    };

    const id = setInterval(async () => {
      const video = camRef.current && camRef.current.getVideo && camRef.current.getVideo();
      if (!video || !video.videoWidth || !video.clientWidth) return;

      // Try FaceDetector first
      if (hasFaceDetector && detectorRef.current) {
        try {
          const detected = await detectorRef.current.detect(video);
          if (detected && detected.length) {
            const W = video.clientWidth, H = video.clientHeight;
            const vw = video.videoWidth, vh = video.videoHeight;
            const scale = Math.max(W / vw, H / vh);
            const dispW = vw * scale, dispH = vh * scale;
            const offX = (W - dispW) / 2, offY = (H - dispH) / 2;
            const mapped = detected.slice(0, 5).map((f) => {
              const b = f.boundingBox;
              const topPx = offY + b.y * scale;
              const wPx = b.width * scale, hPx = b.height * scale;
              let leftPx = offX + b.x * scale;
              if (mirror) leftPx = W - (offX + (b.x + b.width) * scale);
              return { left: leftPx / W, top: topPx / H, w: wPx / W, h: hPx / H };
            });
            setFaces(mapped);
            lastMotionRef.current = Date.now();
            lastBoxRef.current = mapped[0];
            return;
          }
        } catch {
          /* fall through to motion */
        }
      }

      // Fallback: motion-based centroid tracking
      const box = motionBox();
      if (box) {
        setFaces([box]);
        lastMotionRef.current = Date.now();
        lastBoxRef.current = box;
      } else if (Date.now() - lastMotionRef.current > 2000) {
        setFaces([]);
        lastBoxRef.current = null;
      } else if (lastBoxRef.current) {
        setFaces([lastBoxRef.current]);
      }
    }, interval);

    return () => clearInterval(id);
  }, [camRef, mirror, interval, hasFaceDetector]);

  return faces;
}