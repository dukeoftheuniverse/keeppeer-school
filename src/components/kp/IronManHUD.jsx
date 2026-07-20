import React from 'react';

/**
 * IronManHUD — cinematic face-tracking overlay for the attendance scanner.
 * Renders corner brackets, an animated scan line, a tracking reticle that
 * subtly moves to simulate face lock-on, and J.A.R.V.I.S.-style status text.
 * Color shifts with the scan phase (idle / scanning / success / fail).
 */
export default function IronManHUD({ phase, unknown, okCount }) {
  const c = phase === 'scanning' ? '#FACC15'
    : phase === 'success' ? '#22C55E'
    : phase === 'fail' ? '#EF4444'
    : '#2DD4BF';

  const statusText = phase === 'scanning' ? '◢ SCANNING · ANALYZING'
    : phase === 'success' ? `◉ TARGET LOCKED · ${okCount} LOGGED`
    : phase === 'fail' ? (unknown ? '⚠ INTRUDER DETECTED' : '✕ NO MATCH')
    : '◎ FACE TRACKING ACTIVE';

  const corners = [
    'top-2 left-2 border-l-2 border-t-2',
    'top-2 right-2 border-r-2 border-t-2',
    'bottom-2 left-2 border-l-2 border-b-2',
    'bottom-2 right-2 border-r-2 border-b-2',
  ];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
      {/* vignette */}
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, transparent 55%, ${c}1f 100%)` }} />

      {/* corner brackets */}
      {corners.map((cls, i) => (
        <div key={i} className={`absolute w-8 h-8 rounded-sm ${cls}`} style={{ borderColor: c, boxShadow: `0 0 8px ${c}66` }} />
      ))}

      {/* animated scan line */}
      <div className="absolute left-0 right-0 h-px kp-scanline" style={{ background: `linear-gradient(90deg, transparent, ${c}, transparent)`, boxShadow: `0 0 10px ${c}, 0 0 20px ${c}` }} />

      {/* tracking reticle */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative kp-track" style={{ width: '11rem', height: '11rem' }}>
          <div className="absolute inset-0 rounded-full border-2 border-dashed animate-spin" style={{ borderColor: c, animationDuration: '6s' }} />
          <div className="absolute inset-4 rounded-full border" style={{ borderColor: `${c}66` }} />
          <div className="absolute inset-8 rounded-full border border-dashed" style={{ borderColor: `${c}40`, animationDuration: '9s' }} />
          {/* crosshair */}
          <div className="absolute top-1/2 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${c}, transparent)` }} />
          <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: `linear-gradient(180deg, transparent, ${c}, transparent)` }} />
          {/* center dot */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full" style={{ background: c, boxShadow: `0 0 12px ${c}` }} />
          {/* tick marks */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
            <div key={deg} className="absolute left-1/2 top-1/2 origin-bottom" style={{ transform: `rotate(${deg}deg) translateY(-5.4rem)`, width: '2px', height: '8px', background: c, opacity: 0.6 }} />
          ))}
        </div>
      </div>

      {/* HUD labels */}
      <div className="absolute top-3 left-3 text-[10px] font-mono leading-tight" style={{ color: c }}>
        <div className="font-bold tracking-widest">◢ J.A.R.V.I.S</div>
        <div className="opacity-70">ATTENDANCE MODULE</div>
      </div>
      <div className="absolute top-3 right-3 text-[10px] font-mono text-right leading-tight" style={{ color: c }}>
        <div className="font-bold tracking-widest">SYS · ONLINE</div>
        <div className="opacity-70">TRACK: ACTIVE</div>
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