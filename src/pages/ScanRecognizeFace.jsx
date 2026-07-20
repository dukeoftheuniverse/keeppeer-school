import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import CameraViewfinder from '@/components/kp/CameraViewfinder';
import {
  ScanFace, Loader2, CheckCircle2, XCircle, Camera, Scan, QrCode, Keyboard,
  Users, Shield, AlertTriangle, RefreshCw, Search, Fingerprint, Clock,
  Eye, Zap, UserCheck
} from 'lucide-react';

const MODES = [
  { key: 'One-to-Many', label: 'One-to-Many Identification', icon: Scan, desc: 'Identify any registered face' },
  { key: 'One-to-One', label: 'One-to-One Verification', icon: Fingerprint, desc: 'Verify a specific person' },
  { key: 'Face+QR', label: 'Face + QR Scan', icon: QrCode, desc: 'Scan QR then verify face' },
  { key: 'Continuous Classroom', label: 'Continuous Classroom', icon: Users, desc: 'Scan students sequentially' },
  { key: 'Visitor Verification', label: 'Visitor Verification', icon: Shield, desc: 'Verify visitor identity' },
  { key: 'Manual Fallback', label: 'Manual Fallback', icon: Keyboard, desc: 'QR, PIN, or ID number' },
];

const FAIL_REASONS = [
  'Face Not Registered', 'Face Not Recognized', 'Multiple Faces Detected',
  'Poor Lighting', 'Face Too Far', 'Spoofing Detected',
  'Low Confidence', 'Suspended Account', 'Camera Permission Denied', 'Connection Error',
];

