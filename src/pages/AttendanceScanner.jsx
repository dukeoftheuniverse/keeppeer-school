import React, { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import CameraViewfinder from '@/components/kp/CameraViewfinder';
import IronManHUD from '@/components/kp/IronManHUD';
import ManualScanPanel from '@/components/kp/ManualScanPanel';
import RfidScanPanel from '@/components/kp/RfidScanPanel';
import QrScanPanel from '@/components/kp/QrScanPanel';
import { useFaceTracker } from '@/hooks/useFaceTracker';
import IpCameraPanel from '@/components/kp/IpCameraPanel';
import MultiCameraGrid from '@/components/kp/MultiCameraGrid';
import AttendanceDashboard from '@/pages/AttendanceDashboard';
import CameraManagement from '@/pages/CameraManagement';
import { Avatar } from '@/components/kp/ui';
import { logAudit, createNotification } from '@/lib/audit';
import {
  ScanFace, CheckCircle2, XCircle, Pause, Play, AlertTriangle,
  LogIn, LogOut, UserCheck, Clock, Users, Users2, ShieldAlert,
  QrCode, Keyboard, Radio, Maximize2, Minimize2, Camera, Wifi,
  ChevronDown, LayoutDashboard, Activity, MapPin
} from 'lucide-react';

const MAX_CANDIDATES = 8;

const MODES = [
  { id: 'facial', label: 'Facial', icon: ScanFace },
  { id: 'qr', label: 'QR / Barcode', icon: QrCode },
  { id: 'manual', label: 'Manual', icon: Keyboard },
  { id: 'rfid', label: 'RFID', icon: Radio },
];

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="kp-panel rounded-xl p-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}><Icon className="w-4 h-4 text-white" /></div>
      <div><div className="text-xl font-bold text-[hsl(var(--kp-teal))] leading-none">{value}</div><div className="text-xs text-gray-400 mt-0.5">{label}</div></div>
    </div>
  );
}

