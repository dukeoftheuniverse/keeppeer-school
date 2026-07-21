import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { PagePanel, PageTitle, KpButton, KpInput, KpSelect, StatusBadge } from '@/components/kp/ui';
import { Upload, Save, User, Users, BookOpen, AlertTriangle, HeartPulse, Calendar, ArrowLeft, QrCode, ScanFace } from 'lucide-react';
import FaceRegistrationPanel from '@/components/kp/FaceRegistrationPanel';

const sections = [
  { id: 'personal', label: 'Personal Information', icon: User },
  { id: 'parents', label: 'Parents / Guardian', icon: Users },
  { id: 'academic', label: 'Academic Information', icon: BookOpen },
  { id: 'subjects', label: 'Subjects', icon: BookOpen },
  { id: 'emergency', label: 'Emergency', icon: AlertTriangle },
  { id: 'medical', label: 'Medical Information', icon: HeartPulse },
  { id: 'attendance', label: 'Attendance History', icon: Calendar },
];

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState('personal');
  const [saving, setSaving] = useState(false);
  const [attendance, setAttendance] = useState([]);

  useEffect(() => {
    Promise.all([
      base44.entities.Student.get(id),
      base44.entities.Attendance.filter({ person_id: id }).catch(() => []),
    ]).then(([s, att]) => { setStudent(s); setAttendance(att); }).finally(() => setLoading(false));
  }, [id]);

  const update = (field, value) => setStudent({ ...student, [field]: value });

  const handleSave = async () => {
    setSaving(true);
    try { await base44.entities.Student.update(id, student); } finally { setSaving(false); }
  };

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    update('photo_url', file_url);
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;
  if (!student) return <div className="text-center py-12 text-gray-400">Student not found</div>;

  const fullName = `${student.first_name} ${student.middle_name || ''} ${student.last_name} ${student.suffix || ''}`.trim();
  const presentPct = student.attendance_present + student.attendance_absent + student.attendance_late > 0
    ? Math.round((student.attendance_present / (student.attendance_present + student.attendance_absent + student.attendance_late)) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/students')} className="flex items-center gap-1.5 text-sm text-[hsl(var(--kp-teal))] hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back to Students
      </button>

      <PagePanel>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex flex-col items-center lg:items-start gap-3">
            <div className="relative">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-gray-100 border-2 border-gray-200 overflow-hidden flex items-center justify-center">
                {student.photo_url ? <img src={student.photo_url} className="w-full h-full object-cover" /> : <User className="w-12 h-12 text-gray-300" />}
              </div>
              <label className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1 px-3 py-1 bg-[hsl(var(--kp-teal))] rounded-full cursor-pointer shadow-md text-white text-xs font-medium">
                <Upload className="w-3 h-3" /> Change Photo
                <input type="file" className="hidden" onChange={handlePhoto} accept="image/*" />
              </label>
            </div>
            <FaceRegistrationPanel
              personProfileId={id}
              personType="Student"
              idNumber={student.student_id || student.lrn || ''}
              fullName={fullName}
              registeredBy="Admin"
              onPhotoChange={async (url) => { update('photo_url', url); await base44.entities.Student.update(id, { photo_url: url }); }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-[hsl(var(--kp-teal))]">{fullName}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500">
              <span className="font-mono text-xs">ID: {student.student_id || '—'}</span>
              <StatusBadge status={student.enrollment_status} />
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4 max-w-md">
              <div><div className="text-lg font-bold text-[hsl(var(--kp-green))]">{presentPct}%</div><div className="text-xs text-gray-400">Present</div></div>
              <div><div className="text-lg font-bold text-[hsl(var(--kp-red))]">{student.attendance_absent || 0}</div><div className="text-xs text-gray-400">Absent</div></div>
              <div><div className="text-lg font-bold text-[hsl(var(--kp-orange))]">{student.attendance_late || 0}</div><div className="text-xs text-gray-400">Late</div></div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="w-28 h-28 sm:w-32 sm:h-32 bg-white border-2 border-gray-200 rounded-xl p-2 flex items-center justify-center">
              {student.qr_id ? (
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(student.qr_id)}`} alt="QR" className="w-full h-full" />
              ) : <QrCode className="w-10 h-10 text-gray-300" />}
            </div>
            <div className="text-xs text-gray-400 font-mono text-center break-all">{student.qr_id || 'No QR ID'}</div>
          </div>
        </div>
      </PagePanel>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="lg:w-56 shrink-0">
          <div className="kp-panel rounded-2xl shadow-lg p-2 space-y-0.5">
            {sections.map(s => (
              <button key={s.id} onClick={() => setActive(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active === s.id ? 'bg-[hsl(var(--kp-teal))] text-white' : 'text-[hsl(var(--kp-teal))] hover:bg-gray-50'}`}>
                <s.icon className="w-4 h-4 shrink-0" /> <span className="truncate">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <PagePanel>
            {active === 'personal' && (
              <>
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><User className="w-4 h-4" /> Personal Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <KpInput label="Student ID" value={student.student_id || ''} onChange={e => update('student_id', e.target.value)} />
                  <KpInput label="LRN" value={student.lrn || ''} onChange={e => update('lrn', e.target.value)} />
                  <KpInput label="First Name" value={student.first_name || ''} onChange={e => update('first_name', e.target.value)} />
                  <KpInput label="Middle Name" value={student.middle_name || ''} onChange={e => update('middle_name', e.target.value)} />
                  <KpInput label="Last Name" value={student.last_name || ''} onChange={e => update('last_name', e.target.value)} />
                  <KpInput label="Suffix" value={student.suffix || ''} onChange={e => update('suffix', e.target.value)} />
                  <KpInput label="Nickname" value={student.nickname || ''} onChange={e => update('nickname', e.target.value)} />
                  <KpSelect label="Gender" value={student.gender || ''} onChange={e => update('gender', e.target.value)}>
                    <option value="">Select</option><option value="male">Male</option><option value="female">Female</option>
                  </KpSelect>
                  <KpInput label="Birth Date" type="date" value={student.birth_date || ''} onChange={e => update('birth_date', e.target.value)} />
                  <KpInput label="Age" type="number" value={student.age || ''} onChange={e => update('age', Number(e.target.value))} />
                  <KpInput label="Nationality" value={student.nationality || ''} onChange={e => update('nationality', e.target.value)} />
                  <KpInput label="Religion" value={student.religion || ''} onChange={e => update('religion', e.target.value)} />
                  <KpInput label="Ethnicity" value={student.ethnicity || ''} onChange={e => update('ethnicity', e.target.value)} />
                  <KpInput label="Residential Address" value={student.residential_address || ''} onChange={e => update('residential_address', e.target.value)} className="sm:col-span-2" />
                  <KpInput label="Permanent Address" value={student.permanent_address || ''} onChange={e => update('permanent_address', e.target.value)} className="sm:col-span-2" />
                </div>
              </>
            )}
            {active === 'parents' && (
              <>
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><Users className="w-4 h-4" /> Parents / Guardian</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <KpInput label="Parent / Guardian Name" value={student.parent_name || ''} onChange={e => update('parent_name', e.target.value)} />
                  <KpInput label="Contact Number" value={student.parent_contact || ''} onChange={e => update('parent_contact', e.target.value)} />
                  <KpInput label="Email" value={student.parent_email || ''} onChange={e => update('parent_email', e.target.value)} />
                </div>
              </>
            )}
            {active === 'academic' && (
              <>
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Academic Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <KpInput label="Grade Level" value={student.grade || ''} onChange={e => update('grade', e.target.value)} />
                  <KpInput label="Section" value={student.section || ''} onChange={e => update('section', e.target.value)} />
                  <KpSelect label="Enrollment Status" value={student.enrollment_status || ''} onChange={e => update('enrollment_status', e.target.value)}>
                    <option value="enrolled">Enrolled</option><option value="pending">Pending</option><option value="transferred">Transferred</option><option value="archived">Archived</option>
                  </KpSelect>
                </div>
              </>
            )}
            {active === 'subjects' && (
              <>
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Subjects</h3>
                <p className="text-sm text-gray-400">Subjects are managed from the Class Detail page.</p>
              </>
            )}
            {active === 'emergency' && (
              <>
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Emergency Contact</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <KpInput label="Emergency Contact Name" value={student.emergency_contact_name || ''} onChange={e => update('emergency_contact_name', e.target.value)} />
                  <KpInput label="Emergency Contact Number" value={student.emergency_contact_number || ''} onChange={e => update('emergency_contact_number', e.target.value)} />
                </div>
              </>
            )}
            {active === 'medical' && (
              <>
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><HeartPulse className="w-4 h-4" /> Medical Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <KpInput label="Blood Type" value={student.blood_type || ''} onChange={e => update('blood_type', e.target.value)} />
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Medical Notes</label>
                    <textarea value={student.medical_notes || ''} onChange={e => update('medical_notes', e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
                  </div>
                </div>
              </>
            )}
            {active === 'attendance' && (
              <>
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><Calendar className="w-4 h-4" /> Attendance History</h3>
                {attendance.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No attendance records</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-100 text-xs text-gray-400"><th className="text-left py-2 px-2 font-medium">Date</th><th className="text-left py-2 px-2 font-medium">Time</th><th className="text-left py-2 px-2 font-medium">Type</th><th className="text-left py-2 px-2 font-medium">Status</th></tr></thead>
                      <tbody>
                        {attendance.map(a => (
                          <tr key={a.id} className="border-b border-gray-50">
                            <td className="py-2 px-2 text-gray-600">{a.date}</td>
                            <td className="py-2 px-2 text-gray-600">{a.time || '—'}</td>
                            <td className="py-2 px-2 text-gray-600 capitalize">{a.scan_type?.replace('_', ' ')}</td>
                            <td className="py-2 px-2"><StatusBadge status={a.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {active !== 'attendance' && active !== 'subjects' && (
              <div className="flex justify-end mt-6">
                <KpButton variant="green" onClick={handleSave} disabled={saving}><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}</KpButton>
              </div>
            )}
          </PagePanel>
        </div>
      </div>

    </div>
  );
}