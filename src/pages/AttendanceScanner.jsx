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
import { logAudit, createNotification } from '@/lib/audit';
import {
  ScanFace, CheckCircle2, XCircle, Pause, Play, AlertTriangle,
  LogIn, LogOut, UserCheck, Clock, Users, Users2, ShieldAlert,
  QrCode, Keyboard, Radio, Maximize2, Minimize2, LayoutDashboard, Camera, Wifi
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
  const [mode, setMode] = useState('facial');
  const [phase, setPhase] = useState('idle');
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [paused, setPaused] = useState(false);
  const [view, setView] = useState('scanner');
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
      const [students, employees, att] = await Promise.all([
        base44.entities.Student.list(),
        base44.entities.Employee.list(),
        base44.entities.Attendance.list('-created_date', 50),
      ]);
      setPeople([
        ...students.map((s) => ({ ...s, type: 'student', name: `${s.first_name} ${s.last_name}`.trim(), person_id: s.id })),
        ...employees.map((e) => ({ ...e, type: 'employee', name: `${e.first_name} ${e.last_name}`.trim(), person_id: e.id })),
      ]);
      setLogbook(att);
    } catch (e) { /* */ }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const withPhotos = useMemo(() => people.filter((p) => !!p.photo_url), [people]);
  const peopleMap = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p])), [people]);
  const candidates = useMemo(() => withPhotos.slice(0, MAX_CANDIDATES), [withPhotos]);
  const trackedFaces = useFaceTracker(camRef, true, 600);

  const recordAttendance = async (person, confidence, method = 'facial') => {
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
        inside_status: insideStatus, confidence_score: confidence,
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
      await logAudit(`${method}_scan`, 'Attendance', person.id, `${person.name} ${detectedType.replace('_', ' ')} at ${time} - ${confidence}%`);
      return { ok: true, person, confidence, type: detectedType, time, status: isLate ? 'late' : 'present', insideStatus };
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
        outcomes.push(await recordAttendance(person, conf, 'facial'));
      }
      if (unknownCount > 0) {
        outcomes.push({ ok: false, person: null, unknown: true, error: `${unknownCount} unknown / foreign contaminant person(s) detected — logged as possible intruder.` });
      }
      setResults(outcomes);
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
    const out = await recordAttendance(person, confidence, method);
    setResults([out.ok ? { ok: true, person, confidence: out.confidence, type: out.type, time: out.time, status: out.status, insideStatus: out.insideStatus } : { ok: false, person, error: out.error }]);
    setPhase(out.ok ? 'success' : 'fail');
    if (out.ok) load();
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ScanFace className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
        <h1 className="text-xl sm:text-2xl font-bold text-[hsl(var(--kp-teal))]">Attendance</h1>
        <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-semibold flex items-center gap-1"><Users2 className="w-3 h-3" /> AUTO · MULTI-FACE AI</span>
      </div>

      <div className="kp-panel rounded-2xl p-2 grid grid-cols-3 gap-2">
        {[{ id: 'scanner', label: 'Scanner', icon: ScanFace }, { id: 'dashboard', label: 'AI Dashboard', icon: LayoutDashboard }, { id: 'cameras', label: 'Cameras & Devices', icon: Camera }].map((t) => (
          <button key={t.id} onClick={() => setView(t.id)} className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${view === t.id ? 'bg-[hsl(var(--kp-teal))] text-white shadow' : 'text-[hsl(var(--kp-teal))] hover:bg-gray-50'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {view !== 'scanner' ? (
        view === 'dashboard' ? <AttendanceDashboard /> : <CameraManagement />
      ) : (
        <>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={UserCheck} label="Present Today" value={present} color="bg-[hsl(var(--kp-green))]" />
        <StatCard icon={Clock} label="Late Today" value={late} color="bg-[hsl(var(--kp-orange))]" />
        <StatCard icon={Users} label="Inside Now" value={inside} color="bg-[hsl(var(--kp-teal))]" />
      </div>

      {/* Camera source toggle */}
      <div className="kp-panel rounded-2xl p-2 grid grid-cols-2 gap-2 max-w-md">
        <button onClick={() => setCameraSource('device')} className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${cameraSource === 'device' ? 'bg-[hsl(var(--kp-teal))] text-white shadow' : 'text-[hsl(var(--kp-teal))] hover:bg-gray-50'}`}>
          <Camera className="w-4 h-4" /> Device Camera
        </button>
        <button onClick={() => setCameraSource('ip')} className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${cameraSource === 'ip' ? 'bg-[hsl(var(--kp-teal))] text-white shadow' : 'text-[hsl(var(--kp-teal))] hover:bg-gray-50'}`}>
          <Wifi className="w-4 h-4" /> IP Camera
        </button>
      </div>

      {cameraSource === 'ip' ? (
        <IpCameraPanel people={people} onRecord={handleRecord} />
      ) : (
        <>
      {/* Mode tabs */}
      <div className="kp-panel rounded-2xl p-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {MODES.map((m) => (
          <button key={m.id} onClick={() => switchMode(m.id)}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === m.id ? 'bg-[hsl(var(--kp-teal))] text-white shadow' : 'text-[hsl(var(--kp-teal))] hover:bg-gray-50'}`}>
            <m.icon className="w-4 h-4" /> {m.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="kp-panel rounded-2xl p-4 sm:p-6 lg:col-span-2">
          {mode === 'facial' && (
            <>
              <p className="text-sm text-gray-500 mb-3">Camera scans in real time. Reticles lock onto up to 5 faces; enrolled faces log time in/out; unknown faces are flagged as intruders.</p>
              <div ref={camBoxRef} className="mb-4 relative">
                <CameraViewfinder
                  ref={camRef}
                  active
                  facingMode="user"
                  onStart={() => setStreaming(true)}
                  onStop={() => setStreaming(false)}
                  overlay={<IronManHUD phase={phase} unknown={unknownCount > 0} okCount={okCount} faces={trackedFaces} />}
                />
              </div>

              {error && (
                <div className="mb-3 p-3 rounded-lg bg-orange-50 border border-orange-200 flex items-start gap-2 text-sm text-orange-700">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                </div>
              )}

              {results.length > 0 && (
                <div className="mb-3 space-y-2">
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
                            <span className="font-medium">{r.person.name}</span> — {r.confidence}% confidence. Checked {r.type.replace('_', ' ')} at {r.time}. Now {r.insideStatus}. <span className="capitalize">({r.status})</span>
                          </div>
                        ) : (
                          <div className="flex-1">{r.person ? <span className="font-medium">{r.person.name}: </span> : ''}{r.error}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-gray-500 flex items-center gap-1.5">
                  {paused ? <><Pause className="w-3.5 h-3.5" /> Scanning paused</> : <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Real-time scanning</>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={toggleFullscreen} className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 bg-[hsl(var(--kp-teal))] text-white hover:brightness-105">
                    {isFs ? <><Minimize2 className="w-4 h-4" /> Exit Fullscreen</> : <><Maximize2 className="w-4 h-4" /> Fullscreen</>}
                  </button>
                  <button onClick={() => setPaused((p) => !p)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 ${paused ? 'bg-[hsl(var(--kp-green))] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {paused ? <><Play className="w-4 h-4" /> Resume</> : <><Pause className="w-4 h-4" /> Pause</>}
                  </button>
                </div>
              </div>
            </>
          )}

          {mode === 'qr' && <QrScanPanel people={people} onRecord={handleRecord} />}
          {mode === 'manual' && <ManualScanPanel people={people} onRecord={handleRecord} />}
          {mode === 'rfid' && <RfidScanPanel people={people} onRecord={handleRecord} />}
        </div>

        {/* Recent scans */}
        <div className="kp-panel rounded-2xl p-4 sm:p-6">
          <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><Clock className="w-4 h-4" /> Recent Scans</h3>
          <div className="space-y-2 max-h-[40rem] overflow-y-auto kp-scroll-thin">
            {logbook.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No attendance records yet.</p> :
              logbook.map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50">
                  <Avatar name={s.person_name} src={peopleMap[s.person_id]?.photo_url} size="w-9 h-9" />
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${s.scan_type === 'time_in' ? 'bg-green-100' : 'bg-blue-100'}`}>
                    {s.scan_type === 'time_in' ? <LogIn className="w-3.5 h-3.5 text-green-600" /> : <LogOut className="w-3.5 h-3.5 text-blue-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-700 truncate">{s.person_name}</div>
                    <div className="text-xs text-gray-400">{s.time} • <span className="capitalize">{s.status}</span> • {s.method}{s.confidence_score ? ` • ${s.confidence_score}%` : ''}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
      </>
      )}
      </>
      )}
    </div>
  );
}