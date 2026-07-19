import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  Settings, Shield, Loader2, Save, Monitor, Key, AlertTriangle,
  CheckCircle2, XCircle, Lock, Bell, Eye, FileText, RefreshCw, History,
  ShieldAlert, ShieldCheck, Clock, Trash2
} from 'lucide-react';

export default function FacialRecognitionSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState('thresholds');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [threshold, setThreshold] = useState({ thresholdName: 'Global Default', confidenceThreshold: 80, livenessThreshold: 70, qualityThreshold: 60, description: 'Global recognition thresholds', lastUpdated: new Date().toLocaleDateString('en-CA'), updatedBy: user?.full_name || 'Admin' });
  const [config, setConfig] = useState({ duplicateScanMinutes: 5, retentionDays: 365 });
  const [alerts, setAlerts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [devices, setDevices] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [thresh, al, logs, revs, devs] = await Promise.all([
        base44.entities.RecognitionThreshold.list().catch(() => []),
        base44.entities.SecurityAlert.list('-created_date', 50).catch(() => []),
        base44.entities.BiometricAuditLog.list('-created_date', 50).catch(() => []),
        base44.entities.ManualReview.filter({ reviewDecision: 'Pending' }).catch(() => []),
        base44.entities.ScannerDevice.list().catch(() => []),
      ]);
      if (thresh.length) setThreshold(t => ({ ...t, ...thresh[0] }));
      setAlerts(al);
      setAuditLogs(logs);
      setReviews(revs);
      setDevices(devs);
    } catch (e) { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveThreshold = async () => {
    setSaving(true);
    try {
      const existing = await base44.entities.RecognitionThreshold.list();
      const data = { ...threshold, lastUpdated: new Date().toLocaleDateString('en-CA'), updatedBy: user?.full_name || 'Admin', isGlobal: true };
      if (existing.length) {
        await base44.entities.RecognitionThreshold.update(existing[0].id, data);
      } else {
        await base44.entities.RecognitionThreshold.create(data);
      }
      alert('Threshold settings saved.');
    } catch (e) { alert('Save failed: ' + e.message); }
    setSaving(false);
  };

  const resolveAlert = async (alert) => {
    try {
      await base44.entities.SecurityAlert.update(alert.id, { status: 'Resolved', resolvedBy: user?.full_name || 'Admin', resolvedDate: new Date().toLocaleDateString('en-CA'), resolutionNotes: 'Resolved from settings page' });
      await load();
    } catch (e) { alert('Failed to resolve alert.'); }
  };

  const reviewAction = async (review, decision) => {
    try {
      await base44.entities.ManualReview.update(review.id, { reviewDecision: decision, reviewedBy: user?.full_name || 'Admin', reviewDate: new Date().toLocaleDateString('en-CA') });
      await load();
    } catch (e) { alert('Review action failed.'); }
  };

  const tabs = [
    { key: 'thresholds', label: 'Thresholds', icon: Shield },
    { key: 'config', label: 'System Config', icon: Settings },
    { key: 'scanners', label: 'Scanner Devices', icon: Monitor },
    { key: 'api', label: 'API Credentials', icon: Key },
    { key: 'alerts', label: 'Security Alerts', icon: Bell },
    { key: 'audit', label: 'Audit Log', icon: History },
    { key: 'reviews', label: 'Manual Reviews', icon: Eye },
  ];

  return (
    <div className="kp-dash-bg min-h-screen pb-10">
      {/* Header */}
      <div className="bg-[hsl(var(--kp-teal))] px-4 sm:px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/facial-recognition')} className="text-white/80 hover:text-white text-sm font-medium">← Dashboard</button>
          <div className="flex-1" />
          <div className="text-white font-bold text-lg flex items-center gap-2"><Settings className="w-5 h-5" /> Facial Recognition Settings</div>
        </div>
      </div>

      {/* Access notice */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
        <div className="kp-glass-card rounded-xl p-3 flex items-center gap-2 border-l-4 border-blue-400">
          <Lock className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-xs text-gray-600">Access restricted to <strong>Super Admin</strong> and <strong>Data Privacy Officer</strong> roles.</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Tabs */}
        <div className="kp-glass-card rounded-2xl p-2 mb-4 overflow-x-auto kp-scroll-thin">
          <div className="flex gap-1 min-w-max">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 whitespace-nowrap transition-all ${tab === t.key ? 'bg-[hsl(var(--kp-teal))] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-[hsl(var(--kp-teal))] animate-spin" /></div>
        ) : (
          <>
            {/* Thresholds */}
            {tab === 'thresholds' && (
              <div className="kp-glass-card rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-[hsl(var(--kp-teal))]">Recognition Threshold Settings</h3>
                <p className="text-xs text-gray-500">Configure minimum scores for face recognition, liveness, and quality checks.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <ThresholdSlider label="Confidence Threshold" value={threshold.confidenceThreshold} onChange={v => setThreshold({ ...threshold, confidenceThreshold: v })} min={50} max={100} color="bg-blue-500" />
                  <ThresholdSlider label="Liveness Threshold" value={threshold.livenessThreshold} onChange={v => setThreshold({ ...threshold, livenessThreshold: v })} min={50} max={100} color="bg-yellow-500" />
                  <ThresholdSlider label="Quality Threshold" value={threshold.qualityThreshold} onChange={v => setThreshold({ ...threshold, qualityThreshold: v })} min={40} max={100} color="bg-green-500" />
                </div>
                <button onClick={saveThreshold} disabled={saving} className="px-5 py-2.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50 flex items-center gap-1.5">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Thresholds
                </button>
              </div>
            )}

            {/* System Config */}
            {tab === 'config' && (
              <div className="kp-glass-card rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-[hsl(var(--kp-teal))]">System Configuration</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Duplicate Scan Prevention (minutes)</label>
                    <input type="number" value={config.duplicateScanMinutes} onChange={e => setConfig({ ...config, duplicateScanMinutes: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Retention Period (days)</label>
                    <input type="number" value={config.retentionDays} onChange={e => setConfig({ ...config, retentionDays: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
                  </div>
                </div>
                <button className="px-5 py-2.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-semibold hover:brightness-105 flex items-center gap-1.5">
                  <Save className="w-4 h-4" /> Save Configuration
                </button>
              </div>
            )}

            {/* Scanner Devices */}
            {tab === 'scanners' && (
              <div className="kp-glass-card rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-[hsl(var(--kp-teal))]">Scanner Devices</h3>
                  <button className="px-3 py-1.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-xs font-semibold hover:brightness-105">Register Scanner</button>
                </div>
                {devices.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No scanners registered. Devices will appear here once connected.</p>
                ) : (
                  <div className="space-y-2">
                    {devices.map(d => (
                      <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                        <Monitor className="w-5 h-5 text-gray-400" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[hsl(var(--kp-teal))]">{d.deviceName}</div>
                          <div className="text-xs text-gray-500">{d.deviceId} • {d.location}</div>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${d.status === 'Online' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{d.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* API Credentials */}
            {tab === 'api' && (
              <div className="kp-glass-card rounded-2xl p-5 space-y-4">
                <h3 className="font-bold text-[hsl(var(--kp-teal))]">API Credential Management</h3>
                <p className="text-xs text-gray-500">No actual API keys are displayed here for security. This section references external facial recognition API connections.</p>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2"><Key className="w-4 h-4 text-gray-400" /><span className="text-sm font-medium text-gray-600">Facial Recognition API</span></div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Status:</span>
                    <span className="text-xs font-semibold text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">Not Connected</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">API Key Reference:</span>
                    <span className="text-xs text-gray-400 font-mono">••••••••••••••••</span>
                  </div>
                  <button className="mt-3 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50">Connect API (Reference Only)</button>
                </div>
              </div>
            )}

            {/* Security Alerts */}
            {tab === 'alerts' && (
              <div className="kp-glass-card rounded-2xl p-5">
                <h3 className="font-bold text-[hsl(var(--kp-teal))] mb-4">Security Alerts</h3>
                {alerts.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No security alerts.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto kp-scroll-thin">
                    {alerts.map(a => (
                      <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100">
                        <AlertTriangle className={`w-5 h-5 shrink-0 ${a.severity === 'Critical' ? 'text-red-600' : a.severity === 'High' ? 'text-orange-500' : 'text-yellow-500'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[hsl(var(--kp-teal))]">{a.alertType}</div>
                          <div className="text-xs text-gray-500">{a.description}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{a.timestamp} • {a.status}</div>
                        </div>
                        {a.status === 'Open' && (
                          <button onClick={() => resolveAlert(a)} className="px-2 py-1 rounded text-[10px] font-semibold bg-green-500 text-white hover:brightness-105 shrink-0">Resolve</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Audit Log */}
            {tab === 'audit' && (
              <div className="kp-glass-card rounded-2xl p-5">
                <h3 className="font-bold text-[hsl(var(--kp-teal))] mb-4">Biometric Audit Log</h3>
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No audit records.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto kp-scroll-thin">
                    {auditLogs.map(log => (
                      <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100">
                        <FileText className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[hsl(var(--kp-teal))]">{log.action}</div>
                          <div className="text-xs text-gray-500">{log.details}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{log.timestamp} • by {log.performedBy}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Manual Reviews */}
            {tab === 'reviews' && (
              <div className="kp-glass-card rounded-2xl p-5">
                <h3 className="font-bold text-[hsl(var(--kp-teal))] mb-4">Manual Review Queue</h3>
                {reviews.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No pending reviews.</p>
                ) : (
                  <div className="space-y-2">
                    {reviews.map(r => (
                      <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100">
                        <Eye className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[hsl(var(--kp-teal))]">{r.reviewType}</div>
                          <div className="text-xs text-gray-500">{r.reason}</div>
                          {r.fullName && <div className="text-xs text-gray-600 mt-0.5">{r.fullName}</div>}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => reviewAction(r, 'Approved')} className="px-2 py-1 rounded text-[10px] font-semibold bg-green-500 text-white hover:brightness-105">Approve</button>
                          <button onClick={() => reviewAction(r, 'Rejected')} className="px-2 py-1 rounded text-[10px] font-semibold bg-red-500 text-white hover:brightness-105">Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ThresholdSlider({ label, value, onChange, min, max, color }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="text-lg font-bold text-[hsl(var(--kp-teal))]">{value}%</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} className={`w-full ${color}`} />
      <div className="flex justify-between text-[10px] text-gray-400 mt-1"><span>{min}%</span><span>{max}%</span></div>
    </div>
  );
}