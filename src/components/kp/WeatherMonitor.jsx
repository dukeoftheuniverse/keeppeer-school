import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Cloud, CloudRain, CloudSun, Sun, CloudLightning, Snowflake as Snow, CloudFog, Wind, Droplets, Thermometer, Shield, ShieldAlert, ShieldCheck, AlertTriangle, RefreshCw, Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS = {
  sun: Sun, 'cloud-sun': CloudSun, cloud: Cloud, 'cloud-rain': CloudRain,
  'cloud-lightning': CloudLightning, snow: Snow, fog: CloudFog,
};

const SAFETY = {
  safe: { color: 'green', border: 'border-green-200', bg: 'bg-green-50', text: 'text-green-700', icon: ShieldCheck, label: 'Safe for School' },
  watch: { color: 'yellow', border: 'border-yellow-200', bg: 'bg-yellow-50', text: 'text-yellow-700', icon: Shield, label: 'Weather Watch' },
  warning: { color: 'orange', border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-700', icon: AlertTriangle, label: 'Caution' },
  unsafe: { color: 'red', border: 'border-red-300', bg: 'bg-red-50', text: 'text-red-700', icon: ShieldAlert, label: 'Class Suspension' },
};

export default function WeatherMonitor({ compact = false, onSafetyChange }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWeather = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await base44.functions.invoke('getWeather', {});
      setWeather(res.data);
      setError(null);
      if (onSafetyChange && res.data?.safety) onSafetyChange(res.data.safety);
    } catch (e) {
      setError('Unable to load weather data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onSafetyChange]);

  useEffect(() => {
    fetchWeather();
    const t = setInterval(fetchWeather, 10 * 60 * 1000); // refresh every 10 min
    return () => clearInterval(t);
  }, [fetchWeather]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading weather...
      </div>
    );
  }
  if (error || !weather) {
    return (
      <div className="text-center py-6 text-gray-400 text-sm">
        {error || 'No weather data'}
        <button onClick={fetchWeather} className="block mx-auto mt-2 text-[hsl(var(--kp-teal))] hover:underline text-xs">Retry</button>
      </div>
    );
  }

  const cur = weather.current;
  const Icon = ICONS[cur?.icon] || Cloud;
  const s = SAFETY[weather.safety] || SAFETY.safe;
  const SafetyIcon = s.icon;

  if (compact) {
    return (
      <div className={cn("rounded-xl border p-3 flex items-center gap-3", s.border, s.bg)}>
        <SafetyIcon className={cn("w-6 h-6 shrink-0", s.text)} />
        <div className="flex-1 min-w-0">
          <div className={cn("text-sm font-bold", s.text)}>{weather.alert || s.label}</div>
          <div className="text-xs text-gray-500 truncate">{cur?.description} • {cur?.temperature?.toFixed(0)}°C • {weather.location}</div>
        </div>
        <Icon className={cn("w-6 h-6", s.text)} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Current conditions */}
      <div className="flex items-center gap-3">
        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0", s.bg, s.border, "border")}>
          <Icon className={cn("w-7 h-7", s.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[hsl(var(--kp-teal))]">{cur?.temperature?.toFixed(0) ?? '—'}°C</span>
            <span className="text-sm text-gray-500">feels {cur?.apparent?.toFixed(0) ?? '—'}°</span>
          </div>
          <div className="text-sm text-gray-600 capitalize">{cur?.description}</div>
          <div className="text-[11px] text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> {weather.location}</div>
        </div>
        <button onClick={fetchWeather} disabled={refreshing} className="p-2 rounded-lg hover:bg-gray-50 text-gray-400" title="Refresh">
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric icon={Droplets} value={`${cur?.humidity?.toFixed(0) ?? '—'}%`} label="Humidity" />
        <Metric icon={Wind} value={`${cur?.wind_speed?.toFixed(0) ?? '—'}`} label="Wind km/h" />
        <Metric icon={CloudRain} value={`${weather.today?.rain_prob ?? 0}%`} label="Rain Chance" />
      </div>

      {/* Safety banner */}
      <div className={cn("rounded-xl border p-3", s.border, s.bg)}>
        <div className="flex items-center gap-2 mb-1">
          <SafetyIcon className={cn("w-5 h-5 shrink-0", s.text)} />
          <span className={cn("text-sm font-bold", s.text)}>{weather.alert || s.label}</span>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">{weather.advisory}</p>
      </div>

      {/* 3-day forecast */}
      <div className="grid grid-cols-3 gap-2">
        {weather.forecast?.map((f, i) => {
          const FIcon = ICONS[f.icon] || Cloud;
          return (
            <div key={f.date} className="rounded-lg bg-gray-50 border border-gray-100 p-2 text-center">
              <div className="text-[10px] text-gray-400 font-medium">
                {i === 0 ? 'Today' : new Date(f.date).toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <FIcon className="w-5 h-5 mx-auto my-1 text-[hsl(var(--kp-teal))]" />
              <div className="text-xs font-semibold text-gray-700">{f.temp_max?.toFixed(0)}°<span className="text-gray-400">/{f.temp_min?.toFixed(0)}°</span></div>
              <div className="text-[9px] text-blue-500">{f.rain_prob}%</div>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-gray-400 text-center flex items-center justify-center gap-1">
        <Cloud className="w-3 h-3" /> Live data from {weather.source} • Updates every 10 min
      </div>
    </div>
  );
}

function Metric({ icon: Icon, value, label }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-2">
      <Icon className="w-3.5 h-3.5 mx-auto text-gray-400 mb-1" />
      <div className="text-sm font-bold text-[hsl(var(--kp-teal))]">{value}</div>
      <div className="text-[9px] text-gray-400">{label}</div>
    </div>
  );
}