import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * useAiFaceTracker — periodically captures a frame from the live <video> and
 * uses the vision LLM to detect every human face and return its exact bounding
 * box (normalized 0–1) relative to the rendered viewfinder.
 *
 * Because the LLM returns real face geometry, the reticle color (red = too far,
 * green = close enough to scan) is accurate, not a rough motion estimate.
 */
export function useAiFaceTracker(camRef, enabled = true, interval = 1200) {
  const [faces, setFaces] = useState([]);
  const busyRef = useRef(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!enabled) { setFaces([]); return; }
    let cancelled = false;
    let timer = null;

    const downscale = (dataURL, maxW = 384) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const w = img.width || maxW;
        const scale = Math.min(1, maxW / w);
        const cw = Math.round(w * scale);
        const ch = Math.round((img.height || (w * 0.75)) * scale);
        if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
        const c = canvasRef.current;
        c.width = cw; c.height = ch;
        c.getContext('2d').drawImage(img, 0, 0, cw, ch);
        c.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
      };
      img.onerror = () => resolve(null);
      img.src = dataURL;
    });

    const schedule = () => { if (!cancelled) timer = setTimeout(tick, interval); };

    const tick = async () => {
      if (cancelled) return;
      if (busyRef.current) { schedule(); return; }
      const cam = camRef.current;
      const video = cam && cam.getVideo && cam.getVideo();
      if (!cam || !cam.isStreaming || !cam.isStreaming() || !video || !video.videoWidth || !video.clientWidth) {
        schedule(); return;
      }
      busyRef.current = true;
      try {
        const dataURL = cam.capture && cam.capture();
        if (!dataURL) { return; }
        const blob = await downscale(dataURL);
        if (!blob || cancelled) { return; }
        const file = new File([blob], 'track.jpg', { type: 'image/jpeg' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        if (cancelled) return;
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: "Detect every human face in this image. For each face return a bounding box as normalized fractions (0 to 1) of the image dimensions: x = left edge, y = top edge, width, height. Respond ONLY with JSON, no prose.",
          file_urls: [file_url],
          response_json_schema: {
            type: 'object',
            properties: {
              faces: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    width: { type: 'number' },
                    height: { type: 'number' },
                  },
                },
              },
            },
          },
        });
        if (cancelled) return;
        // The capture() already mirrors the frame to match the on-screen
        // preview, so we only apply object-cover scaling (no extra mirror).
        const W = video.clientWidth, H = video.clientHeight;
        const vw = video.videoWidth, vh = video.videoHeight;
        const scale = Math.max(W / vw, H / vh);
        const dispW = vw * scale, dispH = vh * scale;
        const offX = (W - dispW) / 2, offY = (H - dispH) / 2;
        const arr = (res && Array.isArray(res.faces)) ? res.faces : [];
        const mapped = arr.slice(0, 5).map((f) => {
          const x = Math.max(0, Math.min(1, Number(f.x) || 0));
          const y = Math.max(0, Math.min(1, Number(f.y) || 0));
          const w = Math.max(0, Math.min(1, Number(f.width) || 0));
          const h = Math.max(0, Math.min(1, Number(f.height) || 0));
          return {
            left: (offX + x * dispW) / W,
            top: (offY + y * dispH) / H,
            w: (w * dispW) / W,
            h: (h * dispH) / H,
          };
        }).filter((b) => b.w > 0.03 && b.h > 0.03);
        if (!cancelled) setFaces(mapped);
      } catch (e) {
        /* ignore — retry next tick */
      } finally {
        busyRef.current = false;
        if (!cancelled) schedule();
      }
    };

    schedule();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [camRef, enabled, interval]);

  return faces;
}