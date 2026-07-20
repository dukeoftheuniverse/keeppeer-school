import React, { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import CameraViewfinder from '@/components/kp/CameraViewfinder';
import { Avatar } from '@/components/kp/ui';
import { logAudit, createNotification } from '@/lib/audit';
import {
  ScanFace, CheckCircle2, XCircle, Loader2, Pause, Play, AlertTriangle,
  LogIn, LogOut, UserCheck, Clock, Users, Frown, Users2, ShieldAlert
} from 'lucide-react';

const MAX_CANDIDATES = 8;
const SCAN_INTERVAL = 6000; // auto-scan every 6s

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
  const [search, setSearch] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | scanning | success | fail
  const [results, setResults] = useState([]); // [{ok, person, confidence, type, time, status, insideStatus, unknown, error}]
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);

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

  const candidates = useMemo(() => {
    const base = search.trim()
      ? withPhotos.filter(p => `${p.name} ${p.lrn || ''} ${p.student_id || ''} ${p.employee_id || ''}`.toLowerCase().includes(search.toLowerCase()))
      : withPhotos;
    return base.slice(0, MAX_CANDIDATES);
  }, [withPhotos, search]);

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
        method: 'facial', date: today, time, grade: person.grade, section: person.section,
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
            `Your child ${person.name} checked in at ${time} on ${today} via facial recognition. Status: ${isLate ? 'Late' : 'Present'}.`,
            'attendance', 'Attendance', person.id
          );
        }
      } else {
        await base44.entities.Employee.update(person.id, { inside_status: insideStatus });
      }
      await logAudit('facial_scan', 'Attendance', person.id, `${person.name} ${detectedType.replace('_', ' ')} at ${time} - ${confidence}%`);
      return { ok: true, person, confidence, type: detectedType, time, status: isLate ? 'late' : 'present', insideStatus };
    } catch (e) {
      return { ok: false, person, confidence, error: `Network error recording ${person.name}.` };
    }
  };

  // Log an unrecognized face as a security alert (foreign contaminant / possible intruder)
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

    if (!camRef.current || !camRef.current.isStreaming()) { return; }
    if (candidates.length === 0) { setError('No facial specimens enrolled yet. Record faces on student/staff profiles first.'); return; }

    setPhase('scanning');
    const dataURL = camRef.current.capture();
    if (!dataURL) { setPhase('idle'); return; }

    try {
      const blob = await (await fetch(dataURL)).blob();
      const file = new File([blob], 'face-capture.jpg', { type: 'image/jpeg' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const galleryUrls = candidates.map(p => p.photo_url);
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
      const valid = matches.filter(m => m.matched_index != null && m.matched_index >= 1 && m.matched_index <= candidates.length && Number(m.confidence) >= 55);
      const totalFaces = Number(llm?.total_faces) || 0;
      const unknownCount = Math.max(0, totalFaces - valid.length);

      // Unknown / foreign faces → log security alert regardless
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

  // Auto-scan loop — no button needed
  useEffect(() => {
    if (paused) return;
    const first = setTimeout(() => { if (phaseRef.current === 'idle' && camRef.current?.isStreaming()) scanRef.current(); }, 4000);
    const id = setInterval(() => { if (phaseRef.current === 'idle' && camRef.current?.isStreaming()) scanRef.current(); }, SCAN_INTERVAL);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [paused]);

  // Auto-reset to idle after a result so the next interval fires
  useEffect(() => {
    if (phase === 'success' || phase === 'fail') {
      const t = setTimeout(() => setPhase('idle'), 3500);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const today = new Date().toLocaleDateString('en-CA');
  const todays = logbook.filter(a => a.date === today);
  const present = todays.filter(a => a.status === 'present').length;
  const late = todays.filter(a => a.status === 'late').length;
  const inside = people.filter(p => p.inside_status === 'inside').length;
  const okCount = results.filter(r => r.ok).length;
  const unknownCount = results.filter(r => r.unknown).length;

  const frameColor = phase === 'scanning' ? 'border-yellow-400 animate-pulse'
    : phase === 'success' ? 'border-green-400' : phase === 'fail' ? (unknownCount > 0 ? 'border-red-500' : 'border-red-400') : 'border-white/70';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ScanFace className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
        <h1 className="text-xl sm:text-2xl font-bold text-[hsl(var(--kp-teal))]">Attendance</h1>
        <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-semibold flex items-center gap-1"><Users2 className="w-3 h-3" /> AUTO · MULTI-FACE AI</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={UserCheck} label="Present Today" value={present} color="bg-[hsl(var(--kp-green))]" />
        <StatCard icon={Clock} label="Late Today" value={late} color="bg-[hsl(var(--kp-orange))]" />
        <StatCard icon={Users} label="Inside Now" value={inside} color="bg-[hsl(var(--kp-teal))]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Scanner */}
        <div className="kp-panel rounded-2xl p-4 sm:p-6 lg:col-span-2">
          <p className="text-sm text-gray-500 mb-3">The camera is on automatically. It scans every few seconds — point it at one or more people. Enrolled faces are logged with time tracking; unknown faces are flagged as foreign contaminant / possible intruder and recorded for security review.</p>

          <div className="mb-4">
            <CameraViewfinder
              ref={camRef}
              active
              facingMode="user"
              overlay={
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`w-44 h-60 sm:w-52 sm:h-72 border-4 rounded-[50%] transition-all ${frameColor}`} />
                </div>
              }
            >
              <div className="text-center pointer-events-none">
                {phase === 'scanning' && (
                  <div className="text-white drop-shadow">
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                    <p className="text-sm font-medium">Identifying faces...</p>
                  </div>
                )}
                {phase === 'success' && (
                  <div>
                    <CheckCircle2 className="w-14 h-14 mx-auto mb-1 text-green-400 drop-shadow" />
                    <p className="text-green-400 font-bold text-base drop-shadow">{okCount} Recorded</p>
                  </div>
                )}
                {phase === 'fail' && (
                  <div>
                    {unknownCount > 0 ? <ShieldAlert className="w-14 h-14 mx-auto mb-1 text-red-500 drop-shadow" /> : <Frown className="w-14 h-14 mx-auto mb-1 text-red-400 drop-shadow" />}
                    <p className="text-red-400 font-bold text-base drop-shadow">{unknownCount > 0 ? 'Intruder Logged' : 'Not Recognized'}</p>
                  </div>
                )}
              </div>
            </CameraViewfinder>
          </div>

          {error && (
            <div className="mb-3 p-3 rounded-lg bg-orange-50 border border-orange-200 flex items-start gap-2 text-sm text-orange-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {/* Results — one card per recognized/failed/unknown person */}
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

          {/* Pause / resume auto-scan */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-xs text-gray-500 flex items-center gap-1.5">
              {paused ? <><Pause className="w-3.5 h-3.5" /> Auto-scan paused</> : <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Auto-scanning every {SCAN_INTERVAL / 1000}s</>}
            </div>
            <button onClick={() => setPaused(p => !p)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 ${paused ? 'bg-[hsl(var(--kp-green))] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {paused ? <><Play className="w-4 h-4" /> Resume</> : <><Pause className="w-4 h-4" /> Pause</>}
            </button>
          </div>

          {/* Search to narrow candidate gallery */}
          <div className="relative mb-2">
            <ScanFace className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Narrow candidates (optional)..."
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
          </div>
          <div className="text-xs text-gray-500 mb-3">
            {withPhotos.length} people have facial specimens. AI compares against the top {candidates.length} {search.trim() ? 'matching' : 'available'}:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto kp-scroll-thin">
            {candidates.map(p => (
              <div key={p.id} className="flex flex-col items-center p-2 rounded-lg border border-gray-100 bg-white/50">
                <Avatar name={p.name} src={p.photo_url} size="w-12 h-12" />
                <div className="text-xs font-medium text-gray-700 text-center mt-1 truncate w-full">{p.name}</div>
                <div className="text-[10px] text-gray-400 capitalize">{p.type}</div>
              </div>
            ))}
            {candidates.length === 0 && (
              <p className="text-sm text-gray-400 col-span-full text-center py-4">No facial specimens yet. Record faces on profiles first.</p>
            )}
          </div>
        </div>

        {/* Recent scans */}
        <div className="kp-panel rounded-2xl p-4 sm:p-6">
          <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><Clock className="w-4 h-4" /> Recent Scans</h3>
          <div className="space-y-2 max-h-[28rem] overflow-y-auto kp-scroll-thin">
            {logbook.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No attendance records yet.</p> :
              logbook.map(s => (
                <div key={s.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.scan_type === 'time_in' ? 'bg-green-100' : 'bg-blue-100'}`}>
                    {s.scan_type === 'time_in' ? <LogIn className="w-4 h-4 text-green-600" /> : <LogOut className="w-4 h-4 text-blue-600" />}
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