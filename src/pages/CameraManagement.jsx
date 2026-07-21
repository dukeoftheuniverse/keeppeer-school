import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { PagePanel, PageTitle, KpButton, KpInput, KpSelect, StatusBadge, EmptyState } from '@/components/kp/ui';
import CameraTestModal from '@/components/kp/CameraTestModal';
import { logAudit } from '@/lib/audit';
import { Video, Plus, Trash2, Pencil, TestTube, MapPin, Sliders, X, Camera } from 'lucide-react';

const DEVICE_TYPES = ['Desktop Camera', 'Tablet Camera', 'Mobile Camera', 'Dedicated Scanner', 'Webcam', 'IP Camera'];
const STATUS_OPTS = ['Online', 'Offline', 'Maintenance', 'Disabled'];

const statusColor = { Online: 'present', Offline: 'absent', Maintenance: 'late', Disabled: 'inactive' };

export default function CameraManagement() {
  const [devices, setDevices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [threshold, setThreshold] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deviceForm, setDeviceForm] = useState(null); // {mode:'add'|'edit', data}
  const [locForm, setLocForm] = useState(null);
  const [testDevice, setTestDevice] = useState(null);

  const load = () => {
    Promise.all([
      base44.entities.ScannerDevice.list().catch(() => []),
      base44.entities.ScannerLocation.list().catch(() => []),
      base44.entities.RecognitionThreshold.list().catch(() => []),
    ]).then(([dev, loc, th]) => {
      setDevices(dev); setLocations(loc);
      setThreshold(th && th[0] ? th[0] : { thresholdName: 'Default', confidenceThreshold: 80, qualityThreshold: 60, livenessThreshold: 70 });
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const saveDevice = async () => {
    const d = deviceForm.data;
    if (!d.deviceName || !d.deviceId) return;
    if (deviceForm.mode === 'add') {
      const created = await base44.entities.ScannerDevice.create({ ...d, registeredDate: new Date().toLocaleDateString('en-CA'), status: d.status || 'Online' });
      await logAudit('Camera Configuration', 'ScannerDevice', created.id, `Registered camera ${d.deviceName}.`);
    } else {
      await base44.entities.ScannerDevice.update(d.id, d);
      await logAudit('Camera Configuration', 'ScannerDevice', d.id, `Updated camera ${d.deviceName}.`);
    }
    setDeviceForm(null); load();
  };

  const removeDevice = async (d) => {
    if (!window.confirm(`Delete camera "${d.deviceName}"?`)) return;
    await base44.entities.ScannerDevice.delete(d.id);
    await logAudit('Camera Configuration', 'ScannerDevice', d.id, `Deleted camera ${d.deviceName}.`);
    load();
  };

  const saveLocation = async () => {
    const l = locForm.data;
    if (!l.locationName) return;
    if (locForm.mode === 'add') await base44.entities.ScannerLocation.create(l);
    else await base44.entities.ScannerLocation.update(l.id, l);
    setLocForm(null); load();
  };

  const saveThreshold = async () => {
    if (threshold.id) await base44.entities.RecognitionThreshold.update(threshold.id, { ...threshold, lastUpdated: new Date().toLocaleDateString('en-CA') });
    else { const c = await base44.entities.RecognitionThreshold.create({ ...threshold, isGlobal: true, lastUpdated: new Date().toLocaleDateString('en-CA') }); setThreshold({ ...threshold, id: c.id }); }
    await logAudit('Threshold Changed', 'RecognitionThreshold', threshold.id || '', `Confidence ${threshold.confidenceThreshold} / Quality ${threshold.qualityThreshold} / Liveness ${threshold.livenessThreshold}.`);
  };

  return (
    <div className="space-y-4">
      <PageTitle subtitle="Register, test, and configure cameras per location; set recognition thresholds.">Camera & Device Management</PageTitle>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <PagePanel>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><Video className="w-4 h-4 text-[hsl(var(--kp-teal))]" /><h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">Cameras ({devices.length})</h3></div>
              <KpButton variant="green" onClick={() => setDeviceForm({ mode: 'add', data: { deviceName: '', deviceId: 'CAM-' + Date.now().toString().slice(-5), deviceType: 'Webcam', status: 'Online', location: '', campus: '', assignedBuilding: '', assignedRoom: '', ipAddress: '', notes: '' } })}>
                <Plus className="w-4 h-4" /> Add Camera
              </KpButton>
            </div>
            {devices.length === 0 ? <EmptyState message="No cameras registered yet." /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {devices.map((d) => (
                  <div key={d.id} className="rounded-xl border border-gray-100 p-3 bg-gray-50/50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-[hsl(var(--kp-teal))]/10 flex items-center justify-center"><Camera className="w-4 h-4 text-[hsl(var(--kp-teal))]" /></div>
                        <div>
                          <div className="text-sm font-semibold text-[hsl(var(--kp-teal))]">{d.deviceName}</div>
                          <div className="text-[11px] text-gray-400 font-mono">{d.deviceId}</div>
                        </div>
                      </div>
                      <StatusBadge status={statusColor[d.status] || d.status} />
                    </div>
                    <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                      <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {d.location || '—'} {d.assignedRoom ? `· ${d.assignedRoom}` : ''}</div>
                      <div>{d.deviceType}{d.ipAddress ? ` · ${d.ipAddress}` : ''}</div>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <button onClick={() => setTestDevice(d)} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-xs font-medium"><TestTube className="w-3 h-3" /> Test</button>
                      <button onClick={() => setDeviceForm({ mode: 'edit', data: d })} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 text-gray-600 text-xs"><Pencil className="w-3 h-3" /> Edit</button>
                      <button onClick={() => removeDevice(d)} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-red-200 text-red-600 text-xs"><Trash2 className="w-3 h-3" /> Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PagePanel>

          <PagePanel>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[hsl(var(--kp-teal))]" /><h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">Locations ({locations.length})</h3></div>
              <KpButton variant="outline" onClick={() => setLocForm({ mode: 'add', data: { locationName: '', campus: '', building: '', room: '', locationType: 'Main Entrance', operationalHours: '', accessLevelRequired: 'Standard' } })}>
                <Plus className="w-4 h-4" /> Add Location
              </KpButton>
            </div>
            {locations.length === 0 ? <EmptyState message="No locations defined." /> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {locations.map((l) => (
                  <div key={l.id} className="rounded-xl border border-gray-100 p-2.5 bg-gray-50/50">
                    <div className="text-sm font-semibold text-[hsl(var(--kp-teal))] truncate">{l.locationName}</div>
                    <div className="text-[11px] text-gray-400">{l.locationType}</div>
                    <div className="text-[11px] text-gray-400 truncate">{[l.building, l.room].filter(Boolean).join(' · ') || '—'}</div>
                    <div className="mt-1.5 flex gap-1">
                      <button onClick={() => setLocForm({ mode: 'edit', data: l })} className="text-[11px] text-gray-600 hover:underline">Edit</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PagePanel>
        </div>

        <PagePanel>
          <div className="flex items-center gap-2 mb-4"><Sliders className="w-4 h-4 text-[hsl(var(--kp-teal))]" /><h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">Recognition Thresholds</h3></div>
          <p className="text-xs text-gray-500 mb-3">High confidence auto-confirms. Medium requests a second scan. Low marks unknown for manual review.</p>
          <div className="space-y-3">
            <KpInput label="Confidence Threshold" type="number" value={threshold?.confidenceThreshold ?? 80} onChange={(e) => setThreshold({ ...threshold, confidenceThreshold: Number(e.target.value) })} />
            <KpInput label="Quality Threshold" type="number" value={threshold?.qualityThreshold ?? 60} onChange={(e) => setThreshold({ ...threshold, qualityThreshold: Number(e.target.value) })} />
            <KpInput label="Liveness Threshold" type="number" value={threshold?.livenessThreshold ?? 70} onChange={(e) => setThreshold({ ...threshold, livenessThreshold: Number(e.target.value) })} />
            <KpButton variant="green" onClick={saveThreshold} className="w-full"><Sliders className="w-4 h-4" /> Save Thresholds</KpButton>
          </div>
          <div className="mt-4 text-xs bg-blue-50 border border-blue-200 rounded-lg p-2 text-gray-600">
            <strong>Confidence %</strong> is shown only to authorized personnel on the scanner and dashboard.
          </div>
        </PagePanel>
      </div>

      {/* Device form modal */}
      {deviceForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDeviceForm(null)}>
          <div className="kp-panel rounded-2xl shadow-2xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-base font-bold text-[hsl(var(--kp-teal))]">{deviceForm.mode === 'add' ? 'Add Camera' : 'Edit Camera'}</h3>
              <button onClick={() => setDeviceForm(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <KpInput label="Device Name" value={deviceForm.data.deviceName} onChange={(e) => setDeviceForm({ ...deviceForm, data: { ...deviceForm.data, deviceName: e.target.value } })} />
              <KpInput label="Device ID" value={deviceForm.data.deviceId} onChange={(e) => setDeviceForm({ ...deviceForm, data: { ...deviceForm.data, deviceId: e.target.value } })} />
              <KpSelect label="Device Type" value={deviceForm.data.deviceType} onChange={(e) => setDeviceForm({ ...deviceForm, data: { ...deviceForm.data, deviceType: e.target.value } })}>
                {DEVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </KpSelect>
              <KpSelect label="Location" value={deviceForm.data.location} onChange={(e) => setDeviceForm({ ...deviceForm, data: { ...deviceForm.data, location: e.target.value } })}>
                <option value="">—</option>
                {locations.map((l) => <option key={l.id} value={l.locationName}>{l.locationName}</option>)}
              </KpSelect>
              <KpInput label="Campus" value={deviceForm.data.campus} onChange={(e) => setDeviceForm({ ...deviceForm, data: { ...deviceForm.data, campus: e.target.value } })} />
              <KpInput label="Building" value={deviceForm.data.assignedBuilding} onChange={(e) => setDeviceForm({ ...deviceForm, data: { ...deviceForm.data, assignedBuilding: e.target.value } })} />
              <KpInput label="Room" value={deviceForm.data.assignedRoom} onChange={(e) => setDeviceForm({ ...deviceForm, data: { ...deviceForm.data, assignedRoom: e.target.value } })} />
              <KpInput label="IP Address" value={deviceForm.data.ipAddress} onChange={(e) => setDeviceForm({ ...deviceForm, data: { ...deviceForm.data, ipAddress: e.target.value } })} />
              <KpSelect label="Status" value={deviceForm.data.status} onChange={(e) => setDeviceForm({ ...deviceForm, data: { ...deviceForm.data, status: e.target.value } })}>
                {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </KpSelect>
              <KpInput label="Notes" value={deviceForm.data.notes} onChange={(e) => setDeviceForm({ ...deviceForm, data: { ...deviceForm.data, notes: e.target.value } })} className="sm:col-span-2" />
            </div>
            <div className="flex gap-2 mt-4">
              <KpButton variant="teal" onClick={saveDevice} className="flex-1">{deviceForm.mode === 'add' ? 'Register Camera' : 'Save Changes'}</KpButton>
              <KpButton variant="light" onClick={() => setTestDevice(deviceForm.data)}><TestTube className="w-4 h-4" /> Test</KpButton>
            </div>
          </div>
        </div>
      )}

      {/* Location form modal */}
      {locForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setLocForm(null)}>
          <div className="kp-panel rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-base font-bold text-[hsl(var(--kp-teal))]">{locForm.mode === 'add' ? 'Add Location' : 'Edit Location'}</h3>
              <button onClick={() => setLocForm(null)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <KpInput label="Location Name" value={locForm.data.locationName} onChange={(e) => setLocForm({ ...locForm, data: { ...locForm.data, locationName: e.target.value } })} className="sm:col-span-2" />
              <KpInput label="Campus" value={locForm.data.campus} onChange={(e) => setLocForm({ ...locForm, data: { ...locForm.data, campus: e.target.value } })} />
              <KpInput label="Building" value={locForm.data.building} onChange={(e) => setLocForm({ ...locForm, data: { ...locForm.data, building: e.target.value } })} />
              <KpInput label="Room" value={locForm.data.room} onChange={(e) => setLocForm({ ...locForm, data: { ...locForm.data, room: e.target.value } })} />
              <KpSelect label="Type" value={locForm.data.locationType} onChange={(e) => setLocForm({ ...locForm, data: { ...locForm.data, locationType: e.target.value } })}>
                {['Main Entrance', 'Classroom', 'Office', 'Restricted Area', 'Event Entrance', 'Visitor Desk'].map((t) => <option key={t} value={t}>{t}</option>)}
              </KpSelect>
              <KpInput label="Operational Hours" value={locForm.data.operationalHours} onChange={(e) => setLocForm({ ...locForm, data: { ...locForm.data, operationalHours: e.target.value } })} className="sm:col-span-2" />
              <KpButton variant="teal" onClick={saveLocation} className="sm:col-span-2">{locForm.mode === 'add' ? 'Add Location' : 'Save'}</KpButton>
            </div>
          </div>
        </div>
      )}

      <CameraTestModal open={!!testDevice} onClose={() => setTestDevice(null)} device={testDevice} />
    </div>
  );
}