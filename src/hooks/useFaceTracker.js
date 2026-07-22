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
      if (!video || !video.videoWidth || !video.clientWidth) return null;
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
        let minX = MW, maxX = 0, minY = MH, maxY = 0, n = 0;
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
        // bounding box of the moving region — a close face fills more of the
        // frame (large box => "near"), a distant face is a small motion cluster.
        if (n > 25) {
          const W = video.clientWidth, H = video.clientHeight;
          const vw = video.videoWidth, vh = video.videoHeight;
          const scale = Math.max(W / vw, H / vh);
          const dispW = vw * scale, dispH = vh * scale;
          const offX = (W - dispW) / 2, offY = (H - dispH) / 2;
          const padX = (maxX - minX) * 0.15, padY = (maxY - minY) * 0.15;
          const fx0 = Math.max(0, Math.min(1, (minX - padX) / MW));
          const fx1 = Math.max(0, Math.min(1, (maxX + padX) / MW));
          const fy0 = Math.max(0, Math.min(1, (minY - padY) / MH));
          const fy1 = Math.max(0, Math.min(1, (maxY + padY) / MH));
          let leftPx = offX + fx0 * dispW;
          let rightPx = offX + fx1 * dispW;
          if (mirror) { const l = offX + fx0 * dispW, r = offX + fx1 * dispW; leftPx = W - r; rightPx = W - l; }
          const topPx = offY + fy0 * dispH;
          const bottomPx = offY + fy1 * dispH;
          box = {
            left: leftPx / W,
            top: topPx / H,
            w: (rightPx - leftPx) / W,
            h: (bottomPx - topPx) / H,
          };
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