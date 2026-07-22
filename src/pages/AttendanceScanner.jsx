import React, { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import CameraViewfinder from '@/components/kp/CameraViewfinder';
import IronManHUD from '@/components/kp/IronManHUD';
import ManualScanPanel from '@/components/kp/ManualScanPanel';
import RfidScanPanel from '@/components/kp/RfidScanPanel';
import QrScanPanel from '@/components/kp/QrScanPanel';
import { useFaceTracker } from '@/hooks/useFaceTracker';
import IpCameraPanel from '@/components/kp/IpCameraPanel';
import AttendanceDashboard from '@/pages/AttendanceDashboard';
import CameraManagement from '@/pages/CameraManagement';
import { Avatar } from '@/components/kp/ui';
import CameraLocationsList from '@/components/kp/scan/CameraLocationsList';
import LiveActivityFeed from '@/components/kp/scan/LiveActivityFeed';
import CurrentlyInsideTable from '@/components/kp/scan/CurrentlyInsideTable';
import AlertsPanel from '@/components/kp/scan/AlertsPanel';
import ScanLogTable from '@/components/kp/scan/ScanLogTable';
import { logAudit, createNotification } from '@/lib/audit';
import {
  ScanFace, CheckCircle2, XCircle, Pause, Play, Square, Camera, Settings,
  Maximize2, Minimize2, Wifi, MapPin, ShieldAlert, AlertTriangle,
  QrCode, Keyboard, Radio, Server, User, ChevronDown, LayoutDashboard,
  UserCheck, Users, GraduationCap, Briefcase,
} from 'lucide-react';

const MAX_CANDIDATES = 8;

const MODES = [
  { id: 'facial', label: 'Facial', icon: ScanFace },
  { id: 'qr', label: 'QR', icon: QrCode },
  { id: 'manual', label: 'Manual', icon: Keyboard },
  { id: 'rfid', label: 'RFID', icon: Radio },
];

function StatTile({ icon: Icon, label, value, color }) {
  return (
    <div className="kp-panel rounded-xl p-2.5 flex items-center gap-2.5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold text-[hsl(var(--kp-teal))] leading-none">{value}</div>
        <div className="text-[11px] text-gray-400 mt-0.5 truncate">{label}</div>
      </div>
    </div>
  );
}

export default function AttendanceScanner() {
  const camRef = useRef(null);
  const phaseRef = useRef('idle');
  const scanRef = useRef(null);
  const camBoxRef = useRef(null);
  const logRef = useRef(null);
  const camMgmtRef = useRef(null);

  const [people, setPeople] = useState([]);
  const [logbook, setLogbook] = useState([]);
  const [scanFeed, setScanFeed] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [savedCameras, setSavedCameras] = useState([]);
  const [deviceLocation, setDeviceLocation] = useState('Main Entrance');
  const [mode, setMode] = useState('facial');
  const [phase, setPhase] = useState('idle');
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [paused, setPaused] = useState(false);
  const [cameraSource, setCameraSource] = useState('device');
  const [cameraActive, setCameraActive] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [me, setMe] = useState(null);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    base44.auth.me().then(setMe).catch(() => {});
  }, []);

  const toggleFullscreen = () => {
    const el = camBoxRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  useEffect(() => {
    const h = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const load = async () => {
    try {
      const [students, employees, att, locs, cams, alts] = await Promise.all([
        base44.entities.Student.list(),
        base44.entities.Employee.list(),
        base44.entities.Attendance.list('-created_date', 80),
        base44.entities.ScannerLocation.list().catch(() => []),
        base44.entities.ScannerDevice.list().catch(() => []),
        base44.entities.SecurityAlert.list('-created_date', 20).catch(() => []),
      ]);
      setPeople([
        ...students.map((s) => ({ ...s, type: 'student', name: `${s.first_name} ${s.last_name}`.trim(), person_id: s.id })),
        ...employees.map((e) => ({ ...e, type: 'employee', name: `${e.first_name} ${e.last_name}`.trim(), person_id: e.id })),
      ]);
      setLogbook(att);
      setAlerts(alts);
      const locNames = locs.map((l) => l.locationName).filter(Boolean);
      setLocations(locNames.length ? locNames : ['Main Entrance', 'Front Gate', 'Office', 'Library', 'Canteen', 'Gym']);
      setSavedCameras(cams.filter((c) => c.status !== 'Disabled' && c.streamUrl));
    } catch (e) { /* */ }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const withPhotos = useMemo(() => people.filter((p) => !!p.photo_url), [people]);
  const peopleMap = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p])), [people]);
  const candidates = useMemo(() => withPhotos.slice(0, MAX_CANDIDATES), [withPhotos]);
  const trackedFaces = useFaceTracker(camRef, true, 200);

  const recordAttendance = async (person, confidence, method = 'facial', location = '') => {
    const isStudent = person.type === 'student';
    const accountInactive = isStudent
      ? (person.enrollment_status === 'archived' || person.enrollment_status === 'transferred')
      : (person.status === 'inactive');
    if (accountInactive) return { ok: false, person, confidence, error: `${person.name} is ${isStudent ? person.enrollment_status : 'inactive'}.` };

    const today = new Date().toLocaleDateString('en-CA');
    const todays = logbook.filter((a) => a.person_id === person.id && a.date === today);
    const last = todays[todays.length - 1];
    const detectedType = last?.scan_type === 'time_in' ? 'time_out' : 'time_in';

    if (detectedType === 'time_out' && (!last || last.scan_type !== 'time_in')) {
      return { ok: false, person, confidence, error: `${person.name} has not checked in yet.` };
    }

    const nowDate = new Date();
    const time = nowDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const isLate = detectedType === 'time_in' && nowDate.getHours() >= 8 && nowDate.getMinutes() >= 1;
    const insideStatus = detectedType === 'time_in' ? 'inside' : 'outside';

    try {
      await base44.entities.Attendance.create({
        person_id: person.id, person_name: person.name, person_type: person.type,
        scan_type: detectedType, status: detectedType === 'time_in' ? (isLate ? 'late' : 'present') : 'present',
        method, date: today, time, grade: person.grade, section: person.section,
        inside_status: insideStatus, confidence_score: confidence, scanner_location: location || '',
      });
      if (isStudent) {
        await base44.entities.Student.update(person.id, {
          inside_status: insideStatus,
          attendance_present: detectedType === 'time_in' && !isLate ? (person.attendance_present || 0) + 1 : person.attendance_present,
          attendance_late: detectedType === 'time_in' && isLate ? (person.attendance_late || 0) + 1 : person.attendance_late,
        });
        if (detectedType === 'time_in') {
          await createNotification(
            person.parent_name || 'Parent/Guardian',
            `${person.name} has arrived at school`,
            `Your child ${person.name} checked in at ${time} on ${today} via ${method}. Status: ${isLate ? 'Late' : 'Present'}.`,
            'attendance', 'Attendance', person.id
          );
        }
      } else {
        await base44.entities.Employee.update(person.id, { inside_status: insideStatus });
      }
      await logAudit(`${method}_scan`, 'Attendance', person.id, `${person.name} ${detectedType.replace('_', ' ')} at ${time} - ${confidence}% @ ${location || 'unknown'}`);
      return { ok: true, person, confidence, type: detectedType, time, status: isLate ? 'late' : 'present', insideStatus, location };
    } catch (e) {
      return { ok: false, person, confidence, error: `Network error recording ${person.name}.` };
    }
  };

  const logUnknownFace = async (file_url, count, mixed) => {
    const ts = new Date().toLocaleString();
    try {
      const a = await base44.entities.SecurityAlert.create({
        alertType: 'Unregistered Face Repeated',
        severity: mixed ? 'High' : 'Critical',
        location: deviceLocation || 'Attendance Scanner',
        description: `Unknown / foreign contaminant person detected at ${ts}. ${count} unrecognized face(s) captured. Possible intruder — review frame. Frame: ${file_url}`,
        timestamp: new Date().toISOString(),
        status: 'Open',
      });
      setAlerts((prev) => [a, ...prev].slice(0, 20));
      await logAudit('security_alert', 'SecurityAlert', a.id, `Foreign contaminant person detected — ${count} unknown face(s). Frame saved.`);
    } catch (e) { /* */ }
  };

  const scanFace = async () => {
    setError(null);
    setResults([]);

    if (!camRef.current || !camRef.current.isStreaming()) return;
    if (candidates.length === 0) { setError('No facial specimens enrolled yet. Record faces on student/staff profiles first.'); return; }

    setPhase('scanning');
    const dataURL = camRef.current.capture();
    if (!dataURL) { setPhase('idle'); return; }

    try {
      const blob = await (await fetch(dataURL)).blob();
      const file = new File([blob], 'face-capture.jpg', { type: 'image/jpeg' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const galleryUrls = candidates.map((p) => p.photo_url);
      const prompt = `You are a facial recognition assistant for a school attendance system.
Image #1 is a live camera capture that may contain ONE OR MORE people.
Images #2 through #${galleryUrls.length + 1} are reference photos of enrolled people, in this exact order:
${candidates.map((p, i) => `#${i + 2} — ${p.name} (${p.type})`).join('\n')}

Identify every visible face in image #1 and match it to the best matching reference image (if any). Return a match for EACH distinct face detected.
- matched_index: 1-based index of the matching reference (1 = first reference, i.e. image #2).
- confidence: 0–100. Only include matches with confidence >= 55. If a face has no good reference match, omit it from matches but count it in total_faces.
Respond ONLY as JSON: {"total_faces": number, "matches": [{"matched_index": number, "confidence": number}], "reason": string}`;

      const llm = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: [file_url, ...galleryUrls],
        response_json_schema: {
          type: 'object',
          properties: {
            total_faces: { type: 'number' },
            matches: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  matched_index: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
                  confidence: { type: 'number' },
                },
              },
            },
            reason: { type: 'string' },
          },
        },
      });

      const matches = Array.isArray(llm?.matches) ? llm.matches : [];
      const valid = matches.filter((m) => m.matched_index != null && m.matched_index >= 1 && m.matched_index <= candidates.length && Number(m.confidence) >= 55);
      const totalFaces = Number(llm?.total_faces) || 0;
      const unknownCount = Math.max(0, totalFaces - valid.length);

      if (unknownCount > 0) await logUnknownFace(file_url, unknownCount, valid.length > 0);

      if (valid.length === 0) {
        if (unknownCount > 0) {
          setResults([{ ok: false, person: null, unknown: true, confidence: 0, error: `${unknownCount} unknown / foreign contaminant person(s) detected — logged as possible intruder.` }]);
        } else {
          setResults([{ ok: false, person: null, confidence: 0, error: llm?.reason || 'No face detected' }]);
        }
        setPhase('fail');
        return;
      }

      const outcomes = [];
      for (const m of valid) {
        const person = candidates[m.matched_index - 1];
        const conf = Math.round(Number(m.confidence) || 0);
        outcomes.push(await recordAttendance(person, conf, 'facial', deviceLocation));
      }
      if (unknownCount > 0) {
        outcomes.push({ ok: false, person: null, unknown: true, error: `${unknownCount} unknown / foreign contaminant person(s) detected — logged as possible intruder.` });
      }
      setResults(outcomes);
      const feedEntries = outcomes.map((o) => ({
        location: deviceLocation,
        person_id: o.person?.id,
        name: o.person?.name,
        person_type: o.person?.type,
        grade: o.person?.grade,
        section: o.person?.section,
        photo: o.person ? peopleMap[o.person.id]?.photo_url : null,
        time: o.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        scan_type: o.type,
        status: o.status,
        ok: o.ok,
        unknown: !!o.unknown,
        confidence: o.confidence,
      }));
      setScanFeed((prev) => [...feedEntries, ...prev].slice(0, 60));
      setPhase(outcomes.some((o) => o.ok) ? 'success' : 'fail');
      load();
    } catch (e) {
      setError('AI identification failed: ' + (e?.message || 'unexpected error') + '.');
      setPhase('fail');
    }
  };

  scanRef.current = scanFace;

  // Real-time scan loop — facial mode only; re-triggers immediately after each scan completes
  useEffect(() => {
    if (paused || mode !== 'facial' || phase !== 'idle' || !streaming) return;
    const t = setTimeout(() => { if (phaseRef.current === 'idle' && camRef.current?.isStreaming()) scanRef.current(); }, 50);
    return () => clearTimeout(t);
  }, [phase, paused, mode, streaming]);

  useEffect(() => {
    if (phase === 'success' || phase === 'fail') {
      const t = setTimeout(() => setPhase('idle'), 500);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const handleRecord = async (person, method, confidence = 100) => {
    const out = await recordAttendance(person, confidence, method, deviceLocation);
    setResults([out.ok ? { ok: true, person, confidence: out.confidence, type: out.type, time: out.time, status: out.status, insideStatus: out.insideStatus } : { ok: false, person, error: out.error }]);
    setPhase(out.ok ? 'success' : 'fail');
    if (out.ok) {
      setScanFeed((prev) => [{
        location: deviceLocation, person_id: person.id, name: person.name, person_type: person.type,
        grade: person.grade, section: person.section,
        photo: peopleMap[person.id]?.photo_url,
        time: out.time, scan_type: out.type, status: out.status, ok: true, confidence: out.confidence,
      }, ...prev].slice(0, 60));
      load();
    }
    return out;
  };

  const switchMode = (m) => { setMode(m); setPhase('idle'); setResults([]); setError(null); };

  const snapshot = () => {
    const dataURL = camRef.current?.capture();
    if (!dataURL) return;
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `scan-${Date.now()}.jpg`;
    a.click();
  };

  const openCameraMgmt = () => {
    if (camMgmtRef.current) {
      camMgmtRef.current.open = true;
      camMgmtRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Derived metrics
  const today = new Date().toLocaleDateString('en-CA');
  const todays = logbook.filter((a) => a.date === today);
  const studentIn = todays.filter((a) => a.scan_type === 'time_in' && a.person_type === 'student').length;
  const studentOut = todays.filter((a) => a.scan_type === 'time_out' && a.person_type === 'student').length;
  const teacherIn = todays.filter((a) => a.scan_type === 'time_in' && a.person_type === 'employee').length;
  const employeesInside = people.filter((p) => p.type === 'employee' && p.inside_status === 'inside').length;
  const visitorsInside = alerts.filter((a) => new Date(a.timestamp || a.created_date).toLocaleDateString('en-CA') === today).length;
  const onlineCams = savedCameras.filter((c) => c.status === 'Online').length;
  const activeCameras = `${onlineCams + (streaming ? 1 : 0)}/${savedCameras.length + 1}`;
  const okCount = results.filter((r) => r.ok).length;
  const unknownCount = results.filter((r) => r.unknown).length;

  // Locate people based on the camera that last scanned them in.
  const lastLocByPerson = useMemo(() => {
    const map = {};
    for (const a of logbook) {
      if (!a.scanner_location) continue;
      const cur = map[a.person_id];
      if (!cur || new Date(a.created_date) > new Date(cur.created_date)) map[a.person_id] = a;
    }
    return map;
  }, [logbook]);
  const insidePeople = people.filter((p) => p.inside_status === 'inside');

  const lastScan = scanFeed[0];
  const showFacialFeed = mode === 'facial' && cameraSource === 'device' && cameraActive;

  const timeStr = new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const ctrlBtn = (onClick, Icon, label, active) => (
    <button
      onClick={onClick}
      title={label}
      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
        active ? 'bg-[hsl(var(--kp-teal))] text-white' : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
      }`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <div className="space-y-4">
      {/* ===== Header ===== */}
      <div className="kp-panel rounded-2xl px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[hsl(var(--kp-teal))] flex items-center justify-center">
            <ScanFace className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-[hsl(var(--kp-teal))] leading-tight">Attendance Scanner</h1>
            <p className="text-[11px] text-gray-400">AI-Powered Facial Recognition &amp; Attendance</p>
          </div>
        </div>

        {/* Center: location + live */}
        <div className="flex items-center gap-2 lg:mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1.5 bg-white/70">
            <MapPin className="w-3.5 h-3.5 text-[hsl(var(--kp-teal))]" />
            <select
              value={deviceLocation}
              onChange={(e) => setDeviceLocation(e.target.value)}
              className="text-xs font-semibold text-[hsl(var(--kp-teal))] bg-transparent focus:outline-none max-w-[10rem]"
            >
              {locations.map((l) => <option key={l} value={l} className="text-black">{l}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> LIVE
          </span>
        </div>

        {/* Right: meta */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-right">
            <div className="text-xs font-semibold text-gray-700 leading-none">{timeStr}</div>
            <div className="text-[10px] text-gray-400">{dateStr}</div>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
            <Server className="w-3.5 h-3.5 text-green-500" /> AI Server: <span className="font-semibold text-green-600">Online</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
            <Camera className="w-3.5 h-3.5 text-[hsl(var(--kp-teal))]" /> Active: <span className="font-semibold text-[hsl(var(--kp-teal))]">{activeCameras}</span>
          </span>
          <div className="h-8 w-px bg-gray-200" />
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-[hsl(var(--kp-teal))]/15 flex items-center justify-center">
              <User className="w-4 h-4 text-[hsl(var(--kp-teal))]" />
            </div>
            <span className="text-xs font-semibold text-gray-700 hidden sm:inline">{me?.full_name || 'Admin'}</span>
          </div>
        </div>
      </div>

      {/* ===== Three-column layout ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: camera locations */}
        <CameraLocationsList
          className="lg:col-span-3"
          savedCameras={savedCameras}
          deviceLocation={deviceLocation}
          onDeviceLocationChange={setDeviceLocation}
          scanFeed={scanFeed}
          onAddCamera={openCameraMgmt}
          streaming={streaming}
        />

        {/* Center: live feed + control bar + stats */}
        <div className="lg:col-span-6 space-y-3">
          {/* Mode + source selector */}
          <div className="kp-panel rounded-2xl p-2 flex flex-col sm:flex-row gap-2">
            <div className="grid grid-cols-4 gap-2 flex-1">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => switchMode(m.id)}
                  className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-semibold transition-all ${
                    mode === m.id ? 'bg-[hsl(var(--kp-teal))] text-white shadow' : 'text-[hsl(var(--kp-teal))] hover:bg-gray-50'
                  }`}
                >
                  <m.icon className="w-4 h-4" /> <span className="hidden sm:inline">{m.label}</span>
                </button>
              ))}
            </div>
            {mode === 'facial' && (
              <div className="grid grid-cols-2 gap-2 sm:w-48">
                <button
                  onClick={() => setCameraSource('device')}
                  className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-semibold transition-all ${
                    cameraSource === 'device' ? 'bg-[hsl(var(--kp-teal-light))] text-white shadow' : 'text-[hsl(var(--kp-teal))] hover:bg-gray-50'
                  }`}
                >
                  <Camera className="w-4 h-4" /> Device
                </button>
                <button
                  onClick={() => setCameraSource('ip')}
                  className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-semibold transition-all ${
                    cameraSource === 'ip' ? 'bg-[hsl(var(--kp-teal-light))] text-white shadow' : 'text-[hsl(var(--kp-teal))] hover:bg-gray-50'
                  }`}
                >
                  <Wifi className="w-4 h-4" /> IP Cam
                </button>
              </div>
            )}
          </div>

          {/* Live feed / mode panel */}
          <div className="kp-panel rounded-2xl p-3 sm:p-4">
            {mode === 'facial' && cameraSource === 'ip' ? (
              <IpCameraPanel people={people} onRecord={handleRecord} />
            ) : mode === 'facial' ? (
              <>
                {error && (
                  <div className="mb-3 p-3 rounded-lg bg-orange-50 border border-orange-200 flex items-start gap-2 text-sm text-orange-700">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                  </div>
                )}

                {results.length > 0 && (
                  <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {results.map((r, i) => {
                      if (r.unknown) {
                        return (
                          <div key={i} className="p-3 rounded-lg border border-red-300 bg-red-50 flex items-center gap-3 text-sm text-red-800">
                            <ShieldAlert className="w-5 h-5 shrink-0 text-red-600" />
                            <div className="flex-1 font-medium">{r.error}</div>
                          </div>
                        );
                      }
                      return (
                        <div key={i} className={`p-3 rounded-lg border flex items-center gap-3 text-sm ${r.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                          {r.ok ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
                          {r.ok ? (
                            <div className="flex-1">
                              <span className="font-medium">{r.person.name}</span> — {r.confidence}%. {r.type.replace('_', ' ')} at {r.time}. <span className="capitalize">({r.status})</span>
                            </div>
                          ) : (
                            <div className="flex-1">{r.person ? <span className="font-medium">{r.person.name}: </span> : ''}{r.error}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div ref={camBoxRef} className="relative aspect-video rounded-xl overflow-hidden bg-gray-900">
                  {showFacialFeed ? (
                    <CameraViewfinder
                      ref={camRef}
                      active
                      facingMode="user"
                      onStart={() => setStreaming(true)}
                      onStop={() => setStreaming(false)}
                      overlay={<IronManHUD phase={phase} unknown={unknownCount > 0} okCount={okCount} faces={trackedFaces} />}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60">
                      <Camera className="w-8 h-8" />
                      <span className="text-sm">Camera stopped</span>
                      <button onClick={() => setCameraActive(true)} className="mt-1 px-3 py-1.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-xs font-semibold">
                        <Play className="w-3.5 h-3.5 inline mr-1" /> Start
                      </button>
                    </div>
                  )}

                  {/* Live badge */}
                  <div className="absolute top-2 left-2 z-20 inline-flex items-center gap-1 bg-black/55 text-white text-[10px] px-2 py-1 rounded-full font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> {paused ? 'PAUSED' : 'LIVE SCANNER'}
                  </div>

                  {/* Last scanned overlay card */}
                  {lastScan && !lastScan.unknown && (
                    <div className="absolute left-2 bottom-2 z-20 rounded-xl bg-black/55 backdrop-blur-md border border-white/15 p-2 flex items-center gap-2 max-w-[16rem]">
                      <Avatar name={lastScan.name} src={lastScan.photo} size="w-9 h-9" />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{lastScan.name}</div>
                        <div className="text-[10px] text-white/70 capitalize truncate">
                          {lastScan.person_type}{lastScan.grade ? ` · ${lastScan.grade}` : ''}{lastScan.section ? `-${lastScan.section}` : ''}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${lastScan.scan_type === 'time_in' ? 'bg-green-500/30 text-green-200' : 'bg-blue-500/30 text-blue-200'}`}>
                            {lastScan.scan_type === 'time_in' ? 'Time In' : 'Time Out'}
                          </span>
                          <span className="text-[9px] text-white/60">{lastScan.time}{lastScan.confidence ? ` · ${lastScan.confidence}%` : ''}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fullscreen toggle */}
                  <button onClick={toggleFullscreen} className="absolute top-2 right-2 z-20 w-8 h-8 rounded-lg bg-black/55 text-white flex items-center justify-center hover:bg-black/70">
                    {isFs ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>

                {/* Control bar */}
                <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                  {ctrlBtn(() => setPaused((p) => !p), paused ? Play : Pause, paused ? 'Resume' : 'Pause', paused)}
                  {ctrlBtn(() => setCameraActive((a) => !a), cameraActive ? Square : Play, cameraActive ? 'Stop' : 'Start', !cameraActive)}
                  {ctrlBtn(snapshot, Camera, 'Snapshot', false)}
                  <div className="w-px h-9 bg-gray-200" />
                  {ctrlBtn(() => switchMode('facial'), ScanFace, 'Facial mode', mode === 'facial')}
                  {ctrlBtn(() => switchMode('qr'), QrCode, 'QR / ID', mode === 'qr')}
                  {ctrlBtn(() => switchMode('manual'), Keyboard, 'Manual', mode === 'manual')}
                  <div className="w-px h-9 bg-gray-200" />
                  {ctrlBtn(openCameraMgmt, Settings, 'Camera settings', false)}
                </div>
              </>
            ) : mode === 'qr' ? (
              <QrScanPanel people={people} onRecord={handleRecord} />
            ) : mode === 'manual' ? (
              <ManualScanPanel people={people} onRecord={handleRecord} />
            ) : (
              <RfidScanPanel people={people} onRecord={handleRecord} />
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <StatTile icon={UserCheck} label="Students Entered" value={studentIn} color="bg-[hsl(var(--kp-green))]" />
            <StatTile icon={Users} label="Students Exited" value={studentOut} color="bg-[hsl(var(--kp-teal-light))]" />
            <StatTile icon={GraduationCap} label="Teachers Entered" value={teacherIn} color="bg-indigo-500" />
            <StatTile icon={Briefcase} label="Employees Present" value={employeesInside} color="bg-[hsl(var(--kp-teal))]" />
            <StatTile icon={ShieldAlert} label="Flagged Today" value={visitorsInside} color="bg-[hsl(var(--kp-orange))]" />
            <StatTile icon={Camera} label="Active Cameras" value={activeCameras} color="bg-[hsl(var(--kp-teal-dark))]" />
          </div>
        </div>

        {/* Right: live activity */}
        <LiveActivityFeed
          className="lg:col-span-3"
          scanFeed={scanFeed}
          onViewAll={() => logRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        />
      </div>

      {/* ===== Bottom section ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div ref={logRef}>
          <CurrentlyInsideTable insidePeople={insidePeople} lastLocByPerson={lastLocByPerson} now={now} />
        </div>
        <div className="space-y-4">
          <AlertsPanel alerts={alerts} />
          <ScanLogTable logbook={logbook} peopleMap={peopleMap} />
        </div>
      </div>

      {/* Collapsible: AI Analytics Dashboard */}
      <details className="kp-panel rounded-2xl overflow-hidden group">
        <summary className="flex items-center gap-2 px-4 sm:px-6 py-4 cursor-pointer list-none">
          <LayoutDashboard className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
          <span className="text-sm font-bold text-[hsl(var(--kp-teal))]">AI Analytics Dashboard</span>
          <ChevronDown className="w-4 h-4 text-gray-400 ml-auto group-open:rotate-180 transition-transform" />
        </summary>
        <div className="px-4 sm:px-6 pb-6 border-t border-gray-100 pt-4">
          <AttendanceDashboard />
        </div>
      </details>

      {/* Collapsible: Camera & Device Management */}
      <details ref={camMgmtRef} className="kp-panel rounded-2xl overflow-hidden group">
        <summary className="flex items-center gap-2 px-4 sm:px-6 py-4 cursor-pointer list-none">
          <Camera className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
          <span className="text-sm font-bold text-[hsl(var(--kp-teal))]">Camera &amp; Device Management</span>
          <ChevronDown className="w-4 h-4 text-gray-400 ml-auto group-open:rotate-180 transition-transform" />
        </summary>
        <div className="px-4 sm:px-6 pb-6 border-t border-gray-100 pt-4">
          <CameraManagement />
        </div>
      </details>
    </div>
  );
}