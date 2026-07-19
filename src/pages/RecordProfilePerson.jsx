import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  UserPlus, Search, Camera, CheckCircle2, Loader2, ChevronRight, ChevronLeft,
  User, GraduationCap, Briefcase, Shield, Users, UserCheck, Eye, Zap,
  Upload, FileText, X, RefreshCw, Award, Printer, ScanFace, AlertTriangle
} from 'lucide-react';

const PERSON_TYPES = [
  { key: 'Student', icon: GraduationCap, color: 'bg-green-500' },
  { key: 'Teacher', icon: Users, color: 'bg-indigo-500' },
  { key: 'Employee', icon: Briefcase, color: 'bg-teal-500' },
  { key: 'Administrator', icon: Shield, color: 'bg-gray-700' },
  { key: 'Parent/Guardian', icon: User, color: 'bg-blue-500' },
  { key: 'Authorized Visitor', icon: UserCheck, color: 'bg-purple-500' },
];

const CAPTURE_STEPS = [
  { key: 'frontFace', label: 'Look Directly at Camera' },
  { key: 'leftAngle', label: 'Slowly Turn Left' },
  { key: 'rightAngle', label: 'Slowly Turn Right' },
  { key: 'lookUp', label: 'Look Up' },
  { key: 'lookDown', label: 'Look Down' },
  { key: 'blink', label: 'Blink Eyes' },
  { key: 'smile', label: 'Smile' },
  { key: 'neutral', label: 'Return to Neutral' },
];

