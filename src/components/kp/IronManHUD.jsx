import React from 'react';

/**
 * IronManHUD — cinematic face-tracking overlay for the attendance scanner.
 * When `faces` (normalized 0–1 boxes) are provided, renders a targeting reticle
 * around each detected face (up to 5). Otherwise shows a centered tracking reticle.
 * Color shifts with the scan phase (idle / scanning / success / fail).
 */
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
        faces.slice(0, 5).map((f, i) => (
          <div key={i} className="absolute transition-all duration-200 ease-out" style={{ left: `${f.left * 100}%`, top: `${f.top * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` }}>
            <div className="absolute inset-0 rounded-full border-2" style={{ borderColor: c, boxShadow: `0 0 12px ${c}aa` }} />
            <div className="absolute inset-1 rounded-full border-2 border-dashed animate-spin" style={{ borderColor: `${c}cc`, animationDuration: '4s' }} />
            <div className="absolute -inset-1 rounded-full border border-dashed animate-spin" style={{ borderColor: `${c}55`, animationDuration: '7s', animationDirection: 'reverse' }} />
            <div className="absolute -top-1 -left-1 w-3 h-3 border-l-2 border-t-2" style={{ borderColor: c }} />
            <div className="absolute -top-1 -right-1 w-3 h-3 border-r-2 border-t-2" style={{ borderColor: c }} />
            <div className="absolute -bottom-1 -left-1 w-3 h-3 border-l-2 border-b-2" style={{ borderColor: c }} />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 border-r-2 border-b-2" style={{ borderColor: c }} />
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-mono whitespace-nowrap px-1 rounded-full" style={{ color: c, background: 'rgba(0,0,0,0.45)' }}>
              FACE {i + 1}
            </div>
          </div>
        ))
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