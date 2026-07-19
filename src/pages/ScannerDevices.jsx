import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  Monitor, Plus, Loader2, X, MapPin, Edit, Trash2, Wifi, WifiOff, Wrench,
  CircleDot, Building2
} from 'lucide-react';

const DEVICE_TYPES = ['Desktop Camera', 'Tablet Camera', 'Mobile Camera', 'Dedicated Scanner', 'Webcam'];
const STATUS_CONFIG = {
  'Online': { color: 'bg-green-100 text-green-700', icon: Wifi },
  'Offline': { color: 'bg-red-100 text-red-700', icon: WifiOff },
  'Maintenance': { color: 'bg-yellow-100 text-yellow-700', icon: Wrench },
  'Disabled': { color: 'bg-gray-100 text-gray-600', icon: CircleDot },
};

export default function ScannerDevices() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [filter, setFilter] = useState('');
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editDevice, setEditDevice] = useState(null);
  const [deviceForm, setDeviceForm] = useState({});
  const [locationForm, setLocationForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [devs, locs] = await Promise.all([
        base44.entities.ScannerDevice.list().catch(() => []),
        base44.entities.ScannerLocation.list().catch(() => []),
      ]);
      setDevices(devs);
      setLocations(locs);
    } catch (e) { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredDevices = filter ? devices.filter(d => d.status === filter) : devices;

  const saveDevice = async () => {
    if (!deviceForm.deviceName || !deviceForm.deviceId) { alert('Enter device name and ID.'); return; }
    setSaving(true);
    try {
      if (editDevice) {
        await base44.entities.ScannerDevice.update(editDevice.id, { ...deviceForm, lastHeartbeat: new Date().toISOString(), registeredDate: editDevice.registeredDate || new Date().toLocaleDateString('en-CA') });
      } else {
        await base44.entities.ScannerDevice.create({ ...deviceForm, status: 'Online', registeredDate: new Date().toLocaleDateString('en-CA'), lastHeartbeat: new Date().toISOString() });
      }
      setShowDeviceForm(false); setEditDevice(null); setDeviceForm({});
      await load();
    } catch (e) { alert('Save failed: ' + e.message); }
    setSaving(false);
  };

  const deleteDevice = async (d) => {
    if (!confirm(`Delete scanner "${d.deviceName}"?`)) return;
    try { await base44.entities.ScannerDevice.delete(d.id); await load(); } catch (e) { alert('Delete failed.'); }
  };

  const saveLocation = async () => {
    if (!locationForm.locationName) { alert('Enter location name.'); return; }
    setSaving(true);
    try {
      await base44.entities.ScannerLocation.create(locationForm);
      setShowLocationForm(false); setLocationForm({});
      await load();
    } catch (e) { alert('Save failed: ' + e.message); }
    setSaving(false);
  };

  return (
    <div className="kp-dash-bg min-h-screen pb-10">
      <div className="bg-[hsl(var(--kp-teal))] px-4 sm:px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/facial-recognition')} className="text-white/80 hover:text-white text-sm font-medium">← Dashboard</button>
          <div className="flex-1" />
          <div className="text-white font-bold text-lg flex items-center gap-2"><Monitor className="w-5 h-5" /> Scanner Device Management</div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Scanner Devices */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-bold text-base text-[hsl(var(--kp-teal))]">Scanner Devices ({filteredDevices.length})</h2>
          <div className="flex gap-2">
            <select value={filter} onChange={e => setFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
              <option value="">All Status</option>
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Disabled">Disabled</option>
            </select>
            <button onClick={() => { setEditDevice(null); setDeviceForm({}); setShowDeviceForm(true); }} className="px-4 py-2 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-semibold hover:brightness-105 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add Scanner
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-[hsl(var(--kp-teal))] animate-spin" /></div>
        ) : filteredDevices.length === 0 ? (
          <div className="kp-glass-card rounded-2xl p-10 text-center">
            <Monitor className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No scanner devices registered. Click "Add Scanner" to register one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredDevices.map(d => {
              const sc = STATUS_CONFIG[d.status] || STATUS_CONFIG.Online;
              return (
                <div key={d.id} className="kp-glass-card rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-[hsl(var(--kp-teal))]/10 flex items-center justify-center"><Monitor className="w-5 h-5 text-[hsl(var(--kp-teal))]" /></div>
                      <div>
                        <div className="font-bold text-sm text-[hsl(var(--kp-teal))]">{d.deviceName}</div>
                        <div className="text-xs text-gray-500">{d.deviceType}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${sc.color}`}><sc.icon className="w-3 h-3" /> {d.status}</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-gray-400">Device ID:</span><span className="text-gray-700 font-mono">{d.deviceId}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Location:</span><span className="text-gray-700">{d.location || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Campus:</span><span className="text-gray-700">{d.campus || '—'}</span></div>
                    {d.assignedBuilding && <div className="flex justify-between"><span className="text-gray-400">Building:</span><span className="text-gray-700">{d.assignedBuilding}</span></div>}
                    {d.assignedRoom && <div className="flex justify-between"><span className="text-gray-400">Room:</span><span className="text-gray-700">{d.assignedRoom}</span></div>}
                    <div className="flex justify-between"><span className="text-gray-400">Registered:</span><span className="text-gray-700">{d.registeredDate || '—'}</span></div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button onClick={() => { setEditDevice(d); setDeviceForm(d); setShowDeviceForm(true); }} className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 flex items-center justify-center gap-1"><Edit className="w-3 h-3" /> Edit</button>
                    <button onClick={() => deleteDevice(d)} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 flex items-center gap-1"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Scanner Locations */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-4">
          <h2 className="font-bold text-base text-[hsl(var(--kp-teal))]">Scanner Locations ({locations.length})</h2>
          <button onClick={() => { setLocationForm({}); setShowLocationForm(true); }} className="px-4 py-2 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-semibold hover:brightness-105 flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Location
          </button>
        </div>

        {locations.length === 0 ? (
          <div className="kp-glass-card rounded-2xl p-10 text-center">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No scanner locations defined.</p>
          </div>
        ) : (
          <div className="kp-glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto kp-scroll-thin">
              <table className="w-full text-sm">
                <thead className="bg-[hsl(var(--kp-teal))]/5 text-xs uppercase text-[hsl(var(--kp-teal))]">
                  <tr>
                    <th className="text-left p-3 font-semibold">Location</th>
                    <th className="text-left p-3 font-semibold hidden sm:table-cell">Campus</th>
                    <th className="text-left p-3 font-semibold hidden md:table-cell">Building/Room</th>
                    <th className="text-left p-3 font-semibold">Type</th>
                    <th className="text-left p-3 font-semibold hidden lg:table-cell">Hours</th>
                    <th className="text-left p-3 font-semibold">Access Level</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map(l => (
                    <tr key={l.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="p-3 font-medium text-[hsl(var(--kp-teal))]">{l.locationName}</td>
                      <td className="p-3 text-gray-600 hidden sm:table-cell text-xs">{l.campus || '—'}</td>
                      <td className="p-3 text-gray-600 hidden md:table-cell text-xs">{l.building || '—'} {l.room ? `/ ${l.room}` : ''}</td>
                      <td className="p-3 text-gray-600 text-xs">{l.locationType}</td>
                      <td className="p-3 text-gray-600 hidden lg:table-cell text-xs">{l.operationalHours || '—'}</td>
                      <td className="p-3"><span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">{l.accessLevelRequired || 'Standard'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Device Form Modal */}
      {showDeviceForm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeviceForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto kp-scroll-thin">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[hsl(var(--kp-teal))]">{editDevice ? 'Edit Scanner' : 'Add Scanner Device'}</h3>
              <button onClick={() => setShowDeviceForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <Input label="Device Name *" value={deviceForm.deviceName} onChange={v => setDeviceForm({ ...deviceForm, deviceName: v })} />
              <SelectInput label="Device Type" value={deviceForm.deviceType} onChange={v => setDeviceForm({ ...deviceForm, deviceType: v })} options={DEVICE_TYPES} />
              <Input label="Device ID *" value={deviceForm.deviceId} onChange={v => setDeviceForm({ ...deviceForm, deviceId: v })} />
              <Input label="Location" value={deviceForm.location} onChange={v => setDeviceForm({ ...deviceForm, location: v })} />
              <Input label="Campus" value={deviceForm.campus} onChange={v => setDeviceForm({ ...deviceForm, campus: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Building" value={deviceForm.assignedBuilding} onChange={v => setDeviceForm({ ...deviceForm, assignedBuilding: v })} />
                <Input label="Room" value={deviceForm.assignedRoom} onChange={v => setDeviceForm({ ...deviceForm, assignedRoom: v })} />
              </div>
              <Input label="IP Address" value={deviceForm.ipAddress} onChange={v => setDeviceForm({ ...deviceForm, ipAddress: v })} />
              <Input label="Notes" value={deviceForm.notes} onChange={v => setDeviceForm({ ...deviceForm, notes: v })} />
            </div>
            <button onClick={saveDevice} disabled={saving} className="mt-4 w-full py-2.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {editDevice ? 'Update Scanner' : 'Add Scanner'}
            </button>
          </div>
        </div>
      )}

      {/* Location Form Modal */}
      {showLocationForm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowLocationForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto kp-scroll-thin">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[hsl(var(--kp-teal))]">Add Scanner Location</h3>
              <button onClick={() => setShowLocationForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <Input label="Location Name *" value={locationForm.locationName} onChange={v => setLocationForm({ ...locationForm, locationName: v })} />
              <Input label="Campus" value={locationForm.campus} onChange={v => setLocationForm({ ...locationForm, campus: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Building" value={locationForm.building} onChange={v => setLocationForm({ ...locationForm, building: v })} />
                <Input label="Room" value={locationForm.room} onChange={v => setLocationForm({ ...locationForm, room: v })} />
              </div>
              <SelectInput label="Location Type" value={locationForm.locationType} onChange={v => setLocationForm({ ...locationForm, locationType: v })} options={['Main Entrance', 'Classroom', 'Office', 'Restricted Area', 'Event Entrance', 'Visitor Desk']} />
              <Input label="Operational Hours" value={locationForm.operationalHours} onChange={v => setLocationForm({ ...locationForm, operationalHours: v })} />
              <SelectInput label="Access Level Required" value={locationForm.accessLevelRequired} onChange={v => setLocationForm({ ...locationForm, accessLevelRequired: v })} options={['Standard', 'Elevated', 'Admin', 'Restricted']} />
            </div>
            <button onClick={saveLocation} disabled={saving} className="mt-4 w-full py-2.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Add Location
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange }) {
  return <div><label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label><input value={value || ''} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" /></div>;
}
function SelectInput({ label, value, onChange, options }) {
  return <div><label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label><select value={value || ''} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"><option value="">Select...</option>{options.map(o => <option key={o} value={o}>{o}</option>)}</select></div>;
}