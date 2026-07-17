import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { PagePanel, PageTitle, KpButton, StatusBadge, Avatar, SearchInput, EmptyState } from '@/components/kp/ui';
import { Camera, QrCode, LogIn, LogOut, UserCheck, UserX, Clock, WifiOff, RefreshCw, BookOpen, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { logAudit, createNotification } from '@/lib/audit';

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="kp-panel rounded-xl p-3 shadow-sm flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}><Icon className="w-4 h-4 text-white" /></div>
      <div><div className="text-xl font-bold text-[hsl(var(--kp-teal))] leading-none">{value}</div><div className="text-xs text-gray-400 mt-0.5">{label}</div></div>
    </div>
  );
}

export default function AttendanceScanner() {
  const [scanning, setScanning] = useState(false);
  const [manualQR, setManualQR] = useState('');
  const [scanType, setScanType] = useState('time_in');
  const [autoDetect, setAutoDetect] = useState(true);
  const [recentScans, setRecentScans] = useState([]);
  const [allPeople, setAllPeople] = useState([]);
  const [search, setSearch] = useState('');
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [logbook, setLogbook] = useState([]);
  const [tab, setTab] = useState('scanner');
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const load = () => {
    Promise.all([
      base44.entities.Attendance.list('-created_date', 100),
      base44.entities.Student.list(),
      base44.entities.Employee.list(),
      base44.entities.GeneratedIDCard.list().catch(() => []),
    ]).then(([att, students, employees, idCards]) => {
      setLogbook(att);
      setRecentScans(att.slice(0, 8));
      setAllPeople([
        ...students.map(s => ({ ...s, type: 'student', name: `${s.first_name} ${s.last_name}`, person_id: s.id })),
        ...employees.map(e => ({ ...e, type: 'employee', name: `${e.first_name} ${e.last_name}`, person_id: e.id })),
      ]);
    }).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const startCamera = async () => {
    try {
      setScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setScanning(false);
      alert('Camera access denied. Use manual QR input instead.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setScanning(false);
  };

  useEffect(() => () => stopCamera(), []);

  const processScan = async (qrValue) => {
    setScanError(null);
    setScanResult(null);

    // 1. Identify the person
    const person = allPeople.find(p => p.qr_id === qrValue || p.lrn === qrValue || p.employee_id === qrValue || p.student_id === qrValue);
    if (!person) {
      setScanError(`Invalid QR code: "${qrValue}" — no matching person found.`);
      logAudit('qr_scan_failed', 'Attendance', '', `Invalid QR: ${qrValue}`);
      return;
    }

    // 2. Verify account status
    const isStudent = person.type === 'student';
    const accountInactive = isStudent
      ? (person.enrollment_status === 'archived' || person.enrollment_status === 'transferred')
      : (person.status === 'inactive');
    if (accountInactive) {
      setScanError(`${person.name} is ${isStudent ? person.enrollment_status : 'inactive'} and cannot check in.`);
      logAudit('qr_scan_blocked', 'Attendance', person.id, `${person.name} account inactive`);
      return;
    }

    // 3. Verify ID card status
    let activeCard = null;
    try {
      const cards = await base44.entities.GeneratedIDCard.filter({ person_id: person.id });
      if (cards.length > 0) {
        activeCard = cards.find(c => c.status === 'issued');
        if (!activeCard) {
          setScanError(`ID card for ${person.name} is ${cards[0].status}. Please contact administrator.`);
          logAudit('qr_scan_blocked', 'Attendance', person.id, `${person.name} ID card ${cards[0].status}`);
          return;
        }
        if (activeCard.expiry_date && new Date(activeCard.expiry_date) < new Date()) {
          setScanError(`ID card for ${person.name} has expired. Please generate a new ID.`);
          logAudit('qr_scan_blocked', 'Attendance', person.id, `${person.name} ID card expired`);
          return;
        }
      }
    } catch (e) { /* ID card check is optional */ }

    // 4. Determine Time In or Time Out (auto-detect)
    const today = new Date().toLocaleDateString('en-CA');
    const todaysScans = logbook.filter(a => a.person_id === person.id && a.date === today);
    const lastScan = todaysScans[todaysScans.length - 1];
    let detectedType = scanType;
    if (autoDetect) {
      detectedType = lastScan?.scan_type === 'time_in' ? 'time_out' : 'time_in';
    }

    // 5. Prevent duplicate scans
    if (detectedType === 'time_in' && lastScan?.scan_type === 'time_in') {
      setScanError(`${person.name} already checked in today at ${lastScan.time}. Use Time Out instead.`);
      return;
    }
    if (detectedType === 'time_out' && (!lastScan || lastScan.scan_type !== 'time_in')) {
      setScanError(`${person.name} has not checked in yet. Cannot check out.`);
      return;
    }

    // 6. Record date and time
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const isLate = detectedType === 'time_in' && now.getHours() >= 8 && now.getMinutes() >= 1;
    const insideStatus = detectedType === 'time_in' ? 'inside' : 'outside';

    // 7. Create attendance record
    const record = {
      person_id: person.id,
      person_name: person.name,
      person_type: person.type,
      scan_type: detectedType,
      status: detectedType === 'time_in' ? (isLate ? 'late' : 'present') : 'present',
      method: 'qr',
      date: today,
      time,
      grade: person.grade,
      section: person.section,
      inside_status: insideStatus,
      id_card_id: activeCard?.id || '',
      id_card_status: activeCard?.status || '',
    };

    try {
      await base44.entities.Attendance.create(record);

      // 8. Update inside/outside status on the person entity
      if (isStudent) {
        await base44.entities.Student.update(person.id, {
          inside_status: insideStatus,
          attendance_present: detectedType === 'time_in' && !isLate ? (person.attendance_present || 0) + 1 : person.attendance_present,
          attendance_late: detectedType === 'time_in' && isLate ? (person.attendance_late || 0) + 1 : person.attendance_late,
        });
      } else {
        await base44.entities.Employee.update(person.id, { inside_status: insideStatus });
      }

      // 9. Create parent notification for student scans
      if (isStudent && detectedType === 'time_in') {
        await createNotification(
          person.parent_name || 'Parent/Guardian',
          `${person.name} has arrived at school`,
          `Your child ${person.name} checked in at ${time} on ${today}. Status: ${isLate ? 'Late' : 'Present'}.`,
          'attendance',
          'Attendance',
          person.id
        );
      }

      // 10. Audit log
      await logAudit('qr_scan', 'Attendance', person.id, `${person.name} ${detectedType.replace('_', ' ')} at ${time} - ${record.status}`);

      // 11. Update UI
      setScanResult({ name: person.name, type: detectedType, time, status: record.status, insideStatus });
      setManualQR('');
      load();
    } catch (err) {
      setOfflineQueue([...offlineQueue, record]);
      setScanError('Network error — scan saved to offline queue.');
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualQR.trim()) return;
    processScan(manualQR.trim());
  };

  const handleManualAttendance = async (person, status) => {
    const now = new Date();
    const today = now.toLocaleDateString('en-CA');
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    await base44.entities.Attendance.create({
      person_id: person.id, person_name: person.name, person_type: person.type,
      scan_type: 'time_in', status, method: 'manual', date: today, time,
      grade: person.grade, section: person.section, inside_status: 'inside',
    });
    if (person.type === 'student') {
      await base44.entities.Student.update(person.id, {
        inside_status: 'inside',
        attendance_present: status === 'present' ? (person.attendance_present || 0) + 1 : person.attendance_present,
        attendance_absent: status === 'absent' ? (person.attendance_absent || 0) + 1 : person.attendance_absent,
        attendance_late: status === 'late' ? (person.attendance_late || 0) + 1 : person.attendance_late,
      });
    } else {
      await base44.entities.Employee.update(person.id, { inside_status: 'inside' });
    }
    logAudit('manual_attendance', 'Attendance', person.id, `${person.name} marked ${status}`);
    load();
  };

  const syncOffline = async () => {
    for (const record of offlineQueue) {
      await base44.entities.Attendance.create(record);
    }
    setOfflineQueue([]);
    load();
  };

  const today = new Date().toLocaleDateString('en-CA');
  const todaysAtt = logbook.filter(a => a.date === today);
  const present = todaysAtt.filter(a => a.status === 'present').length;
  const absent = todaysAtt.filter(a => a.status === 'absent').length;
  const late = todaysAtt.filter(a => a.status === 'late').length;
  const studentsIn = allPeople.filter(p => p.type === 'student' && p.inside_status === 'inside').length;
  const teachersIn = allPeople.filter(p => p.type === 'employee' && p.inside_status === 'inside').length;

  const filteredPeople = allPeople.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 10);
  const tabs = [
    { id: 'scanner', label: 'Scanner' },
    { id: 'manual', label: 'Manual' },
    { id: 'logbook', label: 'Logbook' },
  ];

  return (
    <div className="space-y-4">
      <PageTitle>Attendance Logs</PageTitle>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={UserCheck} label="Present Today" value={present} color="bg-[hsl(var(--kp-green))]" />
        <StatCard icon={UserX} label="Absent Today" value={absent} color="bg-[hsl(var(--kp-red))]" />
        <StatCard icon={Clock} label="Late Today" value={late} color="bg-[hsl(var(--kp-orange))]" />
        <StatCard icon={LogIn} label="Students Inside" value={studentsIn} color="bg-[hsl(var(--kp-teal))]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PagePanel className="lg:col-span-2">
          <div className="flex gap-1.5 mb-4">
            {tabs.map(t => (
              <button key={t.id} onClick={() => { if (t.id !== 'scanner') stopCamera(); setTab(t.id); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t.id ? 'bg-[hsl(var(--kp-teal))] text-white' : 'bg-gray-50 text-[hsl(var(--kp-teal))] hover:bg-gray-100'}`}>{t.label}</button>
            ))}
          </div>

          {tab === 'scanner' && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex gap-2">
                  <button onClick={() => setScanType('time_in')} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${scanType === 'time_in' ? 'bg-[hsl(var(--kp-green))] text-white' : 'bg-gray-50 text-gray-500'}`}><LogIn className="w-4 h-4" /> Time In</button>
                  <button onClick={() => setScanType('time_out')} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${scanType === 'time_out' ? 'bg-[hsl(var(--kp-teal))] text-white' : 'bg-gray-50 text-gray-500'}`}><LogOut className="w-4 h-4" /> Time Out</button>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={autoDetect} onChange={e => setAutoDetect(e.target.checked)} className="rounded border-gray-300" /> Auto-detect
                </label>
              </div>

              <div className="relative aspect-video max-w-md mx-auto rounded-2xl overflow-hidden bg-gray-900 mb-4">
                {scanning ? (
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                    <Camera className="w-12 h-12 mb-2" />
                    <p className="text-sm">Camera is off</p>
                  </div>
                )}
                {scanning && <div className="absolute inset-x-8 top-1/2 h-0.5 bg-[hsl(var(--kp-green))] animate-pulse" />}
                <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-black/50 text-white text-xs flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${scanning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                  {scanning ? 'Scanning...' : 'Idle'}
                </div>
              </div>

              <div className="flex justify-center gap-2 mb-4">
                {!scanning ? <KpButton variant="green" onClick={startCamera}><Camera className="w-4 h-4" /> Start Camera</KpButton>
                : <KpButton variant="danger" onClick={stopCamera}>Stop Camera</KpButton>}
              </div>

              {scanError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-600">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {scanError}
                </div>
              )}
              {scanResult && (
                <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 flex items-start gap-2 text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div><span className="font-medium">{scanResult.name}</span> checked {scanResult.type.replace('_', ' ')} at {scanResult.time}. Status: <span className="capitalize">{scanResult.status}</span>. Now {scanResult.insideStatus}.</div>
                </div>
              )}

              <form onSubmit={handleManualSubmit} className="max-w-md mx-auto">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={manualQR} onChange={e => setManualQR(e.target.value)} placeholder="Enter QR code manually..." className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
                  </div>
                  <KpButton type="submit" variant="teal">Scan</KpButton>
                </div>
              </form>

              {offlineQueue.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[hsl(var(--kp-orange))]"><WifiOff className="w-4 h-4" /><span className="text-sm font-medium">{offlineQueue.length} scans in offline queue</span></div>
                  <KpButton variant="outline" onClick={syncOffline}><RefreshCw className="w-4 h-4" /> Sync Now</KpButton>
                </div>
              )}
            </div>
          )}

          {tab === 'manual' && (
            <div>
              <p className="text-sm text-gray-500 mb-3">Manually mark attendance for students or employees.</p>
              <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search person..." className="mb-3" />
              <div className="space-y-2 max-h-80 overflow-y-auto kp-scroll-thin">
                {filteredPeople.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2"><Avatar name={p.name} src={p.photo_url} size="w-8 h-8" /><div><div className="text-sm font-medium text-gray-700">{p.name}</div><div className="text-xs text-gray-400 capitalize">{p.type} {p.grade && `• ${p.grade}`} {p.inside_status === 'inside' && '• Inside'}</div></div></div>
                    <div className="flex gap-1">
                      <button onClick={() => handleManualAttendance(p, 'present')} className="px-2.5 py-1 rounded-md bg-green-100 text-green-700 text-xs font-medium hover:bg-green-200">Present</button>
                      <button onClick={() => handleManualAttendance(p, 'absent')} className="px-2.5 py-1 rounded-md bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200">Absent</button>
                      <button onClick={() => handleManualAttendance(p, 'late')} className="px-2.5 py-1 rounded-md bg-orange-100 text-orange-700 text-xs font-medium hover:bg-orange-200">Late</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'logbook' && (
            <div className="overflow-x-auto">
              {logbook.length === 0 ? <EmptyState message="No attendance records" /> : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100 text-xs text-gray-400"><th className="text-left py-2 px-2 font-medium">Name</th><th className="text-left py-2 px-2 font-medium">Type</th><th className="text-left py-2 px-2 font-medium">Status</th><th className="text-left py-2 px-2 font-medium">Method</th><th className="text-right py-2 px-2 font-medium">Date/Time</th></tr></thead>
                  <tbody>
                    {logbook.map(a => (
                      <tr key={a.id} className="border-b border-gray-50">
                        <td className="py-2 px-2"><div className="flex items-center gap-2"><Avatar name={a.person_name} size="w-7 h-7" /><span className="font-medium text-gray-700">{a.person_name}</span></div></td>
                        <td className="py-2 px-2 text-gray-500 capitalize">{a.person_type}</td>
                        <td className="py-2 px-2"><StatusBadge status={a.status} /></td>
                        <td className="py-2 px-2 text-gray-500 capitalize">{a.method}</td>
                        <td className="py-2 px-2 text-right text-gray-500 text-xs">{a.date} {a.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </PagePanel>

        <PagePanel>
          <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Recent Scans</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto kp-scroll-thin">
            {recentScans.length === 0 ? <EmptyState message="No recent scans" /> : recentScans.map(s => (
              <div key={s.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.scan_type === 'time_in' ? 'bg-green-100' : 'bg-blue-100'}`}>
                  {s.scan_type === 'time_in' ? <LogIn className="w-4 h-4 text-green-600" /> : <LogOut className="w-4 h-4 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-700 truncate">{s.person_name}</div>
                  <div className="text-xs text-gray-400">{s.time} • <span className="capitalize">{s.status}</span></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Students Inside</span><span className="font-bold text-[hsl(var(--kp-green))]">{studentsIn}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Teachers Inside</span><span className="font-bold text-[hsl(var(--kp-teal))]">{teachersIn}</span></div>
          </div>
        </PagePanel>
      </div>
    </div>
  );
}