import React, { useState, useMemo } from 'react';
import { Search, Plus, Camera, VideoOff, MapPin, SlidersHorizontal } from 'lucide-react';

/**
 * Left column: scrollable list of camera locations with live/offline badges,
 * scan counts, last-scan timestamps, and a thumbnail for HTTP-stream cameras.
 */
export default function CameraLocationsList({
  savedCameras = [],
  deviceLocation,
  onDeviceLocationChange,
  scanFeed = [],
  onAddCamera,
  streaming,
  className,
}) {
  const [q, setQ] = useState('');

  const filtered = useMemo(
    () => savedCameras.filter((c) => {
      const s = `${c.deviceName} ${c.location || ''} ${c.deviceType}`.toLowerCase();
      return s.includes(q.toLowerCase());
    }),
    [savedCameras, q]
  );

  const scansAt = (loc) => scanFeed.filter((s) => s.location === loc).length;
  const lastScanAt = (loc) => scanFeed.find((x) => x.location === loc)?.time || null;

  return (
    <div className={`kp-panel rounded-2xl p-3 flex flex-col ${className || ''}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] flex items-center gap-1.5">
          <MapPin className="w-4 h-4" /> Camera Locations
        </h3>
        <button
          onClick={onAddCamera}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[hsl(var(--kp-teal-light))] text-white text-xs font-semibold hover:brightness-105"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      <div className="flex items-center gap-1.5 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search cameras…"
            className="w-full pl-8 pr-2 py-1.5 rounded-lg border border-gray-200 bg-white/70 text-xs focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15"
          />
        </div>
        <button className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto kp-scroll-thin space-y-2 pr-0.5" style={{ maxHeight: '30rem' }}>
        <CameraCard
          active={!deviceLocation || deviceLocation === 'Main Entrance'}
          title="This Device"
          subtitle="Local Scanner"
          typeLabel="Entrance"
          live={streaming}
          count={scansAt(deviceLocation)}
          lastTime={lastScanAt(deviceLocation)}
          onClick={() => onDeviceLocationChange(deviceLocation || 'Main Entrance')}
        />
        {filtered.length === 0 && !q && (
          <p className="text-xs text-gray-400 text-center py-4">No saved cameras yet.</p>
        )}
        {filtered.map((c) => {
          const loc = c.location || c.deviceName || 'Unassigned';
          const isRtsp = /^rtsp:/i.test(c.streamUrl || '');
          return (
            <CameraCard
              key={c.id}
              active={deviceLocation === loc}
              title={c.deviceName}
              subtitle={loc}
              typeLabel={c.deviceType}
              live={c.status === 'Online'}
              count={scansAt(loc)}
              lastTime={lastScanAt(loc)}
              thumb={c.streamUrl && /^https?:/i.test(c.streamUrl) ? c.streamUrl : null}
              rtsp={isRtsp}
              onClick={() => onDeviceLocationChange(loc)}
            />
          );
        })}
      </div>
    </div>
  );
}

function CameraCard({ active, title, subtitle, typeLabel, live, count, lastTime, thumb, rtsp, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-2 flex gap-2 transition-all ${
        active
          ? 'border-[hsl(var(--kp-teal))] bg-[hsl(var(--kp-teal))]/10 ring-1 ring-[hsl(var(--kp-teal))]/30'
          : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      <div className="w-14 h-10 rounded-lg overflow-hidden bg-gray-900 shrink-0 relative">
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/40">
            {rtsp ? <VideoOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-gray-700 truncate">{title}</span>
          {live ? (
            <span className="ml-auto inline-flex items-center gap-0.5 text-[9px] font-bold text-green-600">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> LIVE
            </span>
          ) : (
            <span className="ml-auto text-[9px] font-bold text-gray-400">OFFLINE</span>
          )}
        </div>
        <div className="text-[10px] text-gray-400 truncate">{subtitle}</div>
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{typeLabel}</span>
          {count > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(var(--kp-teal))]/10 text-[hsl(var(--kp-teal))] font-semibold">
              {count} scans
            </span>
          )}
          {lastTime && <span className="text-[9px] text-gray-400">{lastTime}</span>}
        </div>
      </div>
    </button>
  );
}