function genId(prefix) { return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9999)}`; }
function today() { return new Date().toLocaleDateString('en-CA'); }
function nowISO() { return new Date().toISOString(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const RESULT_MAP = {
  'Face Not Registered': 'No Match',
  'Face Not Recognized': 'No Match',
  'Multiple Faces Detected': 'Multiple Faces',
  'Poor Lighting': 'Poor Lighting',
  'Face Too Far': 'Face Too Far',
  'Spoofing Detected': 'Spoofing Detected',
  'Low Confidence': 'Low Confidence',
  'Suspended Account': 'Suspended Account',
  'Camera Permission Denied': 'Camera Permission Denied',
  'Connection Error': 'Connection Error',
};

export default function ScanRecognizeFace() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState('One-to-Many');
  const [scanning, setScanning] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [result, setResult] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [qrInput, setQrInput] = useState('');
  const [manualId, setManualId] = useState('');
  const [continuousScans, setContinuousScans] = useState([]);
  const [cameraActive, setCameraActive] = useState(true);

  useEffect(() => {
    base44.entities.FaceEnrollment.filter({ recognitionStatus: 'Active' }).then(setEnrollments).catch(() => {});
  }, []);

  // Camera auto-activates when entering a scan mode; keep live unless on success/fail result
  useEffect(() => {
    if (mode === 'Manual Fallback') { setCameraActive(false); return; }
    setCameraActive(phase !== 'success' && phase !== 'fail');
  }, [mode, phase]);

  const startScan = async () => {
    if (mode === 'One-to-One' && !selectedPerson) { alert('Please select a person to verify.'); return; }
    if (mode === 'Manual Fallback') {
      if (!manualId.trim()) { alert('Enter an ID or QR code.'); return; }
      return doManualFallback();
    }
    if (mode === 'Face+QR' && !qrInput.trim()) { alert('Please scan a QR code first.'); return; }

    setScanning(true);
    setResult(null);
    setPhase('quality');
    await sleep(800);
    setPhase('liveness');
    await sleep(800);
    setPhase('matching');
    await sleep(1200);

    const willSucceed = Math.random() > 0.2 && enrollments.length > 0;
    const attemptId = genId('ATT');

    if (willSucceed) {
      let matched;
      if (mode === 'One-to-One' && selectedPerson) {
        matched = enrollments.find(e => e.id === selectedPerson.id);
      } else {
        matched = enrollments[Math.floor(Math.random() * enrollments.length)];
      }
      const confidence = 85 + Math.floor(Math.random() * 14);
      const quality = 75 + Math.floor(Math.random() * 20);
      const ts = nowISO();

      try {
        await base44.entities.RecognitionAttempt.create({
          attemptId, scannerDeviceId: 'SIM-DEVICE-001', scannerLocation: 'Main Entrance',
          personType: matched?.personType, timestamp: ts, recognitionMode: mode,
          faceDetected: true, livenessPassed: true, qualityScore: quality,
          confidenceScore: confidence, matchedEnrollmentId: matched?.id,
          matchedPersonName: matched?.fullName, matchedPersonType: matched?.personType,
          result: 'Success', processingTimeMs: 1200 + Math.floor(Math.random() * 500),
          notes: 'SIMULATED recognition result',
        });
        await base44.entities.RecognitionMatch.create({
          attemptId, enrollmentId: matched?.id, personProfileId: matched?.personProfileId,
          fullName: matched?.fullName, personType: matched?.personType, idNumber: matched?.idNumber,
          confidenceScore: confidence, thresholdScore: 80, isConfirmed: true,
          requiresManualReview: false,
          gradeSection: matched?.gradeLevel ? `${matched.gradeLevel} - ${matched.section || ''}` : '',
          matchDate: ts,
        });
        await base44.entities.LivenessResult.create({
          attemptId, livenessMethod: 'Passive', blinkDetected: true, movementDetected: true,
          textureAnalysisScore: 88, depthAnalysisScore: 85,
          replayAttackDetected: false, photoAttackDetected: false, screenAttackDetected: false,
          maskDetected: false, overallLivenessScore: 90, passed: true, timestamp: ts,
        });
        await base44.entities.AttendanceTransaction.create({
          transactionId: genId('TXN'), personProfileId: matched?.personProfileId,
          personType: matched?.personType, fullName: matched?.fullName, idNumber: matched?.idNumber,
          recognitionAttemptId: attemptId, scannerDeviceId: 'SIM-DEVICE-001', scannerLocation: 'Main Entrance',
          attendanceAction: 'School Time In', attendanceStatus: 'Present', actualTime: ts,
          campus: matched?.registeredCampus || 'Main',
          gradeSection: matched?.gradeLevel ? `${matched.gradeLevel} - ${matched.section || ''}` : '',
          notes: 'SIMULATED attendance transaction',
        });
      } catch (e) { /* */ }

      setResult({ success: true, matched, confidence, quality, attemptId });
      setPhase('success');
      if (mode === 'Continuous Classroom') {
        setContinuousScans(prev => [{ name: matched?.fullName, time: new Date().toLocaleTimeString(), status: 'Present' }, ...prev].slice(0, 30));
      }
    } else {
      const reason = FAIL_REASONS[Math.floor(Math.random() * FAIL_REASONS.length)];
      const ts = nowISO();
      try {
        await base44.entities.RecognitionAttempt.create({
          attemptId, scannerDeviceId: 'SIM-DEVICE-001', scannerLocation: 'Main Entrance',
          timestamp: ts, recognitionMode: mode,
          faceDetected: reason !== 'Camera Permission Denied',
          livenessPassed: false, qualityScore: 30 + Math.floor(Math.random() * 30),
          result: RESULT_MAP[reason] || 'No Match',
          processingTimeMs: 800 + Math.floor(Math.random() * 400),
          notes: 'SIMULATED failed recognition',
        });
      } catch (e) { /* */ }
      setResult({ success: false, reason, attemptId });
      setPhase('fail');
    }
    setScanning(false);
  };

  const doManualFallback = async () => {
    const matched = enrollments.find(e => e.idNumber === manualId.trim());
    const attemptId = genId('ATT');
    const ts = nowISO();
    if (matched) {
      try {
        await base44.entities.AttendanceTransaction.create({
          transactionId: genId('TXN'), personProfileId: matched.personProfileId,
          personType: matched.personType, fullName: matched.fullName, idNumber: matched.idNumber,
          recognitionAttemptId: attemptId, scannerDeviceId: 'SIM-DEVICE-001', scannerLocation: 'Main Entrance',
          attendanceAction: 'School Time In', attendanceStatus: 'Present', actualTime: ts,
          notes: 'Manual fallback attendance',
        });
      } catch (e) { /* */ }
      setResult({ success: true, matched, confidence: 100, quality: 100, attemptId, manual: true });
      setPhase('success');
    } else {
      setResult({ success: false, reason: 'ID Number Not Found', attemptId });
      setPhase('fail');
    }
  };

  const reset = () => { setPhase('idle'); setResult(null); };

  const filteredPeople = enrollments.filter(e =>
    `${e.fullName} ${e.idNumber} ${e.personType}`.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 10);

  return (
    <div className="kp-dash-bg min-h-screen pb-10">
      {/* Header */}
      <div className="bg-[hsl(var(--kp-teal))] px-4 sm:px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/facial-recognition')} className="text-white/80 hover:text-white text-sm font-medium">← Dashboard</button>
          <div className="flex-1" />
          <div className="text-white font-bold text-lg flex items-center gap-2"><ScanFace className="w-5 h-5" /> Scan & Recognize Face</div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
        {/* SIMULATED badge */}
        <div className="kp-glass-card rounded-xl p-3 flex items-center gap-2 border-l-4 border-yellow-400">
          <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
          <span className="text-xs text-gray-600"><strong>SIMULATED RECOGNITION</strong> — All results are simulated for demonstration. No real face data is processed.</span>
        </div>

        {/* Mode Selector */}
        <div className="kp-glass-card rounded-2xl p-4 sm:p-5">
          <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-3">Recognition Mode</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {MODES.map(m => (
              <button key={m.key} onClick={() => { setMode(m.key); reset(); }}
                className={`p-3 rounded-xl text-left border-2 transition-all ${mode === m.key ? 'border-[hsl(var(--kp-teal))] bg-[hsl(var(--kp-teal))]/10' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <m.icon className={`w-4 h-4 ${mode === m.key ? 'text-[hsl(var(--kp-teal))]' : 'text-gray-400'}`} />
                  <span className="text-sm font-semibold text-[hsl(var(--kp-teal))]">{m.label}</span>
                </div>
                <p className="text-[11px] text-gray-500">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Mode-specific inputs */}
        {mode === 'One-to-One' && (
          <div className="kp-glass-card rounded-2xl p-4">
            <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-2">Select Person to Verify</h3>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or ID..."
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto kp-scroll-thin">
              {filteredPeople.map(e => (
                <button key={e.id} onClick={() => setSelectedPerson(e)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all ${selectedPerson?.id === e.id ? 'border-[hsl(var(--kp-teal))] bg-[hsl(var(--kp-teal))]/10' : 'border-gray-100 hover:bg-gray-50'}`}>
                  <div className="text-sm font-semibold text-[hsl(var(--kp-teal))]">{e.fullName}</div>
                  <div className="text-xs text-gray-500">{e.idNumber} • {e.personType}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'Face+QR' && (
          <div className="kp-glass-card rounded-2xl p-4">
            <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-2">Step 1: Scan QR Code</h3>
            <div className="relative">
              <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={qrInput} onChange={e => setQrInput(e.target.value)} placeholder="Enter or scan QR code..."
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
            </div>
          </div>
        )}

        {mode === 'Manual Fallback' && (
          <div className="kp-glass-card rounded-2xl p-4">
            <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-2">Manual Attendance Entry</h3>
            <p className="text-xs text-gray-500 mb-2">Enter ID number, LRN, or QR code to record attendance manually.</p>
            <div className="relative">
              <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={manualId} onChange={e => setManualId(e.target.value)} placeholder="Enter ID number..."
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
            </div>
            <button onClick={doManualFallback} className="mt-3 w-full py-2.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white font-semibold text-sm hover:brightness-105">
              Submit Manual Entry
            </button>
          </div>
        )}

        {/* Camera Viewfinder */}
        {mode !== 'Manual Fallback' && (
          <div className="kp-glass-card rounded-2xl p-4 sm:p-6">
            <CameraViewfinder
              active={cameraActive}
              facingMode="user"
              onError={() => {/* camera errors handled inside component */}}
              overlay={
                <>
                  {/* Face guide frame */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-48 h-64 sm:w-56 sm:h-72 border-4 rounded-[50%] transition-all ${phase === 'matching' ? 'border-yellow-400 animate-pulse' : phase === 'quality' ? 'border-blue-400' : phase === 'liveness' ? 'border-yellow-400' : phase === 'success' ? 'border-green-400' : phase === 'fail' ? 'border-red-400' : 'border-white/70'}`} />
                  </div>
                  {/* Scan line animation */}
                  {scanning && (
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="absolute left-0 right-0 h-0.5 bg-cyan-400/80 shadow-lg shadow-cyan-400/50" style={{ animation: 'scanLine 1.5s ease-in-out infinite', top: '50%' }} />
                    </div>
                  )}
                  <style>{`@keyframes scanLine { 0%,100% { transform: translateY(-100px); } 50% { transform: translateY(100px); } }`}</style>
                </>
              }
            >
              <div className="text-center pointer-events-none">
                {phase === 'idle' && (
                  <div className="text-white/80 drop-shadow">
                    <p className="text-sm font-medium">Position your face in the frame, then press scan</p>
                  </div>
                )}
                {phase === 'quality' && (
                  <div className="text-white drop-shadow">
                    <Eye className="w-10 h-10 mx-auto mb-2 animate-pulse text-blue-400" />
                    <p className="text-sm font-medium">Checking face quality...</p>
                  </div>
                )}
                {phase === 'liveness' && (
                  <div className="text-white drop-shadow">
                    <Zap className="w-10 h-10 mx-auto mb-2 animate-pulse text-yellow-400" />
                    <p className="text-sm font-medium">Liveness detection...</p>
                  </div>
                )}
                {phase === 'matching' && (
                  <div className="text-white drop-shadow">
                    <Loader2 className="w-10 h-10 mx-auto mb-2 animate-spin text-white" />
                    <p className="text-sm font-medium">Matching face template...</p>
                  </div>
                )}
                {phase === 'success' && result && (
                  <div className="text-center px-4">
                    <CheckCircle2 className="w-16 h-16 mx-auto mb-2 text-green-400 drop-shadow" />
                    <p className="text-green-400 font-bold text-lg drop-shadow">Recognition Successful</p>
                    <span className="inline-block mt-1 text-[10px] bg-yellow-400/20 text-yellow-300 px-2 py-0.5 rounded-full font-semibold">SIMULATED</span>
                  </div>
                )}
                {phase === 'fail' && result && (
                  <div className="text-center px-4">
                    <XCircle className="w-16 h-16 mx-auto mb-2 text-red-400 drop-shadow" />
                    <p className="text-red-400 font-bold text-lg drop-shadow">Recognition Failed</p>
                    <span className="inline-block mt-1 text-[10px] bg-yellow-400/20 text-yellow-300 px-2 py-0.5 rounded-full font-semibold">SIMULATED</span>
                  </div>
                )}
              </div>
            </CameraViewfinder>

            {phase !== 'success' && phase !== 'fail' && (
              <button onClick={startScan} disabled={scanning}
                className="mt-4 w-full py-3 rounded-xl bg-[hsl(var(--kp-teal))] text-white font-bold text-sm hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-2">
                {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <ScanFace className="w-5 h-5" />}
                {scanning ? 'Scanning...' : 'Scan and Recognize Face'}
              </button>
            )}
            {(phase === 'success' || phase === 'fail') && (
              <button onClick={reset} className="mt-4 w-full py-3 rounded-xl border border-[hsl(var(--kp-teal))] text-[hsl(var(--kp-teal))] font-bold text-sm hover:bg-[hsl(var(--kp-teal))]/10 flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5" /> Scan Again
              </button>
            )}
          </div>
        )}

        {/* Success Result Card */}
        {result?.success && (
          <div className="kp-glass-card rounded-2xl p-5 border-l-4 border-green-500">
            <div className="flex items-center gap-2 mb-3">
              <UserCheck className="w-5 h-5 text-green-600" />
              <h3 className="font-bold text-sm text-green-700">Access Granted — SIMULATED</h3>
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
                <div className="text-[10px] text-gray-500">Quality Score</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> {new Date().toLocaleString()} • Main Entrance
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Attendance Recorded: School Time In — Present
            </div>
          </div>
        )}

        {/* Failure Result Card */}
        {result && !result.success && (
          <div className="kp-glass-card rounded-2xl p-5 border-l-4 border-red-500">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-5 h-5 text-red-600" />
              <h3 className="font-bold text-sm text-red-700">Access Denied — SIMULATED</h3>
            </div>
            <p className="text-sm text-gray-700 mb-2">Reason: <strong>{result.reason}</strong></p>
            <p className="text-xs text-gray-500">For security reasons, no matching names are revealed on failed recognition attempts.</p>
            {(result.reason === 'Face Not Registered' || result.reason === 'Face Not Recognized') && (
              <button onClick={() => navigate('/facial-recognition/record')}
                className="mt-3 px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-semibold hover:brightness-105 flex items-center gap-2">
                <UserCheck className="w-4 h-4" /> Register This Person
              </button>
            )}
          </div>
        )}

        {/* Continuous Classroom scan list */}
        {mode === 'Continuous Classroom' && continuousScans.length > 0 && (
          <div className="kp-glass-card rounded-2xl p-4">
            <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-3">Continuous Classroom Scans ({continuousScans.length})</h3>
            <div className="space-y-1.5 max-h-60 overflow-y-auto kp-scroll-thin">
              {continuousScans.map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-sm font-medium text-[hsl(var(--kp-teal))] flex-1">{s.name}</span>
                  <span className="text-xs text-gray-400">{s.time}</span>
                  <span className="text-xs font-semibold text-green-600">{s.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}