export default function AttendanceScanner() {
  const camRef = useRef(null);
  const phaseRef = useRef('idle');
  const scanRef = useRef(null);
  const [people, setPeople] = useState([]);
  const [logbook, setLogbook] = useState([]);
  const [scanFeed, setScanFeed] = useState([]);
  const [locations, setLocations] = useState([]);
  const [savedCameras, setSavedCameras] = useState([]);
  const [deviceLocation, setDeviceLocation] = useState('Main Entrance');
  const [mode, setMode] = useState('facial');
  const [phase, setPhase] = useState('idle');
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [paused, setPaused] = useState(false);
  const [cameraSource, setCameraSource] = useState('device');
  const [streaming, setStreaming] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const camBoxRef = useRef(null);

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
      const [students, employees, att, locs, cams] = await Promise.all([
        base44.entities.Student.list(),
        base44.entities.Employee.list(),
        base44.entities.Attendance.list('-created_date', 80),
        base44.entities.ScannerLocation.list().catch(() => []),
        base44.entities.ScannerDevice.list().catch(() => []),
      ]);
      setPeople([
        ...students.map((s) => ({ ...s, type: 'student', name: `${s.first_name} ${s.last_name}`.trim(), person_id: s.id })),
        ...employees.map((e) => ({ ...e, type: 'employee', name: `${e.first_name} ${e.last_name}`.trim(), person_id: e.id })),
      ]);
      setLogbook(att);
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
  const trackedFaces = useFaceTracker(camRef, true, 600);

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

    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const isLate = detectedType === 'time_in' && now.getHours() >= 8 && now.getMinutes() >= 1;
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
      await base44.entities.SecurityAlert.create({
        alertType: 'Unregistered Face Repeated',
        severity: mixed ? 'High' : 'Critical',
        location: 'Attendance Scanner',
        description: `Unknown / foreign contaminant person detected at ${ts}. ${count} unrecognized face(s) captured. Possible intruder — review frame. Frame: ${file_url}`,
        timestamp: new Date().toISOString(),
        status: 'Open',
      });
      await logAudit('security_alert', 'SecurityAlert', '', `Foreign contaminant person detected — ${count} unknown face(s). Frame saved.`);
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
        name: o.person?.name,
        photo: o.person ? peopleMap[o.person.id]?.photo_url : null,
        time: o.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        scan_type: o.type,
        status: o.status,
        ok: o.ok,
        unknown: !!o.unknown,
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
        location: deviceLocation, name: person.name, photo: peopleMap[person.id]?.photo_url,
        time: out.time, scan_type: out.type, status: out.status, ok: true,
      }, ...prev].slice(0, 60));
      load();
    }
    return out;
  };

  const switchMode = (m) => { setMode(m); setPhase('idle'); setResults([]); setError(null); };

  const today = new Date().toLocaleDateString('en-CA');
  const todays = logbook.filter((a) => a.date === today);
  const present = todays.filter((a) => a.status === 'present').length;
  const late = todays.filter((a) => a.status === 'late').length;
  const inside = people.filter((p) => p.inside_status === 'inside').length;
  const okCount = results.filter((r) => r.ok).length;
  const unknownCount = results.filter((r) => r.unknown).length;

  const totalScans = todays.length;

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
  const byLocation = useMemo(() => {
    const groups = {};
    insidePeople.forEach((p) => {
      const loc = lastLocByPerson[p.id]?.scanner_location || 'Unknown';
      (groups[loc] = groups[loc] || []).push(p);
    });
    return groups;
  }, [insidePeople, lastLocByPerson]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ScanFace className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
          <h1 className="text-xl sm:text-2xl font-bold text-[hsl(var(--kp-teal))]">Attendance Scanner</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-semibold flex items-center gap-1"><Users2 className="w-3 h-3" /> AUTO · MULTI-FACE</span>
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-1.5">
          {paused ? <><Pause className="w-3.5 h-3.5" /> Paused</> : <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live</>}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={UserCheck} label="Present Today" value={present} color="bg-[hsl(var(--kp-green))]" />
        <StatCard icon={Clock} label="Late Today" value={late} color="bg-[hsl(var(--kp-orange))]" />
        <StatCard icon={Users} label="Inside Now" value={inside} color="bg-[hsl(var(--kp-teal))]" />
        <StatCard icon={Activity} label="Total Scans Today" value={totalScans} color="bg-[hsl(var(--kp-teal-light))]" />
      </div>

      {/* Mode + camera source toolbar */}
      <div className="kp-panel rounded-2xl p-2 flex flex-col sm:flex-row gap-2">
        <div className="grid grid-cols-4 gap-2 flex-1">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => switchMode(m.id)}
              className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${mode === m.id ? 'bg-[hsl(var(--kp-teal))] text-white shadow' : 'text-[hsl(var(--kp-teal))] hover:bg-gray-50'}`}>
              <m.icon className="w-4 h-4" /> <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>
        {mode === 'facial' && (
          <div className="grid grid-cols-2 gap-2 sm:w-64">
            <button onClick={() => setCameraSource('device')} className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${cameraSource === 'device' ? 'bg-[hsl(var(--kp-teal-light))] text-white shadow' : 'text-[hsl(var(--kp-teal))] hover:bg-gray-50'}`}>
              <Camera className="w-4 h-4" /> Device
            </button>
            <button onClick={() => setCameraSource('ip')} className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${cameraSource === 'ip' ? 'bg-[hsl(var(--kp-teal-light))] text-white shadow' : 'text-[hsl(var(--kp-teal))] hover:bg-gray-50'}`}>
              <Wifi className="w-4 h-4" /> IP Cam
            </button>
          </div>
        )}
      </div>

      {/* Main scan area */}
      <div className="kp-panel rounded-2xl p-4 sm:p-6">
        {mode === 'facial' && cameraSource === 'ip' ? (
          <IpCameraPanel people={people} onRecord={handleRecord} />
        ) : mode === 'facial' ? (
          <>
            <p className="text-sm text-gray-500 mb-3 text-center">Camera scans in real time — reticles lock onto up to 5 faces. Each camera logs time in/out and tags the person's location. Unknown faces are flagged as intruders.</p>

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

            <MultiCameraGrid
              savedCameras={savedCameras}
              scanFeed={scanFeed}
              deviceLocation={deviceLocation}
              onDeviceLocationChange={setDeviceLocation}
              locationOptions={locations}>
              <div ref={camBoxRef} className="relative aspect-video rounded-xl overflow-hidden">
                <CameraViewfinder
                  ref={camRef}
                  active
                  facingMode="user"
                  onStart={() => setStreaming(true)}
                  onStop={() => setStreaming(false)}
                  overlay={<IronManHUD phase={phase} unknown={unknownCount > 0} okCount={okCount} faces={trackedFaces} />}
                />
              </div>
            </MultiCameraGrid>

            <div className="flex items-center justify-center gap-2 mt-4">
              <button onClick={toggleFullscreen} className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 bg-[hsl(var(--kp-teal))] text-white hover:brightness-105">
                {isFs ? <><Minimize2 className="w-4 h-4" /> Exit Fullscreen</> : <><Maximize2 className="w-4 h-4" /> Fullscreen</>}
              </button>
              <button onClick={() => setPaused((p) => !p)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 ${paused ? 'bg-[hsl(var(--kp-green))] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {paused ? <><Play className="w-4 h-4" /> Resume</> : <><Pause className="w-4 h-4" /> Pause</>}
              </button>
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

      {/* Location Board — where is everyone right now? */}
      <div className="kp-panel rounded-2xl p-4 sm:p-6">
        <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><MapPin className="w-4 h-4" /> Location Board — Where is everyone?</h3>
        {insidePeople.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No one is currently inside the campus.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(byLocation).map(([loc, ps]) => (
              <div key={loc} className="rounded-xl border border-gray-100 p-3">
                <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-[hsl(var(--kp-teal))]">
                  <MapPin className="w-3.5 h-3.5" /> <span className="truncate">{loc}</span>
                  <span className="ml-auto text-gray-400 font-normal">{ps.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ps.map((p) => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-gray-50 rounded-full pl-1 pr-2 py-0.5">
                      <Avatar name={p.name} src={p.photo_url} size="w-6 h-6" />
                      <span className="text-xs text-gray-700 truncate max-w-[8rem]">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
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
      <details className="kp-panel rounded-2xl overflow-hidden group">
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