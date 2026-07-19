import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { PagePanel, KpButton, KpInput, KpSelect, StatusBadge, Avatar } from '@/components/kp/ui';
import EmployeeDTR from '@/components/kp/EmployeeDTR';
import { Upload, Save, User, AlertTriangle, GraduationCap, Briefcase, IdCard, Gift, Wallet, Calendar, ArrowLeft, QrCode, Megaphone, BookOpen } from 'lucide-react';
import AnnouncementList from '@/components/kp/AnnouncementList';

const sections = [
  { id: 'information', label: 'Information', icon: User },
  { id: 'emergency', label: 'Emergency', icon: AlertTriangle },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'employment', label: 'Employment', icon: Briefcase },
  { id: 'identification', label: 'Identification', icon: IdCard },
  { id: 'benefits', label: 'Benefits', icon: Gift },
  { id: 'payroll', label: 'Payroll', icon: Wallet },
  { id: 'classes', label: 'Classes & Schedule', icon: BookOpen },
  { id: 'attendance', label: 'Attendance History', icon: Calendar },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
];

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState('information');
  const [saving, setSaving] = useState(false);
  const [attendance, setAttendance] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [classes, setClasses] = useState([]);
  const [schedules, setSchedules] = useState([]);

  useEffect(() => {
    Promise.all([
      base44.entities.Employee.get(id),
      base44.entities.Attendance.filter({ person_id: id }).catch(() => []),
      base44.entities.Announcement.list('-created_date', 50).catch(() => []),
      base44.entities.Class.list().catch(() => []),
      base44.entities.Schedule.list().catch(() => []),
    ]).then(([e, att, anns, cls, sched]) => {
      setEmployee(e);
      setAttendance(att);
      setAnnouncements(anns.filter(a => a.author_id === id || a.audience === 'teacher'));
      const fullName = `${e.first_name} ${e.middle_name || ''} ${e.last_name}`.replace(/\s+/g, ' ').trim();
      setClasses(cls.filter(c => c.adviser_id === id || c.adviser_name === fullName));
      setSchedules(sched.filter(s => s.teacher_id === id || s.teacher_name === fullName));
    }).finally(() => setLoading(false));
  }, [id]);

  const update = (field, value) => setEmployee({ ...employee, [field]: value });

  const handleSave = async () => {
    setSaving(true);
    try { await base44.entities.Employee.update(id, employee); } finally { setSaving(false); }
  };

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    update('photo_url', file_url);
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;
  if (!employee) return <div className="text-center py-12 text-gray-400">Employee not found</div>;

  const fullName = `${employee.first_name} ${employee.middle_name || ''} ${employee.last_name} ${employee.suffix || ''}`.replace(/\s+/g, ' ').trim();
  const role = employee.access_level ? employee.access_level.charAt(0).toUpperCase() + employee.access_level.slice(1) : 'Employee';
  const presentCount = attendance.filter(a => a.status === 'present').length;

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/employees')} className="flex items-center gap-1.5 text-sm text-[hsl(var(--kp-teal))] hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back to Faculty & Staff
      </button>

      <PagePanel>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex flex-col items-center lg:items-start gap-3">
            <div className="relative">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gray-100 border-2 border-gray-200 overflow-hidden flex items-center justify-center">
                {employee.photo_url ? <img src={employee.photo_url} className="w-full h-full object-cover" /> : <User className="w-12 h-12 text-gray-300" />}
              </div>
              <label className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1 px-3 py-1 bg-[hsl(var(--kp-teal))] rounded-full cursor-pointer shadow-md text-white text-xs font-medium">
                <Upload className="w-3 h-3" /> Change Photo
                <input type="file" className="hidden" onChange={handlePhoto} accept="image/*" />
              </label>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-[hsl(var(--kp-teal))]">{fullName}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500">
              <span className="font-mono text-xs">ID: {employee.employee_id || '—'}</span>
              <span className="px-2 py-0.5 rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--kp-teal))] text-xs font-medium">{role}</span>
              <StatusBadge status={employee.status} />
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4 max-w-md">
              <div><div className="text-lg font-bold text-[hsl(var(--kp-green))]">{presentCount}</div><div className="text-xs text-gray-400">Present</div></div>
              <div><div className="text-lg font-bold text-[hsl(var(--kp-teal))]">{employee.position || '—'}</div><div className="text-xs text-gray-400">Position</div></div>
              <div><div className="text-lg font-bold text-[hsl(var(--kp-teal))]">{employee.department || '—'}</div><div className="text-xs text-gray-400">Department</div></div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="w-28 h-28 sm:w-32 sm:h-32 bg-white border-2 border-gray-200 rounded-xl p-2 flex items-center justify-center">
              {employee.employee_id ? (
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(employee.employee_id)}`} alt="QR" className="w-full h-full" />
              ) : <QrCode className="w-10 h-10 text-gray-300" />}
            </div>
            <div className="text-xs text-gray-400 font-mono text-center break-all">{employee.employee_id || 'No ID'}</div>
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
            {active === 'information' && (
              <>
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><User className="w-4 h-4" /> Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <KpInput label="First Name" value={employee.first_name || ''} onChange={e => update('first_name', e.target.value)} />
                  <KpInput label="Middle Name" value={employee.middle_name || ''} onChange={e => update('middle_name', e.target.value)} />
                  <KpInput label="Last Name" value={employee.last_name || ''} onChange={e => update('last_name', e.target.value)} />
                  <KpInput label="Suffix" value={employee.suffix || ''} onChange={e => update('suffix', e.target.value)} />
                  <KpInput label="Birth Date" type="date" value={employee.birth_date || ''} onChange={e => update('birth_date', e.target.value)} />
                  <KpSelect label="Gender" value={employee.gender || ''} onChange={e => update('gender', e.target.value)}>
                    <option value="">Select</option><option value="male">Male</option><option value="female">Female</option>
                  </KpSelect>
                  <KpInput label="Contact Number" value={employee.mobile_number || ''} onChange={e => update('mobile_number', e.target.value)} placeholder="09XXXXXXXXX" />
                  <KpInput label="Blood Type" value={employee.blood_type || ''} onChange={e => update('blood_type', e.target.value)} />
                  <KpInput label="Email Address" value={employee.email || ''} onChange={e => update('email', e.target.value)} />
                  <KpSelect label="Marital Status" value={employee.marital_status || ''} onChange={e => update('marital_status', e.target.value)}>
                    <option value="">Select</option><option value="single">Single</option><option value="married">Married</option><option value="widowed">Widowed</option><option value="separated">Separated</option><option value="divorced">Divorced</option>
                  </KpSelect>
                  <KpInput label="Birth Place" value={employee.birth_place || ''} onChange={e => update('birth_place', e.target.value)} className="sm:col-span-2" />
                  <KpInput label="Address" value={employee.residential_address || ''} onChange={e => update('residential_address', e.target.value)} className="sm:col-span-2" />
                </div>
              </>
            )}
            {active === 'emergency' && (
              <>
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Emergency</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <KpInput label="Contact Person" value={employee.emergency_contact_name || ''} onChange={e => update('emergency_contact_name', e.target.value)} />
                  <KpInput label="Contact Number" value={employee.emergency_contact_number || ''} onChange={e => update('emergency_contact_number', e.target.value)} placeholder="09XXXXXXXXX" />
                </div>
              </>
            )}
            {active === 'education' && (
              <>
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Education</h3>
                <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Educational Background</label>
                <textarea value={employee.education || ''} onChange={e => update('education', e.target.value)} rows={8} placeholder="e.g. Bachelor of Secondary Education — University of XYZ (2015)&#10;Master of Arts in Education — XYZ (2020)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
              </>
            )}
            {active === 'employment' && (
              <>
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><Briefcase className="w-4 h-4" /> Employment</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <KpInput label="Position" value={employee.position || ''} onChange={e => update('position', e.target.value)} />
                  <KpInput label="Department" value={employee.department || ''} onChange={e => update('department', e.target.value)} />
                  <KpSelect label="Access Level" value={employee.access_level || ''} onChange={e => update('access_level', e.target.value)}>
                    <option value="admin">Admin</option><option value="teacher">Teacher</option><option value="staff">Staff</option>
                  </KpSelect>
                  <KpSelect label="Status" value={employee.status || ''} onChange={e => update('status', e.target.value)}>
                    <option value="active">Active</option><option value="inactive">Inactive</option>
                  </KpSelect>
                  <KpInput label="Hire Date" type="date" value={employee.hire_date || ''} onChange={e => update('hire_date', e.target.value)} />
                  <KpInput label="Advisory Class" value={employee.advisory_class || ''} onChange={e => update('advisory_class', e.target.value)} />
                  <KpInput label="Assigned Subjects" value={employee.assigned_subjects || ''} onChange={e => update('assigned_subjects', e.target.value)} className="sm:col-span-2" />
                </div>
              </>
            )}
            {active === 'identification' && (
              <>
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><IdCard className="w-4 h-4" /> Identification</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <KpInput label="SSS Number" value={employee.sss_no || ''} onChange={e => update('sss_no', e.target.value)} />
                  <KpInput label="PhilHealth Number" value={employee.philhealth_no || ''} onChange={e => update('philhealth_no', e.target.value)} />
                  <KpInput label="TIN Number" value={employee.tin_no || ''} onChange={e => update('tin_no', e.target.value)} />
                  <KpInput label="Pag-IBIG Number" value={employee.pagibig_no || ''} onChange={e => update('pagibig_no', e.target.value)} />
                  <KpInput label="GSIS Number" value={employee.gsis_no || ''} onChange={e => update('gsis_no', e.target.value)} />
                </div>
              </>
            )}
            {active === 'benefits' && (
              <>
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><Gift className="w-4 h-4" /> Benefits</h3>
                <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Benefits Information</label>
                <textarea value={employee.benefits || ''} onChange={e => update('benefits', e.target.value)} rows={8} placeholder="e.g. Health insurance, 13th month pay, vacation leave, service credit..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
              </>
            )}
            {active === 'payroll' && (
              <>
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><Wallet className="w-4 h-4" /> Payroll</h3>
                <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Payroll Information</label>
                <textarea value={employee.payroll_info || ''} onChange={e => update('payroll_info', e.target.value)} rows={8} placeholder="e.g. Salary grade, bank account, payroll schedule..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
              </>
            )}
            {active === 'classes' && (
              <>
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Advisory Classes</h3>
                {classes.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No advisory classes assigned.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
                    {classes.map(c => (
                      <div key={c.id} className="rounded-xl border border-gray-100 p-3 bg-gray-50/50">
                        <div className="text-sm font-semibold text-[hsl(var(--kp-teal))]">Grade {c.grade_level} - {c.section}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{c.room || 'No room'} • {c.session || 'Whole Day'}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{c.enrolled_count || 0}/{c.capacity || '—'} students</div>
                      </div>
                    ))}
                  </div>
                )}

                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-3 flex items-center gap-2"><Calendar className="w-4 h-4" /> Weekly Schedule</h3>
                {schedules.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No schedules assigned (synced from admin schedules).</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-xs text-gray-400">
                          <th className="text-left py-2 px-2 font-medium">Day</th>
                          <th className="text-left py-2 px-2 font-medium">Time</th>
                          <th className="text-left py-2 px-2 font-medium">Subject</th>
                          <th className="text-left py-2 px-2 font-medium">Class</th>
                          <th className="text-left py-2 px-2 font-medium">Room</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedules.map(s => (
                          <tr key={s.id} className="border-b border-gray-50">
                            <td className="py-2 px-2 text-gray-600">{s.day}</td>
                            <td className="py-2 px-2 text-gray-500">{s.start_time} - {s.end_time}</td>
                            <td className="py-2 px-2 text-gray-700 font-medium">{s.subject_name || '—'}</td>
                            <td className="py-2 px-2 text-gray-500">{s.class_name || '—'}</td>
                            <td className="py-2 px-2 text-gray-500">{s.room || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
            {active === 'attendance' && (
              <EmployeeDTR employee={employee} attendance={attendance} />
            )}
            {active === 'announcements' && (
              <>
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4 flex items-center gap-2"><Megaphone className="w-4 h-4" /> Announcements by {employee.first_name}</h3>
                <AnnouncementList announcements={announcements} maxHeight="400px" emptyMessage="This teacher has not posted any announcements" />
              </>
            )}

            {active !== 'attendance' && active !== 'announcements' && active !== 'classes' && (
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