import React, { useState } from 'react';
import ScanTicker from '@/components/kp/ScanTicker';
import { Camera, MapPin, Wifi, VideoOff } from 'lucide-react';

function CameraFeed({ camera }) {
  const [err, setErr] = useState(false);
  const url = camera.streamUrl || '';
  const isRtsp = /^rtsp:/i.test(url);
  const isHttp = /^https?:/i.test(url);
  if (isHttp && !err) {
    return (
      <img src={url} alt={camera.deviceName} className="w-full h-full object-cover" onError={() => setErr(true)} />
    );
  }
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-white/40 bg-gray-900 gap-1">
      {isRtsp ? <VideoOff className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
      <span className="text-[10px]">{isRtsp ? 'RTSP · snapshot needed' : 'Feed unavailable'}</span>
    </div>
  );
}

/**
 * Multi-camera monitoring grid: the active device scanner tile (passed as children)
 * plus saved IP/RTSP cameras placed around the school, each labeled with its location
 * and showing a live scan ticker of faces captured there.
 */
export default function MultiCameraGrid({ savedCameras = [], scanFeed = [], deviceLocation, onDeviceLocationChange, locationOptions = [], children }) {
  const deviceScans = scanFeed.filter((s) => s.location === deviceLocation);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {/* Active device scanner tile */}
      <div className="relative md:col-span-2 xl:col-span-2 rounded-xl overflow-hidden bg-gray-900 border border-white/10">
        <div className="absolute top-2 left-2 right-2 z-20 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 bg-black/55 text-white text-[10px] px-2 py-1 rounded-full font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE SCANNER
          </span>
          <div className="ml-auto flex items-center gap-1 bg-black/55 rounded-full px-2 py-1">
            <MapPin className="w-3 h-3 text-white/70" />
            <select
              value={deviceLocation}
              onChange={(e) => onDeviceLocationChange(e.target.value)}
              className="bg-transparent text-white text-[11px] font-medium focus:outline-none max-w-[10rem]">
              <option value="" className="text-black">Set location…</option>
              {locationOptions.map((l) => <option key={l} value={l} className="text-black">{l}</option>)}
            </select>
          </div>
        </div>
        {children}
        <ScanTicker scans={deviceScans} />
      </div>

      {/* Saved camera tiles placed around the school */}
      {savedCameras.map((cam) => {
        const loc = cam.location || cam.deviceName || 'Unassigned';
        const camScans = scanFeed.filter((s) => s.location === loc);
        return (
          <div key={cam.id} className="relative rounded-xl overflow-hidden bg-gray-900 border border-white/10 aspect-video">
            <CameraFeed camera={cam} />
            <div className="absolute top-2 left-2 z-20 inline-flex items-center gap-1 bg-black/55 text-white text-[10px] px-2 py-0.5 rounded-full">
              {/^rtsp:/i.test(cam.streamUrl || '') ? <Wifi className="w-2.5 h-2.5" /> : <Camera className="w-2.5 h-2.5" />} {cam.deviceName}
            </div>
            <div className="absolute top-2 right-2 z-20 inline-flex items-center gap-1 bg-[hsl(var(--kp-teal))] text-white text-[10px] px-2 py-0.5 rounded-full font-semibold max-w-[55%]">
              <MapPin className="w-2.5 h-2.5 shrink-0" /> <span className="truncate">{loc}</span>
            </div>
            <ScanTicker scans={camScans} max={5} />
          </div>
        );
      })}
    </div>
  );
}