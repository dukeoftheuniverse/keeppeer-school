import React, { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import CameraViewfinder from '@/components/kp/CameraViewfinder';
import IronManHUD from '@/components/kp/IronManHUD';
import { Avatar } from '@/components/kp/ui';
import { logAudit, createNotification } from '@/lib/audit';
import {
  ScanFace, CheckCircle2, XCircle, Loader2, Pause, Play, AlertTriangle,
  LogIn, LogOut, UserCheck, Clock, Users, Users2, ShieldAlert,
  QrCode, Keyboard, Radio, Search
} from 'lucide-react';

const MAX_CANDIDATES = 8;
const FRAMES_PER_SCAN = 5;
const SCAN_INTERVAL = 1000; // auto-scan every 1s

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="kp-panel rounded-xl p-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}><Icon className="w-4 h-4 text-white" /></div>
      <div><div className="text-xl font-bold text-[hsl(var(--kp-teal))] leading-none">{value}</div><div className="text-xs text-gray-400 mt-0.5">{label}</div></div>
    </div>
  );
}

const METHODS = [
  { id: 'facial', label: 'Facial AI', icon: ScanFace },
  { id: 'qr', label: 'QR / Barcode', icon: QrCode },
  { id: 'manual', label: 'Manual', icon: Keyboard },
  { id: 'rfid', label: 'RFID', icon: Radio },
];

