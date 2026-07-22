import React from 'react';
import { ShieldAlert, WifiOff, AlertTriangle } from 'lucide-react';

const iconFor = (t) =>
  t === 'Scanner Offline' ? WifiOff : t.includes('Spoofing') ? AlertTriangle : ShieldAlert;

const colorFor = (sev) =>
  sev === 'Critical'
    ? 'text-red-600 bg-red-100'
    : sev === 'High'
    ? 'text-orange-600 bg-orange-100'
    : sev === 'Warning'
    ? 'text-yellow-600 bg-yellow-100'
    : 'text-blue-600 bg-blue-100';

/** Bottom-right top: the 3 most recent security alerts. */
export default function AlertsPanel({ alerts = [], className }) {
  const recent = alerts.slice(0, 3);
  return (
    <div className={`kp-panel rounded-2xl p-3 sm:p-4 ${className || ''}`}>
      <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-3 flex items-center gap-1.5">
        <ShieldAlert className="w-4 h-4" /> Alerts{' '}
        <span className="text-xs font-normal text-gray-400">(Last 3)</span>
      </h3>
      {recent.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No alerts.</p>
      ) : (
        <div className="space-y-2">
          {recent.map((a) => {
            const Icon = iconFor(a.alertType);
            const c = colorFor(a.severity);
            return (
              <div key={a.id} className="flex items-center gap-2 rounded-xl border border-gray-200 p-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-700 truncate">{a.alertType}</div>
                  <div className="text-[10px] text-gray-400 truncate">{a.description}</div>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${c}`}>{a.severity}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}