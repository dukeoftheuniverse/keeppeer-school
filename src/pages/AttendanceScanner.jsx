import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import CameraViewfinder from '@/components/kp/CameraViewfinder';
import { Avatar } from '@/components/kp/ui';
import { logAudit, createNotification } from '@/lib/audit';
import {
  ScanFace, Search, CheckCircle2, XCircle, Loader2, RefreshCw, AlertTriangle,
  LogIn, LogOut, UserCheck, Clock, Users
} from 'lucide-react';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="kp-panel rounded-xl p-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}><Icon className="w-4 h-4 text-white" /></div>
      <div><div className="text-xl font-bold text-[hsl(var(--kp-teal))] leading-none">{value}</div><div className="text-xs text-gray-400 mt-0.5">{label}</div></div>
    </div>
  );
}

export default function AttendanceScanner() {
  const [people, setPeople] = useState([]);
  const [logbook, setLogbook] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | scanning | success | fail
  const [result, setResult] = useState(null);
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

  const filtered = useMemo(() =>
    people.filter(p =>
      `${p.name} ${p.lrn || ''} ${p.student_id || ''} ${p.employee_id || ''}`.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 12),
    [people, search]
  );

  const record = async (person, confidence) => {
    setError(null);
    setResult(null);
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
      setResult({ name: person.name, type: detectedType, time, status: isLate ? 'late' : 'present', insideStatus, confidence });
      load();
      return true;
    } catch (e) {
      setError('Network error — could not record attendance. Please retry.');
      return false;
    }
  };

  const verify = async () => {
    if (!selected) { setError('Please select a person first.'); return; }
    setError(null);
    setPhase('scanning');
    setResult(null);
    await sleep(2200);
    const confidence = 92 + Math.floor(Math.random() * 7);
    const ok = await record(selected, confidence);
    setPhase(ok ? 'success' : 'fail');
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
        <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-semibold">SIMULATED</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={UserCheck} label="Present Today" value={present} color="bg-[hsl(var(--kp-green))]" />
        <StatCard icon={Clock} label="Late Today" value={late} color="bg-[hsl(var(--kp-orange))]" />
        <StatCard icon={Users} label="Inside Now" value={inside} color="bg-[hsl(var(--kp-teal))]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Scanner */}
        <div className="kp-panel rounded-2xl p-4 sm:p-6 lg:col-span-2">
          <p className="text-sm text-gray-500 mb-3">Turn on the camera, select the person, then verify their face to record attendance.</p>

          {/* Live camera */}
          <div className="mb-4">
            <CameraViewfinder
              active={phase !== 'success' && phase !== 'fail'}
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
                    <p className="text-sm font-medium">Verifying face...</p>
                  </div>
                )}
                {phase === 'success' && (
                  <div>
                    <CheckCircle2 className="w-14 h-14 mx-auto mb-1 text-green-400 drop-shadow" />
                    <p className="text-green-400 font-bold text-base drop-shadow">Verified</p>
                  </div>
                )}
                {phase === 'fail' && (
                  <div>
                    <XCircle className="w-14 h-14 mx-auto mb-1 text-red-400 drop-shadow" />
                    <p className="text-red-400 font-bold text-base drop-shadow">Failed</p>
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

          {result && (
            <div className="mb-3 p-3 rounded-lg bg-green-50 border border-green-200 flex items-start gap-2 text-sm text-green-700">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div><span className="font-medium">{result.name}</span> checked {result.type.replace('_', ' ')} at {result.time}. Status: <span className="capitalize">{result.status}</span>. Now {result.insideStatus}. ({result.confidence}%)</div>
            </div>
          )}

          {/* Selected person */}
          {selected && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[hsl(var(--kp-teal))]/10 border border-[hsl(var(--kp-teal))]/30 mb-3">
              <Avatar name={selected.name} src={selected.photo_url} size="w-10 h-10" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-[hsl(var(--kp-teal))] truncate">{selected.name}</div>
                <div className="text-xs text-gray-500 capitalize truncate">{selected.type} {selected.grade ? `• Grade ${selected.grade} - ${selected.section || ''}` : ''} {selected.inside_status === 'inside' ? '• Inside' : ''}</div>
              </div>
              <button onClick={() => { setSelected(null); reset(); }} disabled={phase === 'scanning'} className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50">Clear</button>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, LRN, or ID..."
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto kp-scroll-thin mb-4">
            {loading ? <p className="text-sm text-gray-400 text-center py-4 col-span-2">Loading people...</p> :
             filtered.length === 0 ? <p className="text-sm text-gray-400 text-center py-4 col-span-2">No people found.</p> :
             filtered.map(p => (
              <button key={p.id} onClick={() => setSelected(p)} disabled={phase === 'scanning'}
                className={`flex items-center gap-2.5 p-2.5 rounded-lg border-2 text-left transition-all disabled:opacity-50 ${selected?.id === p.id ? 'border-[hsl(var(--kp-teal))] bg-[hsl(var(--kp-teal))]/10' : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'}`}>
                <Avatar name={p.name} src={p.photo_url} size="w-9 h-9" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-700 truncate">{p.name}</div>
                  <div className="text-xs text-gray-400 capitalize truncate">{p.type} {p.lrn ? `• ${p.lrn}` : p.student_id ? `• ${p.student_id}` : ''}</div>
                </div>
                {selected?.id === p.id && <CheckCircle2 className="w-4 h-4 text-[hsl(var(--kp-teal))] shrink-0" />}
              </button>
            ))}
          </div>

          {phase !== 'success' && phase !== 'fail' && (
            <button onClick={verify} disabled={phase === 'scanning' || !selected}
              className="w-full py-3 rounded-xl bg-[hsl(var(--kp-teal))] text-white font-bold text-sm hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-2">
              {phase === 'scanning' ? <Loader2 className="w-5 h-5 animate-spin" /> : <ScanFace className="w-5 h-5" />}
              {phase === 'scanning' ? 'Verifying...' : 'Verify Face & Record Attendance'}
            </button>
          )}
          {(phase === 'success' || phase === 'fail') && (
            <button onClick={reset} className="w-full py-3 rounded-xl border border-[hsl(var(--kp-teal))] text-[hsl(var(--kp-teal))] font-bold text-sm hover:bg-[hsl(var(--kp-teal))]/10 flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5" /> Scan Another
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
                    <div className="text-xs text-gray-400">{s.time} • <span className="capitalize">{s.status}</span> • {s.method}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}