export default function AttendanceScanner() {
  const camRef = useRef(null);
  const phaseRef = useRef('idle');
  const scanRef = useRef(null);
  const [people, setPeople] = useState([]);
  const [logbook, setLogbook] = useState([]);
  const [phase, setPhase] = useState('idle'); // idle | scanning | success | fail
  const [results, setResults] = useState([]); // [{ok, person, confidence, type, time, status, insideStatus, unknown, error}]
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [method, setMethod] = useState('facial');
  const [codeInput, setCodeInput] = useState('');
  const [rfidInput, setRfidInput] = useState('');
  const [manualSearch, setManualSearch] = useState('');

  const load = async () => {
    try {
      const [students, employees, att] = await Promise.all([
        base44.entities.Student.list(),
        base44.entities.Employee.list(),
        base44.entities.Attendance.list('-created_date', 50),
      ]);
      setPeople([
        ...students.map(s => ({ ...s, type: 'student', name: `${s.first_name} ${s.last_name}`.trim(), person_id: s.id })),
        ...employees.map(e => ({ ...e, type: 'employee', name: `${e.first_name} ${e.last_name}`.trim(), person_id: e.id })),
      ]);
      setLogbook(att);
    } catch (e) { /* */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const withPhotos = useMemo(() => people.filter(p => !!p.photo_url), [people]);
  const peopleMap = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people]);
  const candidates = useMemo(() => withPhotos.slice(0, MAX_CANDIDATES), [withPhotos]);

  // Record attendance for one person; returns an outcome object without mutating UI state.
  const recordAttendance = async (person, confidence) => {
    const isStudent = person.type === 'student';
    const accountInactive = isStudent
      ? (person.enrollment_status === 'archived' || person.enrollment_status === 'transferred')
      : (person.status === 'inactive');
    if (accountInactive) return { ok: false, person, confidence, error: `${person.name} is ${isStudent ? person.enrollment_status : 'inactive'}.` };

    const today = new Date().toLocaleDateString('en-CA');
    const todays = logbook.filter(a => a.person_id === person.id && a.date === today);
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
        method: method, date: today, time, grade: person.grade, section: person.section,
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
      await logAudit(method === 'facial' ? 'facial_scan' : method + '_scan', 'Attendance', person.id, `${person.name} ${detectedType.replace('_', ' ')} at ${time}`);
      return { ok: true, person, confidence, type: detectedType, time, status: isLate ? 'late' : 'present', insideStatus };
    } catch (e) {
      return { ok: false, person, confidence, error: `Network error recording ${person.name}.` };
    }
  };

  // Log an unrecognized face as a security alert (foreign contaminant / possible intruder)
  const logUnknownFace = async (frameUrl, count, mixed) => {
    const ts = new Date().toLocaleString();
    try {
      await base44.entities.SecurityAlert.create({
        alertType: 'Unregistered Face Repeated',
        severity: mixed ? 'High' : 'Critical',
        location: 'Attendance Scanner',
        description: `Unknown / foreign contaminant person detected at ${ts}. ${count} unrecognized face(s) captured. Possible intruder — review frame. Frame: ${frameUrl}`,
        timestamp: new Date().toISOString(),
        status: 'Open',
      });
      await logAudit('security_alert', 'SecurityAlert', '', `Foreign contaminant person detected — ${count} unknown face(s). Frame saved.`);
    } catch (e) { /* */ }
  };

  const scanFace = async () => {
    setError(null);
    setResults([]);

    if (!camRef.current || !camRef.current.isStreaming()) { return; }
    if (candidates.length === 0) { setError('No facial specimens enrolled yet. Record faces on student/staff profiles first.'); return; }

    setPhase('scanning');
    // Capture up to 5 rapid frames for a single analysis pass
    const frameURLs = [];
    for (let i = 0; i < FRAMES_PER_SCAN; i++) {
      const d = camRef.current.capture();
      if (!d) break;
      frameURLs.push(d);
      await new Promise(r => setTimeout(r, 120));
    }
    if (frameURLs.length === 0) { setPhase('idle'); return; }

    try {
      const uploaded = [];
      for (let i = 0; i < frameURLs.length; i++) {
        const blob = await (await fetch(frameURLs[i])).blob();
        const file = new File([blob], `face-capture-${i}.jpg`, { type: 'image/jpeg' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploaded.push(file_url);
      }

      const galleryUrls = candidates.map(p => p.photo_url);
      const n = uploaded.length;
      const prompt = `You are a facial recognition assistant for a school attendance system.
Images #1 through #${n} are rapid captures of the same live scene (may contain ONE OR MORE people).
Images #${n + 1} through #${n + galleryUrls.length} are reference photos of enrolled people, in this exact order:
${candidates.map((p, i) => `#${n + i + 1} — ${p.name} (${p.type})`).join('\n')}

Identify every visible face in the capture images and match it to the best matching reference image (if any). Return a match for EACH distinct face detected.
- matched_index: 1-based index of the matching reference (1 = first reference, i.e. image #${n + 1}).
- confidence: 0–100. Only include matches with confidence >= 55. If a face has no good reference match, omit it from matches but count it in total_faces.
Respond ONLY as JSON: {"total_faces": number, "matches": [{"matched_index": number, "confidence": number}], "reason": string}`;

      const llm = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: [...uploaded, ...galleryUrls],
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
      const valid = matches.filter(m => m.matched_index != null && m.matched_index >= 1 && m.matched_index <= candidates.length && Number(m.confidence) >= 55);
      const totalFaces = Number(llm?.total_faces) || 0;
      const unknownCount = Math.max(0, totalFaces - valid.length);

      if (unknownCount > 0) await logUnknownFace(uploaded[0], unknownCount, valid.length > 0);

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
        outcomes.push(await recordAttendance(person, conf));
      }
      if (unknownCount > 0) {
        outcomes.push({ ok: false, person: null, unknown: true, error: `${unknownCount} unknown / foreign contaminant person(s) detected — logged as possible intruder.` });
      }
      setResults(outcomes);
      setPhase(outcomes.some(o => o.ok) ? 'success' : 'fail');
      load();
    } catch (e) {
      setError('AI identification failed: ' + (e?.message || 'unexpected error') + '.');
      setPhase('fail');
    }
  };

  scanRef.current = scanFace;

  // Auto-scan loop — only in facial mode
  useEffect(() => {
    if (paused || method !== 'facial') return;
    const first = setTimeout(() => { if (phaseRef.current === 'idle' && camRef.current?.isStreaming()) scanRef.current(); }, 1500);
    const id = setInterval(() => { if (phaseRef.current === 'idle' && camRef.current?.isStreaming()) scanRef.current(); }, SCAN_INTERVAL);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [paused, method]);

  // Auto-reset to idle after a result so the next interval fires
  useEffect(() => {
    if (phase === 'success' || phase === 'fail') {
      const t = setTimeout(() => setPhase('idle'), 2500);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // QR / RFID lookup
  const findPersonByCode = (code) => {
    const v = String(code).trim().toLowerCase();
    if (!v) return null;
    return people.find(p => [p.student_id, p.employee_id, p.lrn, p.id].filter(Boolean).map(x => String(x).toLowerCase()).includes(v));
  };

  const handleCodeScan = async (code) => {
    setError(null); setResults([]);
    const person = findPersonByCode(code);
    if (!person) {
      setResults([{ ok: false, person: null, error: `No profile matches "${code}".` }]);
      return;
    }
    setResults([await recordAttendance(person, 100)]);
    setCodeInput(''); setRfidInput('');
    load();
  };

  const today = new Date().toLocaleDateString('en-CA');
  const todays = logbook.filter(a => a.date === today);
  const present = todays.filter(a => a.status === 'present').length;
  const late = todays.filter(a => a.status === 'late').length;
  const inside = people.filter(p => p.inside_status === 'inside').length;
  const okCount = results.filter(r => r.ok).length;
  const unknownCount = results.filter(r => r.unknown).length;

  const manualList = manualSearch.trim()
    ? people.filter(p => `${p.name} ${p.student_id || ''} ${p.employee_id || ''} ${p.lrn || ''}`.toLowerCase().includes(manualSearch.toLowerCase()))
    : people;

  const renderResults = () => results.length === 0 ? null : (
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
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ScanFace className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
        <h1 className="text-xl sm:text-2xl font-bold text-[hsl(var(--kp-teal))]">Attendance</h1>
        <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-semibold flex items-center gap-1"><Users2 className="w-3 h-3" /> AUTO · MULTI-FACE AI</span>
      </div>

      {/* Method tabs */}
      <div className="flex flex-wrap gap-2">
        {METHODS.map(m => (
          <button key={m.id} onClick={() => { setMethod(m.id); setResults([]); setError(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${method === m.id ? 'bg-[hsl(var(--kp-teal))] text-white shadow' : 'bg-white text-[hsl(var(--kp-teal))] border border-gray-200 hover:bg-gray-50'}`}>
            <m.icon className="w-4 h-4" /> {m.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={UserCheck} label="Present Today" value={present} color="bg-[hsl(var(--kp-green))]" />
        <StatCard icon={Clock} label="Late Today" value={late} color="bg-[hsl(var(--kp-orange))]" />
        <StatCard icon={Users} label="Inside Now" value={inside} color="bg-[hsl(var(--kp-teal))]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Scanner / input panel */}
        <div className="kp-panel rounded-2xl p-4 sm:p-6 lg:col-span-2">
          {method === 'facial' && (
            <>
              <p className="text-sm text-gray-500 mb-3">The camera is on automatically. It scans every second — point it at one or more people. Each pass captures up to {FRAMES_PER_SCAN} frames; enrolled faces are logged with time tracking; unknown faces are flagged as foreign contaminant / possible intruder.</p>

              <div className="mb-4">
                <CameraViewfinder
                  ref={camRef}
                  active
                  facingMode="user"
                  overlay={<IronManHUD phase={phase} unknown={unknownCount > 0} okCount={okCount} />}
                >
                </CameraViewfinder>
              </div>

              {error && (
                <div className="mb-3 p-3 rounded-lg bg-orange-50 border border-orange-200 flex items-start gap-2 text-sm text-orange-700">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                </div>
              )}

              {renderResults()}

              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-gray-500 flex items-center gap-1.5">
                  {paused ? <><Pause className="w-3.5 h-3.5" /> Auto-scan paused</> : <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Auto-scanning every {SCAN_INTERVAL / 1000}s · {FRAMES_PER_SCAN} frames/pass</>}
                </div>
                <button onClick={() => setPaused(p => !p)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 ${paused ? 'bg-[hsl(var(--kp-green))] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {paused ? <><Play className="w-4 h-4" /> Resume</> : <><Pause className="w-4 h-4" /> Pause</>}
                </button>
              </div>
            </>
          )}

          {method === 'qr' && (
            <>
              <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-1 flex items-center gap-2"><QrCode className="w-4 h-4" /> QR / Barcode Scan</h3>
              <p className="text-sm text-gray-500 mb-4">Scan a student or staff ID card. A USB barcode/QR scanner types into the field and pressing Enter records attendance.</p>
              <div className="flex gap-2 mb-4">
                <input autoFocus value={codeInput} onChange={e => setCodeInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && codeInput.trim()) handleCodeScan(codeInput); }}
                  placeholder="Scan or type QR/barcode value..."
                  className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
                <button onClick={() => codeInput.trim() && handleCodeScan(codeInput)}
                  className="px-5 py-2.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-semibold hover:brightness-105">Record</button>
              </div>
              {renderResults()}
            </>
          )}

          {method === 'rfid' && (
            <>
              <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-1 flex items-center gap-2"><Radio className="w-4 h-4" /> RFID Tap</h3>
              <p className="text-sm text-gray-500 mb-4">Tap an RFID card or type its UID. The system matches it to an enrolled profile (by Student ID, Employee ID, or LRN) and records time in/out.</p>
              <div className="flex gap-2 mb-4">
                <input autoFocus value={rfidInput} onChange={e => setRfidInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && rfidInput.trim()) handleCodeScan(rfidInput); }}
                  placeholder="RFID UID..."
                  className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
                <button onClick={() => rfidInput.trim() && handleCodeScan(rfidInput)}
                  className="px-5 py-2.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-semibold hover:brightness-105">Record</button>
              </div>
              {renderResults()}
            </>
          )}

          {method === 'manual' && (
            <>
              <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-1 flex items-center gap-2"><Keyboard className="w-4 h-4" /> Manual Lookup</h3>
              <p className="text-sm text-gray-500 mb-4">Search for a student or staff member and tap their name to record time in/out.</p>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={manualSearch} onChange={e => setManualSearch(e.target.value)} placeholder="Search name, ID, LRN..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto kp-scroll-thin">
                {manualList.slice(0, 40).map(p => (
                  <button key={p.id} onClick={async () => { setResults([await recordAttendance(p, 100)]); load(); }}
                    className="flex items-center gap-2.5 p-2 rounded-lg border border-gray-100 hover:bg-gray-50 text-left">
                    <Avatar name={p.name} src={p.photo_url} size="w-9 h-9" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-700 truncate">{p.name}</div>
                      <div className="text-xs text-gray-400 capitalize">{p.type} • {p.student_id || p.employee_id || p.lrn || '—'}</div>
                    </div>
                    <LogIn className="w-4 h-4 text-gray-300" />
                  </button>
                ))}
                {manualList.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No matching people.</p>}
              </div>
              {renderResults()}
            </>
          )}
        </div>

        {/* Recent scans */}
        <div className="kp-panel rounded-2xl p-4 sm:p-6">
          <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><Clock className="w-4 h-4" /> Recent Scans</h3>
          <div className="space-y-2 max-h-[32rem] overflow-y-auto kp-scroll-thin">
            {logbook.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No attendance records yet.</p> :
              logbook.map(s => (
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
    </div>
  );
}