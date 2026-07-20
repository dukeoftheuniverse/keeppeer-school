import React, { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import CameraViewfinder from '@/components/kp/CameraViewfinder';
import { Avatar } from '@/components/kp/ui';
import { logAudit, createNotification } from '@/lib/audit';
import {
  ScanFace, Search, CheckCircle2, XCircle, Loader2, RefreshCw, AlertTriangle,
  LogIn, LogOut, UserCheck, Clock, Users, Frown
} from 'lucide-react';

const MAX_CANDIDATES = 8;

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
  const [people, setPeople] = useState([]);
  const [logbook, setLogbook] = useState([]);
  const [search, setSearch] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | scanning | success | fail
  const [result, setResult] = useState(null); // { person, confidence, reason }
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

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

  // People who have a reference photo — these are the only ones AI can identify.
  const withPhotos = useMemo(() => people.filter(p => !!p.photo_url), [people]);

  // Candidate gallery: narrowed by search, capped at MAX_CANDIDATES.
  const candidates = useMemo(() => {
    const base = search.trim()
      ? withPhotos.filter(p => `${p.name} ${p.lrn || ''} ${p.student_id || ''} ${p.employee_id || ''}`.toLowerCase().includes(search.toLowerCase()))
      : withPhotos;
    return base.slice(0, MAX_CANDIDATES);
  }, [withPhotos, search]);

  const recordAttendance = async (person, confidence) => {
    const isStudent = person.type === 'student';
    const accountInactive = isStudent
      ? (person.enrollment_status === 'archived' || person.enrollment_status === 'transferred')
      : (person.status === 'inactive');
    if (accountInactive) {
      setError(`${person.name} is ${isStudent ? person.enrollment_status : 'inactive'} and cannot check in.`);
      return false;
    }

    const today = new Date().toLocaleDateString('en-CA');
    const todays = logbook.filter(a => a.person_id === person.id && a.date === today);
    const last = todays[todays.length - 1];
    const detectedType = last?.scan_type === 'time_in' ? 'time_out' : 'time_in';

    if (detectedType === 'time_in' && last?.scan_type === 'time_in') {
      setError(`${person.name} already checked in today at ${last.time}. Use Time Out instead.`);
      return false;
    }
    if (detectedType === 'time_out' && (!last || last.scan_type !== 'time_in')) {
      setError(`${person.name} has not checked in yet. Cannot check out.`);
      return false;
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
      setResult({ person, confidence, type: detectedType, time, status: isLate ? 'late' : 'present', insideStatus });
      load();
      return true;
    } catch (e) {
      setError('Network error — could not record attendance. Please retry.');
      return false;
    }
  };

  const scanFace = async () => {
    setError(null);
    setResult(null);

    if (!camRef.current || !camRef.current.isStreaming()) {
      setError('Please turn on the camera first.');
      return;
    }
    if (candidates.length === 0) {
      setError('No reference photos available. Add profile photos to students/staff to enable AI identification.');
      return;
    }

    setPhase('scanning');

    // 1. Capture a frame from the live camera
    const dataURL = camRef.current.capture();
    if (!dataURL) { setError('Could not capture a frame. Please retry.'); setPhase('fail'); return; }

    try {
      // 2. Upload the captured frame
      const blob = await (await fetch(dataURL)).blob();
      const file = new File([blob], 'face-capture.jpg', { type: 'image/jpeg' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // 3. Ask the vision model to match the face against the candidate gallery
      const galleryUrls = candidates.map(p => p.photo_url);
      const prompt = `You are a facial recognition assistant for a school attendance system.
Image #1 is a live camera capture of a person at the entrance.
Images #2 through #${galleryUrls.length + 1} are reference photos of enrolled people, provided in this exact order:
${candidates.map((p, i) => `#${i + 2} — ${p.name} (${p.type})`).join('\n')}

Compare the face in image #1 to each reference image.
- If there is a clear match (same person), return matched_index = the 1-based index of the matching reference (1 = first reference, i.e. image #2) and a confidence score 0–100.
- If the face is blurry, occluded, or no reference matches well, return matched_index = null and a low confidence.
Respond ONLY as JSON: {"matched_index": number|null, "confidence": number, "reason": string}`;

      const llm = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: [file_url, ...galleryUrls],
        response_json_schema: {
          type: 'object',
          properties: {
            matched_index: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
            confidence: { type: 'number' },
            reason: { type: 'string' },
          },
        },
      });

      const matched = llm?.matched_index;
      const confidence = Math.round(Number(llm?.confidence) || 0);

      if (matched == null || matched < 1 || matched > candidates.length || confidence < 55) {
        setResult({ person: null, confidence, reason: llm?.reason || 'No confident match' });
        setPhase('fail');
        await logAudit('facial_scan_failed', 'Attendance', '', `No match (confidence ${confidence}%): ${llm?.reason || ''}`);
        return;
      }

      const person = candidates[matched - 1];
      const ok = await recordAttendance(person, confidence);
      setPhase(ok ? 'success' : 'fail');
    } catch (e) {
      setError('AI identification failed: ' + (e?.message || 'unexpected error') + '. Please retry.');
      setPhase('fail');
    }
  };

  const reset = () => { setPhase('idle'); setResult(null); setError(null); };

  const today = new Date().toLocaleDateString('en-CA');
  const todays = logbook.filter(a => a.date === today);
  const present = todays.filter(a => a.status === 'present').length;
  const late = todays.filter(a => a.status === 'late').length;
  const inside = people.filter(p => p.inside_status === 'inside').length;

  const frameColor = phase === 'scanning' ? 'border-yellow-400 animate-pulse'
    : phase === 'success' ? 'border-green-400' : phase === 'fail' ? 'border-red-400' : 'border-white/70';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ScanFace className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
        <h1 className="text-xl sm:text-2xl font-bold text-[hsl(var(--kp-teal))]">Attendance</h1>
        <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-semibold">AI FACIAL ID</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={UserCheck} label="Present Today" value={present} color="bg-[hsl(var(--kp-green))]" />
        <StatCard icon={Clock} label="Late Today" value={late} color="bg-[hsl(var(--kp-orange))]" />
        <StatCard icon={Users} label="Inside Now" value={inside} color="bg-[hsl(var(--kp-teal))]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Scanner */}
        <div className="kp-panel rounded-2xl p-4 sm:p-6 lg:col-span-2">
          <p className="text-sm text-gray-500 mb-3">Turn on the camera and tap <strong>Scan Face</strong>. The AI identifies the person by matching their face against enrolled profile photos and records attendance.</p>

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
                    <p className="text-sm font-medium">AI identifying face...</p>
                  </div>
                )}
                {phase === 'success' && (
                  <div>
                    <CheckCircle2 className="w-14 h-14 mx-auto mb-1 text-green-400 drop-shadow" />
                    <p className="text-green-400 font-bold text-base drop-shadow">Identified</p>
                  </div>
                )}
                {phase === 'fail' && (
                  <div>
                    <Frown className="w-14 h-14 mx-auto mb-1 text-red-400 drop-shadow" />
                    <p className="text-red-400 font-bold text-base drop-shadow">Not Recognized</p>
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

          {result?.person && (
            <div className="mb-3 p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-3 text-sm text-green-700">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <span className="font-medium">{result.person.name}</span> identified at {result.confidence}% confidence. Checked {result.type.replace('_', ' ')} at {result.time}. Now {result.insideStatus}.
              </div>
            </div>
          )}
          {result && !result.person && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-700">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-medium">No match found</span> ({result.confidence}%). {result.reason}
                <p className="mt-1 text-xs">Tip: narrow the search below, or make sure profile photos are added for this person.</p>
              </div>
            </div>
          )}

          {/* Search to narrow candidate gallery */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search to narrow candidates (optional)..."
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
          </div>
          <div className="text-xs text-gray-500 mb-3">
            {withPhotos.length} people have reference photos. AI will compare against the top {candidates.length} {search.trim() ? 'matching' : 'available'}:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto kp-scroll-thin mb-4">
            {candidates.map(p => (
              <div key={p.id} className="flex flex-col items-center p-2 rounded-lg border border-gray-100 bg-white/50">
                <Avatar name={p.name} src={p.photo_url} size="w-12 h-12" />
                <div className="text-xs font-medium text-gray-700 text-center mt-1 truncate w-full">{p.name}</div>
                <div className="text-[10px] text-gray-400 capitalize">{p.type}</div>
              </div>
            ))}
            {candidates.length === 0 && (
              <p className="text-sm text-gray-400 col-span-full text-center py-4">No reference photos. Add profile photos to people first.</p>
            )}
          </div>

          {phase !== 'success' && (
            <button onClick={scanFace} disabled={phase === 'scanning' || candidates.length === 0}
              className="w-full py-3 rounded-xl bg-[hsl(var(--kp-teal))] text-white font-bold text-sm hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-2">
              {phase === 'scanning' ? <Loader2 className="w-5 h-5 animate-spin" /> : <ScanFace className="w-5 h-5" />}
              {phase === 'scanning' ? 'Identifying...' : 'Scan Face'}
            </button>
          )}
          {phase === 'success' && (
            <button onClick={reset} className="w-full py-3 rounded-xl border border-[hsl(var(--kp-teal))] text-[hsl(var(--kp-teal))] font-bold text-sm hover:bg-[hsl(var(--kp-teal))]/10 flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5" /> Scan Another
            </button>
          )}
          {phase === 'fail' && (
            <button onClick={reset} className="w-full py-3 rounded-xl bg-[hsl(var(--kp-teal))] text-white font-bold text-sm hover:brightness-105 flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5" /> Try Again
            </button>
          )}
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