import React from 'react';
import { Avatar } from '@/components/kp/ui';
import { LogIn, LogOut, ShieldAlert, ScanFace } from 'lucide-react';

/** Compact scrollable overlay of recent scanned faces, one after another. Sits inside a camera tile. */
export default function ScanTicker({ scans = [], max = 6 }) {
  const items = scans.slice(0, max);
  return (
    <div className="absolute left-2 right-2 bottom-2 z-10 rounded-xl bg-black/45 backdrop-blur-md border border-white/10 p-1.5 max-h-32 overflow-y-auto kp-scroll-thin">
      {items.length === 0 ? (
        <div className="flex items-center gap-1.5 text-[11px] text-white/60 px-1.5 py-1">
          <ScanFace className="w-3 h-3" /> Waiting for scans…
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((s, i) => (
            <div key={i} className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-white/10">
              {s.unknown ? (
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
              ) : (
                <Avatar name={s.name || '?'} src={s.photo} size="w-5 h-5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-white truncate">
                  {s.unknown ? 'Unknown face' : s.name}
                </div>
                <div className="text-[9px] text-white/60">
                  {s.time}{s.unknown ? ' • flagged' : <> • <span className="capitalize">{s.status || 'present'}</span></>}
                </div>
              </div>
              {!s.unknown && (
                <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${s.scan_type === 'time_in' ? 'bg-green-500/30' : 'bg-blue-500/30'}`}>
                  {s.scan_type === 'time_in' ? <LogIn className="w-3 h-3 text-green-300" /> : <LogOut className="w-3 h-3 text-blue-300" />}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}