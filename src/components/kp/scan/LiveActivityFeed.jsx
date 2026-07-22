import React from 'react';
import { Avatar } from '@/components/kp/ui';
import { LogIn, LogOut, ShieldAlert, Activity } from 'lucide-react';

/** Right column: scrollable live activity feed of recent scans. */
export default function LiveActivityFeed({ scanFeed = [], onViewAll, className }) {
  return (
    <div className={`kp-panel rounded-2xl p-3 flex flex-col ${className || ''}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] flex items-center gap-1.5">
          <Activity className="w-4 h-4" /> Live Activity
        </h3>
        <button onClick={onViewAll} className="text-[11px] text-[hsl(var(--kp-teal-light))] font-semibold hover:underline">
          View All Logs
        </button>
      </div>
      <div className="flex-1 overflow-y-auto kp-scroll-thin space-y-2 pr-0.5" style={{ maxHeight: '30rem' }}>
        {scanFeed.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">No scans yet.</p>
        )}
        {scanFeed.map((s, i) => (
          <div key={i} className="rounded-xl border border-gray-200 p-2 flex items-center gap-2">
            {s.unknown ? (
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-4 h-4 text-red-500" />
              </div>
            ) : (
              <Avatar name={s.name || '?'} src={s.photo} size="w-8 h-8" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-700 truncate">
                {s.unknown ? 'Unknown Face' : s.name}
              </div>
              <div className="text-[10px] text-gray-400 truncate">
                {s.unknown
                  ? 'Intruder flagged'
                  : `${(s.person_type || '').charAt(0).toUpperCase() + (s.person_type || '').slice(1)} · ${s.location || '—'}`}
              </div>
            </div>
            <div className="text-right shrink-0">
              <span
                className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  s.unknown
                    ? 'bg-red-100 text-red-600'
                    : s.scan_type === 'time_in'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {s.unknown ? (
                  <ShieldAlert className="w-2.5 h-2.5" />
                ) : s.scan_type === 'time_in' ? (
                  <LogIn className="w-2.5 h-2.5" />
                ) : (
                  <LogOut className="w-2.5 h-2.5" />
                )}
                {s.unknown ? 'FLAG' : s.scan_type === 'time_in' ? 'IN' : 'OUT'}
              </span>
              <div className="text-[9px] text-gray-400 mt-0.5">
                {s.time}
                {!s.unknown && s.confidence ? ` · ${s.confidence}%` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}