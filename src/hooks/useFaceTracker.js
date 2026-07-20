import { useState, useEffect, useRef } from 'react';

/**
 * useFaceTracker — uses the browser FaceDetector API to locate up to 5 faces
 * in the live <video> and returns their positions as normalized (0–1) boxes
 * relative to the rendered viewfinder. Handles object-cover scaling + mirror.
 * Returns [] when FaceDetector is unavailable (graceful fallback to centered reticle).
 */
export function useFaceTracker(camRef, mirror = true, interval = 600) {
  const [faces, setFaces] = useState([]);
  const detectorRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('FaceDetector' in window)) return;
    try {
      detectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
    } catch {
      return;
    }
    const id = setInterval(async () => {
      const video = camRef.current && camRef.current.getVideo && camRef.current.getVideo();
      if (!video || !video.videoWidth || !video.clientWidth) return;
      try {
        const detected = await detectorRef.current.detect(video);
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
      } catch {
        /* detection frame failed — skip */
      }
    }, interval);
    return () => clearInterval(id);
  }, [camRef, mirror, interval]);

  return faces;
}