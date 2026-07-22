import React from 'react';

/**
 * IronManHUD — cinematic face-tracking overlay for the attendance scanner.
 * When `faces` (normalized 0–1 boxes) are provided, renders a targeting reticle
 * around each detected face (up to 5). Otherwise shows a centered tracking reticle.
 * Color shifts with the scan phase (idle / scanning / success / fail).
 */
const NEAR = 0.2; // face diameter fraction of the frame at which it's "close enough" to scan

export default function IronManHUD({ phase, unknown, okCount, faces }) {
  const c = phase === 'scanning' ? '#FACC15'
    : phase === 'success' ? '#22C55E'
    : phase === 'fail' ? '#EF4444'
    : '#2DD4BF';

  const statusText = phase === 'scanning' ? '◢ SCANNING · ANALYZING'
    : phase === 'success' ? `◉ TARGET LOCKED · ${okCount} LOGGED`
    : phase === 'fail' ? (unknown ? '⚠ INTRUDER DETECTED' : '✕ NO MATCH')
    : '◎ FACE TRACKING ACTIVE';

  const hasFaces = Array.isArray(faces) && faces.length > 0;
  const corners = [
    'top-2 left-2 border-l-2 border-t-2',
    'top-2 right-2 border-r-2 border-t-2',
    'bottom-2 left-2 border-l-2 border-b-2',
    'bottom-2 right-2 border-r-2 border-b-2',
  ];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, transparent 55%, ${c}1f 100%)` }} />

      {corners.map((cls, i) => (
        <div key={i} className={`absolute w-8 h-8 rounded-sm ${cls}`} style={{ borderColor: c, boxShadow: `0 0 8px ${c}66` }} />
      ))}

      <div className="absolute left-0 right-0 h-px kp-scanline" style={{ background: `linear-gradient(90deg, transparent, ${c}, transparent)`, boxShadow: `0 0 10px ${c}, 0 0 20px ${c}` }} />

      {hasFaces ? (
        faces.slice(0, 5).map((f, i) => {
          const cx = f.left + f.w / 2;
          const cy = f.top + f.h / 2;
          const d = Math.max(f.w, f.h) * 1.05;
          const near = d >= NEAR;
          const fc = near ? '#22C55E' : '#EF4444';
          const left = cx - d / 2;
          const top = cy - d / 2;
          return (
            <div key={i} className="absolute aspect-square transition-all duration-200 ease-out" style={{ left: `${left * 100}%`, top: `${top * 100}%`, width: `${d * 100}%` }}>
              <div className="absolute inset-0 rounded-full border-2" style={{ borderColor: fc, boxShadow: `0 0 14px ${fc}aa` }} />
              <div className="absolute inset-1.5 rounded-full border-2 border-dashed animate-spin" style={{ borderColor: `${fc}cc`, animationDuration: '4s' }} />
              <div className="absolute -inset-1 rounded-full border border-dashed animate-spin" style={{ borderColor: `${fc}55`, animationDuration: '7s', animationDirection: 'reverse' }} />
              <div className="absolute -top-1 -left-1 w-3 h-3 border-l-2 border-t-2" style={{ borderColor: fc }} />
              <div className="absolute -top-1 -right-1 w-3 h-3 border-r-2 border-t-2" style={{ borderColor: fc }} />
              <div className="absolute -bottom-1 -left-1 w-3 h-3 border-l-2 border-b-2" style={{ borderColor: fc }} />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 border-r-2 border-b-2" style={{ borderColor: fc }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ background: fc, boxShadow: `0 0 10px ${fc}` }} />
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-mono whitespace-nowrap px-1.5 rounded-full" style={{ color: '#fff', background: fc }}>
                {near ? `READY · FACE ${i + 1}` : `TOO FAR · COME CLOSER`}
              </div>
            </div>
          );
        })
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative kp-track" style={{ width: '11rem', height: '11rem' }}>
            <div className="absolute inset-0 rounded-full border-2 border-dashed animate-spin" style={{ borderColor: c, animationDuration: '6s' }} />
            <div className="absolute inset-4 rounded-full border" style={{ borderColor: `${c}66` }} />
            <div className="absolute inset-8 rounded-full border border-dashed" style={{ borderColor: `${c}40`, animationDuration: '9s' }} />
            <div className="absolute top-1/2 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${c}, transparent)` }} />
            <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: `linear-gradient(180deg, transparent, ${c}, transparent)` }} />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full" style={{ background: c, boxShadow: `0 0 12px ${c}` }} />
          </div>
        </div>
      )}

      <div className="absolute top-3 left-3 text-[10px] font-mono leading-tight" style={{ color: c }}>
        <div className="font-bold tracking-widest">◢ J.A.R.V.I.S</div>
        <div className="opacity-70">ATTENDANCE MODULE</div>
      </div>
      <div className="absolute top-3 right-3 text-[10px] font-mono text-right leading-tight" style={{ color: c }}>
        <div className="font-bold tracking-widest">SYS · ONLINE</div>
        <div className="opacity-70">TRACK: {hasFaces ? `${faces.length} FACE${faces.length > 1 ? 'S' : ''}` : 'ACTIVE'}</div>
      </div>
      <div className="absolute bottom-3 left-3 text-[10px] font-mono" style={{ color: c }}>
        <div className="font-bold tracking-widest">{statusText}</div>
      </div>
      <div className="absolute bottom-3 right-3 text-[10px] font-mono text-right flex items-center gap-1" style={{ color: c }}>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: c }} /> REC
      </div>
    </div>
  );
}