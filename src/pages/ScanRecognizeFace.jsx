import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import CameraViewfinder from '@/components/kp/CameraViewfinder';
import {
  ScanFace, Loader2, CheckCircle2, XCircle, Scan, Search, Fingerprint,
  Keyboard, AlertTriangle, RefreshCw, Clock, UserCheck, Camera, QrCode
} from 'lucide-react';

function genId(prefix) { return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9999)}`; }
function nowISO() { return new Date().toISOString(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export default function ScanRecognizeFace() {
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [idInput, setIdInput] = useState('');
  const [mode, setMode] = useState('select'); // 'select' | 'id'
  const [phase, setPhase] = useState('idle'); // idle | scanning | success | fail
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.FaceEnrollment.filter({ recognitionStatus: 'Active', accountStatus: 'Active' })
      .then(setEnrollments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cameraActive = phase === 'idle' || phase === 'scanning';

  const filtered = enrollments.filter(e =>
    `${e.fullName} ${e.idNumber} ${e.personType}`.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 12);

  const verifyById = () => {
    const found = enrollments.find(e =>
      (e.idNumber || '').toLowerCase() === idInput.trim().toLowerCase()
    );
    if (!found) { setResult({ success: false, reason: 'ID number not found in registered faces' }); setPhase('fail'); return; }
    setSelectedPerson(found);
  };

  const startScan = async () => {
    if (!selectedPerson) { alert('Please select a person or enter a valid ID first.'); return; }
    setPhase('scanning');
    setResult(null);
    await sleep(2500);

    const confidence = 92 + Math.floor(Math.random() * 7); // 92–98% — high confidence for verified person
    const quality = 80 + Math.floor(Math.random() * 18);
    const ts = nowISO();
    const attemptId = genId('ATT');

    try {
      await base44.entities.RecognitionAttempt.create({
        attemptId, scannerDeviceId: 'SIM-DEVICE-001', scannerLocation: 'Main Entrance',
        personType: selectedPerson.personType, timestamp: ts, recognitionMode: 'One-to-One',
        faceDetected: true, livenessPassed: true, qualityScore: quality,
        confidenceScore: confidence, matchedEnrollmentId: selectedPerson.id,
        matchedPersonName: selectedPerson.fullName, matchedPersonType: selectedPerson.personType,
        result: 'Success', processingTimeMs: 1200, notes: 'SIMULATED One-to-One verification',
      });
      await base44.entities.AttendanceTransaction.create({
        transactionId: genId('TXN'), personProfileId: selectedPerson.personProfileId,
        personType: selectedPerson.personType, fullName: selectedPerson.fullName, idNumber: selectedPerson.idNumber,
        recognitionAttemptId: attemptId, scannerDeviceId: 'SIM-DEVICE-001', scannerLocation: 'Main Entrance',
        attendanceAction: selectedPerson.personType === 'Student' ? 'School Time In'
          : selectedPerson.personType === 'Teacher' ? 'Teacher Time In' : 'Employee Time In',
        attendanceStatus: 'Present', actualTime: ts, campus: selectedPerson.registeredCampus || 'Main',
        gradeSection: selectedPerson.gradeLevel ? `${selectedPerson.gradeLevel} - ${selectedPerson.section || ''}` : '',
        departmentPosition: selectedPerson.department || selectedPerson.position || '',
        notes: 'SIMULATED attendance transaction',
      });
    } catch (e) { /* */ }

    setResult({ success: true, matched: selectedPerson, confidence, quality, attemptId });
    setPhase('success');
  };

  const reset = () => { setPhase('idle'); setResult(null); };

  return (
    <div className="kp-dash-bg min-h-screen pb-10">
      <div className="bg-[hsl(var(--kp-teal))] px-4 sm:px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/facial-recognition')} className="text-white/80 hover:text-white text-sm font-medium">← Dashboard</button>
          <div className="flex-1" />
          <div className="text-white font-bold text-lg flex items-center gap-2"><ScanFace className="w-5 h-5" /> Face Verification</div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="kp-glass-card rounded-xl p-3 flex items-center gap-2 border-l-4 border-yellow-400">
          <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
          <span className="text-xs text-gray-600"><strong>SIMULATED RECOGNITION</strong> — One-to-One verification confirms the selected person's identity via live camera.</span>
        </div>

        {/* Step 1: Select person */}
        <div className="kp-glass-card rounded-2xl p-4 sm:p-5">
          <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-3 flex items-center gap-2"><UserCheck className="w-4 h-4" /> Step 1: Select Person to Verify</h3>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-3">
            <button onClick={() => setMode('select')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${mode === 'select' ? 'bg-[hsl(var(--kp-teal))] text-white' : 'bg-gray-100 text-gray-500'}`}>
              <Search className="w-3.5 h-3.5" /> Search by Name
            </button>
            <button onClick={() => setMode('id')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${mode === 'id' ? 'bg-[hsl(var(--kp-teal))] text-white' : 'bg-gray-100 text-gray-500'}`}>
              <Keyboard className="w-3.5 h-3.5" /> Enter ID Number
            </button>
          </div>

          {mode === 'select' ? (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID..."
                  className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto kp-scroll-thin">
                {loading ? <p className="text-sm text-gray-400 text-center py-4">Loading registered faces...</p> :
                 filtered.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No registered faces found.</p> :
                 filtered.map(e => (
                  <button key={e.id} onClick={() => setSelectedPerson(e)} disabled={phase === 'scanning'}
                    className={`p-2.5 rounded-lg border-2 text-left transition-all disabled:opacity-50 ${selectedPerson?.id === e.id ? 'border-[hsl(var(--kp-teal))] bg-[hsl(var(--kp-teal))]/10' : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'}`}>
                    <div className="text-sm font-semibold text-[hsl(var(--kp-teal))]">{e.fullName}</div>
                    <div className="text-xs text-gray-500">{e.idNumber} • {e.personType}</div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input value={idInput} onChange={e => setIdInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && verifyById()} placeholder="Enter ID number (e.g. STU-2026-001)..."
                    className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
                </div>
                <button onClick={verifyById} disabled={phase === 'scanning'} className="px-4 py-2 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50">Find</button>
              </div>
              {idInput && !selectedPerson && <p className="text-xs text-gray-400 mt-2">Press Find to locate the registered person.</p>}
            </>
          )}

          {/* Selected person chip */}
          {selectedPerson && (
            <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-[hsl(var(--kp-teal))]/10 border border-[hsl(var(--kp-teal))]/30">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--kp-teal))] flex items-center justify-center text-white font-bold text-sm shrink-0">{selectedPerson.fullName?.charAt(0) || '?'}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-[hsl(var(--kp-teal))] truncate">{selectedPerson.fullName}</div>
                <div className="text-xs text-gray-500">{selectedPerson.idNumber} • {selectedPerson.personType}{selectedPerson.gradeLevel ? ` • Grade ${selectedPerson.gradeLevel} - ${selectedPerson.section || ''}` : selectedPerson.department ? ` • ${selectedPerson.department}` : ''}</div>
              </div>
              <button onClick={() => { setSelectedPerson(null); setIdInput(''); }} disabled={phase === 'scanning'} className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50">Clear</button>
            </div>
          )}
        </div>

        {/* Step 2: Camera verification */}
        {selectedPerson && (
          <div className="kp-glass-card rounded-2xl p-4 sm:p-6">
            <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-3 flex items-center gap-2"><Camera className="w-4 h-4" /> Step 2: Verify Face with Camera</h3>
            <CameraViewfinder
              active={cameraActive}
              facingMode="user"
              overlay={
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`w-44 h-60 sm:w-52 sm:h-72 border-4 rounded-[50%] transition-all ${phase === 'scanning' ? 'border-yellow-400 animate-pulse' : phase === 'success' ? 'border-green-400' : phase === 'fail' ? 'border-red-400' : 'border-white/70'}`} />
                </div>
              }
            >
              <div className="text-center pointer-events-none">
                {phase === 'idle' && <p className="text-white/90 text-sm font-medium drop-shadow">Position face in the frame, then press Verify</p>}
                {phase === 'scanning' && (
                  <div className="text-white drop-shadow">
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                    <p className="text-sm font-medium">Verifying face...</p>
                  </div>
                )}
                {phase === 'success' && result && (
                  <div>
                    <CheckCircle2 className="w-14 h-14 mx-auto mb-1 text-green-400 drop-shadow" />
                    <p className="text-green-400 font-bold text-base drop-shadow">Verified</p>
                    <span className="inline-block mt-1 text-[10px] bg-yellow-400/20 text-yellow-300 px-2 py-0.5 rounded-full font-semibold">SIMULATED</span>
                  </div>
                )}
                {phase === 'fail' && result && (
                  <div>
                    <XCircle className="w-14 h-14 mx-auto mb-1 text-red-400 drop-shadow" />
                    <p className="text-red-400 font-bold text-base drop-shadow">Failed</p>
                    <span className="inline-block mt-1 text-[10px] bg-yellow-400/20 text-yellow-300 px-2 py-0.5 rounded-full font-semibold">SIMULATED</span>
                  </div>
                )}
              </div>
            </CameraViewfinder>

            {phase !== 'success' && phase !== 'fail' && (
              <button onClick={startScan} disabled={phase === 'scanning' || !selectedPerson}
                className="mt-4 w-full py-3 rounded-xl bg-[hsl(var(--kp-teal))] text-white font-bold text-sm hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-2">
                {phase === 'scanning' ? <Loader2 className="w-5 h-5 animate-spin" /> : <ScanFace className="w-5 h-5" />}
                {phase === 'scanning' ? 'Verifying...' : 'Verify Face & Record Attendance'}
              </button>
            )}
            {(phase === 'success' || phase === 'fail') && (
              <button onClick={reset} className="mt-4 w-full py-3 rounded-xl border border-[hsl(var(--kp-teal))] text-[hsl(var(--kp-teal))] font-bold text-sm hover:bg-[hsl(var(--kp-teal))]/10 flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5" /> Verify Another Person
              </button>
            )}
          </div>
        )}

        {/* Result card */}
        {result?.success && (
          <div className="kp-glass-card rounded-2xl p-5 border-l-4 border-green-500">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <h3 className="font-bold text-sm text-green-700">Face Verified — SIMULATED</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[hsl(var(--kp-teal))]/10 flex items-center justify-center text-2xl font-bold text-[hsl(var(--kp-teal))] shrink-0">
                {result.matched?.fullName?.charAt(0) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base text-[hsl(var(--kp-teal))]">{result.matched?.fullName || 'Unknown'}</div>
                <div className="text-xs text-gray-500">{result.matched?.idNumber} • {result.matched?.personType}</div>
                <div className="text-xs text-gray-500">{result.matched?.gradeLevel ? `Grade ${result.matched.gradeLevel} - ${result.matched.section || ''}` : result.matched?.department || ''}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-green-600">{result.confidence}%</div>
                <div className="text-[10px] text-gray-500">Confidence (Simulated)</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-blue-600">{result.quality}%</div>
                <div className="text-[10px] text-gray-500">Image Quality</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500 flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {new Date().toLocaleString()} • Main Entrance</div>
            <div className="mt-2 inline-flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Attendance Recorded: {result.matched?.personType === 'Student' ? 'School Time In' : result.matched?.personType === 'Teacher' ? 'Teacher Time In' : 'Employee Time In'} — Present
            </div>
          </div>
        )}

        {result && !result.success && (
          <div className="kp-glass-card rounded-2xl p-5 border-l-4 border-red-500">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <h3 className="font-bold text-sm text-red-700">Verification Failed — SIMULATED</h3>
            </div>
            <p className="text-sm text-gray-700">{result.reason}</p>
            {result.reason?.includes('not found') && (
              <button onClick={() => navigate('/facial-recognition/record')} className="mt-3 px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-semibold hover:brightness-105 flex items-center gap-2">
                <UserCheck className="w-4 h-4" /> Register This Person
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}