function genId(prefix) { return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 9999)}`; }
function today() { return new Date().toLocaleDateString('en-CA'); }
function nowISO() { return new Date().toISOString(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export default function RecordProfilePerson() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [personType, setPersonType] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState('');
  const [consent, setConsent] = useState({ consentingPersonName: '', relationshipToStudent: '', consentMethod: 'Digital Signature', digitalSignature: '', agreed: false });
  const [capturing, setCapturing] = useState(false);
  const [captureStep, setCaptureStep] = useState(-1);
  const [captureProgress, setCaptureProgress] = useState({});
  const [captureIssues, setCaptureIssues] = useState([]);
  const [completedEnrollment, setCompletedEnrollment] = useState(null);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  // Step 2: search profiles
  useEffect(() => {
    if (step !== 2) return;
    setLoadingProfiles(true);
    base44.entities.PersonProfile.list().then(all => {
      setProfiles(all);
      setLoadingProfiles(false);
    }).catch(() => setLoadingProfiles(false));
  }, [step]);

  const filteredProfiles = profiles.filter(p =>
    `${p.fullName} ${p.idNumber} ${p.lrn || ''} ${p.email || ''} ${p.contactNumber || ''}`.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 20);

  const selectExisting = (p) => {
    setSelectedProfile(p);
    setForm({ ...p, personType: personType });
    setPhotoPreview(p.profilePhoto || '');
    setStep(3);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result);
    reader.readAsDataURL(file);
  };

  const isMinor = () => {
    if (!form.dateOfBirth) return false;
    const dob = new Date(form.dateOfBirth);
    const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
    return age < 18;
  };

  // Step 3: save profile
  const saveProfile = async () => {
    if (!form.fullName) { alert('Please enter full name.'); return; }
    setSaving(true);
    try {
      const data = { ...form, personType, profilePhoto: photoPreview, registrationDate: today() };
      let saved;
      if (selectedProfile?.id) {
        saved = await base44.entities.PersonProfile.update(selectedProfile.id, data);
      } else {
        saved = await base44.entities.PersonProfile.create(data);
      }
      setSelectedProfile(saved);
      // create sub-profile
      if (personType === 'Student') {
        await base44.entities.StudentProfile.create({
          personProfileId: saved.id, fullName: saved.fullName, studentId: saved.idNumber, lrn: saved.lrn,
          gradeLevel: saved.gradeLevel, section: saved.section, campus: saved.campus,
          parentGuardianName: saved.parentGuardianName, parentContact: saved.contactNumber,
          enrollmentStatus: 'Enrolled', enrollmentDate: today(),
        }).catch(() => {});
      } else if (['Teacher', 'Employee', 'Administrator'].includes(personType)) {
        await base44.entities.EmployeeProfile.create({
          personProfileId: saved.id, fullName: saved.fullName, employeeId: saved.idNumber,
          department: saved.department, position: saved.position, campus: saved.campus,
          employmentType: 'Full-time', employmentStatus: 'Active', hireDate: today(),
        }).catch(() => {});
      } else if (personType === 'Authorized Visitor') {
        await base44.entities.VisitorProfile.create({
          personProfileId: saved.id, fullName: saved.fullName, visitorId: saved.idNumber,
          referenceNumber: genId('REF'), purposeOfVisit: form.purposeOfVisit || '',
          visitorStatus: 'Approved', validFrom: today(),
        }).catch(() => {});
      }
      setStep(4);
    } catch (e) { alert('Error saving profile: ' + e.message); }
    setSaving(false);
  };

  // Step 4: save consent
  const confirmConsent = async () => {
    if (!consent.consentingPersonName) { alert('Enter consenting person name.'); return; }
    if (!consent.agreed) { alert('Please check the consent checkbox.'); return; }
    if (isMinor() && !consent.relationshipToStudent) { alert('Enter guardian relationship.'); return; }
    setSaving(true);
    const enrollmentId = genId('ENR');
    const consentText = `Biometric facial recognition consent for ${form.fullName}. Data collected for attendance and access control. Stored securely with encryption. Retained per policy. Consent can be withdrawn at any time.`;
    try {
      const consentRec = await base44.entities.BiometricConsent.create({
        enrollmentId, personProfileId: selectedProfile.id,
        consentingPersonName: consent.consentingPersonName,
        relationshipToStudent: consent.relationshipToStudent, consentDate: today(),
        consentMethod: consent.consentMethod, digitalSignature: consent.digitalSignature,
        adminProcessor: user?.full_name || 'Admin', consentText,
        consentWithdrawn: false,
      });
      setSelectedProfile({ ...selectedProfile, _consentId: consentRec.id, _enrollmentId: enrollmentId });
      setStep(5);
    } catch (e) { alert('Error saving consent: ' + e.message); }
    setSaving(false);
  };

  // Step 5: simulated face capture
  const startCapture = async () => {
    setCapturing(true);
    setCaptureProgress({});
    setCaptureIssues([]);
    for (let i = 0; i < CAPTURE_STEPS.length; i++) {
      setCaptureStep(i);
      await sleep(700);
      setCaptureProgress(prev => ({ ...prev, [CAPTURE_STEPS[i].key]: true }));
    }
    // simulate quality checks
    const issues = [];
    if (Math.random() < 0.15) issues.push('Poor lighting detected — consider retaking in better light');
    if (Math.random() < 0.1) issues.push('Multiple faces detected — ensure only one person in frame');
    setCaptureIssues(issues);
    setCaptureStep(CAPTURE_STEPS.length);
    setCapturing(false);
  };

  const confirmAndSave = async () => {
    setSaving(true);
    const enrollmentId = selectedProfile._enrollmentId || genId('ENR');
    const facialRecordId = genId('FR');
    const qualityScore = 85 + Math.floor(Math.random() * 11);
    const ts = nowISO();
    try {
      const enrollment = await base44.entities.FaceEnrollment.create({
        facialRecordId, personProfileId: selectedProfile.id, personType, fullName: form.fullName,
        idNumber: form.idNumber || '', secureTemplateReference: `ENC-${genId('TPL')}`,
        enrollmentQualityScore: qualityScore, livenessResult: 'Passed',
        registrationDate: today(), registrationDevice: navigator.userAgent.slice(0, 50),
        registeredCampus: form.campus || 'Main', registeredBy: user?.full_name || 'Admin',
        consentRecordId: selectedProfile._consentId || '', recognitionStatus: 'Active',
        successfulMatchCount: 0, failedMatchCount: 0, reEnrollmentStatus: 'Not Required',
        accountStatus: 'Active', encryptionVersion: 'AES-256-v1',
      });
      await base44.entities.FaceCaptureSession.create({
        enrollmentId, sessionType: 'Enrollment', completedSteps: CAPTURE_STEPS.map(s => s.key).join(','),
        frontFaceCaptured: true, leftAngleCaptured: true, rightAngleCaptured: true,
        blinkConfirmed: true, livenessConfirmed: true, faceQualityAccepted: captureIssues.length === 0,
        lightingQuality: captureIssues.some(i => i.includes('lighting')) ? 'Poor' : 'Good',
        imageSharpness: 'Sharp', faceSize: 'Good', facePosition: 'Centered',
        multipleFacesDetected: captureIssues.some(i => i.includes('Multiple')),
        overallStatus: 'Completed', captureDate: today(), deviceInfo: navigator.userAgent.slice(0, 50),
      });
      await base44.entities.FaceTemplateReference.create({
        enrollmentId, templateHash: `HASH-${genId('HSH')}`, storageLocation: 'Local Secure',
        encryptionMethod: 'AES-256', templateVersion: 'v1', createdAt: ts, isActive: true,
      });
      await base44.entities.BiometricAuditLog.create({
        action: 'Enrollment', enrollmentId, personProfileId: selectedProfile.id,
        performedBy: user?.full_name || 'Admin', timestamp: ts, details: `SIMULATED enrollment for ${form.fullName}`,
        isBiometricData: true,
      });
      setCompletedEnrollment({ enrollment, qualityScore, facialRecordId });
      setStep(6);
    } catch (e) { alert('Error saving enrollment: ' + e.message); }
    setSaving(false);
  };

  const reset = () => {
    setStep(1); setPersonType(''); setSelectedProfile(null); setForm({}); setPhotoPreview('');
    setConsent({ consentingPersonName: '', relationshipToStudent: '', consentMethod: 'Digital Signature', digitalSignature: '', agreed: false });
    setCaptureProgress({}); setCaptureStep(-1); setCaptureIssues([]); setCompletedEnrollment(null);
  };

  return (
    <div className="kp-dash-bg min-h-screen pb-10">
      {/* Header */}
      <div className="bg-[hsl(var(--kp-teal))] px-4 sm:px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/facial-recognition')} className="text-white/80 hover:text-white text-sm font-medium">← Dashboard</button>
          <div className="flex-1" />
          <div className="text-white font-bold text-lg flex items-center gap-2"><UserPlus className="w-5 h-5" /> Record & Profile Person</div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Step indicator */}
        <div className="kp-glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <React.Fragment key={n}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${step >= n ? 'bg-[hsl(var(--kp-teal))] text-white' : 'bg-gray-200 text-gray-400'}`}>
                  {step > n ? <CheckCircle2 className="w-4 h-4" /> : n}
                </div>
                {n < 6 && <div className={`flex-1 h-0.5 mx-1 ${step > n ? 'bg-[hsl(var(--kp-teal))]' : 'bg-gray-200'}`} />}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-between mt-1.5 text-[9px] sm:text-[10px] text-gray-500 font-medium">
            <span>Person Type</span><span>Search</span><span>Profile</span><span>Consent</span><span>Face</span><span>Done</span>
          </div>
        </div>

        {/* Step 1: Person Type */}
        {step === 1 && (
          <div className="kp-glass-card rounded-2xl p-5">
            <h3 className="text-base font-bold text-[hsl(var(--kp-teal))] mb-4">Step 1: Select Person Type</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PERSON_TYPES.map(t => (
                <button key={t.key} onClick={() => { setPersonType(t.key); setForm({ ...form, personType: t.key }); setStep(2); }}
                  className="p-5 rounded-2xl border-2 border-gray-200 hover:border-[hsl(var(--kp-teal))] hover:bg-[hsl(var(--kp-teal))]/5 transition-all text-center">
                  <div className={`w-12 h-12 rounded-xl ${t.color} flex items-center justify-center mx-auto mb-2`}>
                    <t.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-sm font-semibold text-[hsl(var(--kp-teal))]">{t.key}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Search or Create */}
        {step === 2 && (
          <div className="kp-glass-card rounded-2xl p-5">
            <h3 className="text-base font-bold text-[hsl(var(--kp-teal))] mb-4">Step 2: Search or Create Profile</h3>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, ID, LRN, email..."
                className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white" />
            </div>
            {loadingProfiles ? (
              <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-[hsl(var(--kp-teal))] animate-spin" /></div>
            ) : (
              <>
                <div className="space-y-1.5 max-h-64 overflow-y-auto kp-scroll-thin mb-3">
                  {filteredProfiles.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No matching profiles found.</p>
                  ) : filteredProfiles.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                      <div className="w-10 h-10 rounded-full bg-[hsl(var(--kp-teal))]/10 flex items-center justify-center text-sm font-bold text-[hsl(var(--kp-teal))] shrink-0">
                        {p.fullName?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[hsl(var(--kp-teal))] truncate">{p.fullName}</div>
                        <div className="text-xs text-gray-500">{p.idNumber || p.lrn || ''} • {p.personType}</div>
                      </div>
                      <button onClick={() => selectExisting(p)} className="px-3 py-1.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-xs font-semibold hover:brightness-105 shrink-0">Select</button>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <button onClick={() => { setSelectedProfile(null); setForm({ personType }); setStep(3); }}
                    className="w-full py-2.5 rounded-lg border-2 border-dashed border-[hsl(var(--kp-teal))]/40 text-[hsl(var(--kp-teal))] text-sm font-semibold hover:bg-[hsl(var(--kp-teal))]/5 flex items-center justify-center gap-2">
                    <UserPlus className="w-4 h-4" /> Create New Profile
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Profile Form */}
        {step === 3 && (
          <div className="kp-glass-card rounded-2xl p-5">
            <h3 className="text-base font-bold text-[hsl(var(--kp-teal))] mb-4">Step 3: Complete Personal Profile</h3>
            {/* Photo upload */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                {photoPreview ? <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-gray-300" />}
              </div>
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--kp-teal))]/10 text-[hsl(var(--kp-teal))] text-sm font-medium hover:bg-[hsl(var(--kp-teal))]/20">
                  <Upload className="w-4 h-4" /> Upload Photo
                </span>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Full Name *" value={form.fullName} onChange={v => setForm({ ...form, fullName: v })} />
              <Field label="ID Number" value={form.idNumber} onChange={v => setForm({ ...form, idNumber: v })} />
              {personType === 'Student' && <>
                <Field label="LRN" value={form.lrn} onChange={v => setForm({ ...form, lrn: v })} />
                <Field label="Grade Level" value={form.gradeLevel} onChange={v => setForm({ ...form, gradeLevel: v })} />
                <Field label="Section" value={form.section} onChange={v => setForm({ ...form, section: v })} />
                <Field label="Campus" value={form.campus} onChange={v => setForm({ ...form, campus: v })} />
                <Field label="Parent/Guardian Name" value={form.parentGuardianName} onChange={v => setForm({ ...form, parentGuardianName: v })} />
              </>}
              {['Teacher', 'Employee', 'Administrator'].includes(personType) && <>
                <Field label="Department" value={form.department} onChange={v => setForm({ ...form, department: v })} />
                <Field label="Position" value={form.position} onChange={v => setForm({ ...form, position: v })} />
                <Field label="Assigned Building" value={form.assignedBuilding} onChange={v => setForm({ ...form, assignedBuilding: v })} />
                <Field label="Assigned Room" value={form.assignedRoom} onChange={v => setForm({ ...form, assignedRoom: v })} />
              </>}
              {personType === 'Authorized Visitor' && <>
                <Field label="Reference Number" value={form.referenceNumber} onChange={v => setForm({ ...form, referenceNumber: v })} />
                <Field label="Purpose of Visit" value={form.purposeOfVisit} onChange={v => setForm({ ...form, purposeOfVisit: v })} />
              </>}
              <Field label="Date of Birth" type="date" value={form.dateOfBirth} onChange={v => setForm({ ...form, dateOfBirth: v })} />
              <SelectField label="Gender" value={form.gender} onChange={v => setForm({ ...form, gender: v })} options={['Male', 'Female', 'Other']} />
              <Field label="Contact Number" value={form.contactNumber} onChange={v => setForm({ ...form, contactNumber: v })} />
              <Field label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
              <Field label="Emergency Contact" value={form.emergencyContact} onChange={v => setForm({ ...form, emergencyContact: v })} />
              <Field label="Address" value={form.address} onChange={v => setForm({ ...form, address: v })} />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-5">
              <button onClick={() => setStep(2)} className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-1.5"><ChevronLeft className="w-4 h-4" /> Back</button>
              <button onClick={saveProfile} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save Profile & Continue
              </button>
              <button onClick={reset} className="px-4 py-2.5 rounded-lg text-red-600 text-sm font-medium hover:bg-red-50">Cancel Registration</button>
            </div>
          </div>
        )}

        {/* Step 4: Consent */}
        {step === 4 && (
          <div className="kp-glass-card rounded-2xl p-5">
            <h3 className="text-base font-bold text-[hsl(var(--kp-teal))] mb-4">Step 4: Consent & Privacy Confirmation</h3>
            <div className="bg-blue-50 rounded-xl p-4 mb-4 max-h-48 overflow-y-auto kp-scroll-thin">
              <FileText className="w-5 h-5 text-blue-500 mb-2" />
              <div className="text-xs text-gray-700 space-y-1.5 leading-relaxed">
                <p><strong>Why facial information is collected:</strong> For automated attendance tracking and campus access control.</p>
                <p><strong>How facial recognition is used:</strong> Your facial template is compared at scanners to verify identity.</p>
                <p><strong>Where information is stored:</strong> Encrypted templates stored in secure local storage. No raw images retained.</p>
                <p><strong>Who can access it:</strong> Authorized administrators and data privacy officers only.</p>
                <p><strong>Retention period:</strong> Facial data retained per school policy, maximum 1 academic year.</p>
                <p><strong>How to withdraw consent:</strong> Contact the school administrator to withdraw consent at any time.</p>
                <p><strong>How to delete facial record:</strong> Request deletion through the Face Database page. Audit records preserved.</p>
              </div>
            </div>

            {isMinor() && (
              <div className="bg-yellow-50 rounded-xl p-3 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-yellow-600" />
                <span className="text-xs text-yellow-700 font-medium">Student is a minor — Guardian consent required.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Consenting Person Name *" value={consent.consentingPersonName} onChange={v => setConsent({ ...consent, consentingPersonName: v })} />
              {isMinor() && <Field label="Relationship to Student *" value={consent.relationshipToStudent} onChange={v => setConsent({ ...consent, relationshipToStudent: v })} />}
              <SelectField label="Consent Method" value={consent.consentMethod} onChange={v => setConsent({ ...consent, consentMethod: v })}
                options={['In Person', 'Digital Signature', 'Verbal with Witness', 'Guardian Digital Signature']} />
              <Field label="Digital Signature" value={consent.digitalSignature} onChange={v => setConsent({ ...consent, digitalSignature: v })} />
            </div>

            <label className="flex items-center gap-2 mt-4 cursor-pointer">
              <input type="checkbox" checked={consent.agreed} onChange={e => setConsent({ ...consent, agreed: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-[hsl(var(--kp-teal))]" />
              <span className="text-sm text-gray-700">I have read and consent to the collection and use of facial biometric data as described above.</span>
            </label>

            <div className="flex flex-col sm:flex-row gap-2 mt-5">
              <button onClick={() => setStep(3)} className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-1.5"><ChevronLeft className="w-4 h-4" /> Back</button>
              <button onClick={confirmConsent} disabled={saving || !consent.agreed}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Confirm Consent
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Face Capture */}
        {step === 5 && (
          <div className="kp-glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-base font-bold text-[hsl(var(--kp-teal))]">Step 5: Record Face</h3>
              <span className="text-[10px] bg-yellow-400/20 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">SIMULATED CAPTURE</span>
            </div>

            {/* Camera area */}
            <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center mb-4">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={`w-48 h-64 border-4 rounded-[50%] transition-all ${capturing ? 'border-cyan-400 animate-pulse' : captureStep >= CAPTURE_STEPS.length ? 'border-green-400' : 'border-white/60'}`} />
              </div>
              <div className="relative z-10 text-white text-center">
                {captureStep < 0 && <><Camera className="w-12 h-12 mx-auto mb-2 opacity-50" /><p className="text-sm text-white/70">Press "Start Face Recording" to begin</p></>}
                {captureStep >= 0 && captureStep < CAPTURE_STEPS.length && <>
                  <Eye className="w-10 h-10 mx-auto mb-2 animate-pulse text-cyan-400" />
                  <p className="text-sm font-medium">{CAPTURE_STEPS[captureStep].label}</p>
                </>}
                {captureStep >= CAPTURE_STEPS.length && <><CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-400" /><p className="text-green-400 font-medium text-sm">Capture Complete</p></>}
              </div>
              {capturing && <div className="absolute left-0 right-0 h-0.5 bg-cyan-400/80" style={{ animation: 'scanLine 1.5s ease-in-out infinite', top: '50%' }} />}
              <style>{`@keyframes scanLine { 0%,100% { transform: translateY(-100px); } 50% { transform: translateY(100px); } }`}</style>
            </div>

            {/* Progress checklist */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {CAPTURE_STEPS.map(s => (
                <div key={s.key} className={`flex items-center gap-1.5 text-xs ${captureProgress[s.key] ? 'text-green-600' : 'text-gray-400'}`}>
                  {captureProgress[s.key] ? <CheckCircle2 className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-300" />}
                  <span className="truncate">{s.label.split(' ')[0]}</span>
                </div>
              ))}
            </div>

            {/* Quality checks */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <div className="text-xs font-semibold text-[hsl(var(--kp-teal))] mb-2">Quality Checks</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                {['Lighting', 'Sharpness', 'Face Size', 'Position', 'Resolution', 'Glare', 'Obstruction', 'Multiple Faces', 'Movement', 'Masks'].map(q => (
                  <div key={q} className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span className="text-gray-600">{q}</span>
                  </div>
                ))}
              </div>
            </div>

            {captureIssues.length > 0 && (
              <div className="bg-orange-50 rounded-xl p-3 mb-4 space-y-1">
                {captureIssues.map((issue, i) => (
                  <div key={i} className="text-xs text-orange-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> {issue}
                  </div>
                ))}
                <button onClick={startCapture} className="mt-2 px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold hover:brightness-105 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Retake
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={() => setStep(4)} className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-1.5"><ChevronLeft className="w-4 h-4" /> Back</button>
              {captureStep < 0 && (
                <button onClick={startCapture} disabled={capturing}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} Start Face Recording
                </button>
              )}
              {captureStep >= CAPTURE_STEPS.length && (
                <button onClick={confirmAndSave} disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-green-500 text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Confirm and Save
                </button>
              )}
              <button onClick={reset} className="px-4 py-2.5 rounded-lg text-red-600 text-sm font-medium hover:bg-red-50">Cancel</button>
            </div>
          </div>
        )}

        {/* Step 6: Completion */}
        {step === 6 && completedEnrollment && (
          <div className="kp-glass-card rounded-2xl p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-[hsl(var(--kp-teal))] mb-1">Registration Complete!</h3>
            <p className="text-xs text-gray-500 mb-4">Face enrollment successful — <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-semibold">SIMULATED</span></p>

            <div className="flex items-center gap-4 bg-gray-50 rounded-xl p-4 mb-4 text-left">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 shrink-0">
                {photoPreview ? <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-400">{form.fullName?.charAt(0)}</div>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base text-[hsl(var(--kp-teal))]">{form.fullName}</div>
                <div className="text-xs text-gray-500">{form.idNumber || form.lrn || ''} • {personType}</div>
                <div className="text-xs text-gray-500">{form.gradeLevel ? `Grade ${form.gradeLevel} - ${form.section}` : form.department || ''}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5 text-left">
              <InfoRow label="Face Status" value="Active" />
              <InfoRow label="Quality Score" value={`${completedEnrollment.qualityScore}%`} />
              <InfoRow label="Liveness" value="Passed" />
              <InfoRow label="Registration Date" value={today()} />
              <InfoRow label="Device" value="This Device" />
              <InfoRow label="Consent" value="Confirmed" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button onClick={() => navigate('/facial-recognition/scan')} className="px-4 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:brightness-105 flex items-center justify-center gap-1.5"><ScanFace className="w-4 h-4" /> Test Recognition</button>
              <button onClick={() => window.print()} className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-1.5"><Printer className="w-4 h-4" /> Print Confirmation</button>
              <button onClick={() => navigate('/facial-recognition/database')} className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-1.5"><User className="w-4 h-4" /> View Profile</button>
              <button onClick={reset} className="px-4 py-2.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-semibold hover:brightness-105 flex items-center justify-center gap-1.5"><UserPlus className="w-4 h-4" /> Register Another</button>
            </div>
            <button onClick={() => navigate('/facial-recognition')} className="mt-2 w-full py-2.5 rounded-lg text-gray-500 text-sm font-medium hover:bg-gray-50">Return to Dashboard</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
    </div>
  );
}
function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
      <select value={value || ''} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15">
        <option value="">Select...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-center p-2 rounded-lg bg-gray-50">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-[hsl(var(--kp-teal))]">{value}</span>
    </div>
  );
}