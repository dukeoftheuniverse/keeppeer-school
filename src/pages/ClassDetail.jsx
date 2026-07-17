import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { PagePanel, KpButton, StatusBadge, Avatar, SearchInput, Pagination, EmptyState } from '@/components/kp/ui';
import Drawer from '@/components/kp/Drawer';
import ActionMenu from '@/components/kp/ActionMenu';
import { ArrowLeft, UserPlus, Plus, Trash2, Printer, BookOpen, Calendar, Users, CheckSquare } from 'lucide-react';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];
const colorMap = { blue: '#3b82f6', green: '#22c55e', lime: '#84cc16', orange: '#f97316', red: '#ef4444', purple: '#a855f7', teal: '#14b8a6', gray: '#4b5563' };

export default function ClassDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cls, setCls] = useState(null);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('students');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [subjectDrawer, setSubjectDrawer] = useState(false);
  const [scheduleDrawer, setScheduleDrawer] = useState(false);
  const [addStudentDrawer, setAddStudentDrawer] = useState(false);
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', description: '', grade_level: '', category: '', teacher_name: '', room: '', color: 'teal' });
  const [scheduleForm, setScheduleForm] = useState({ day: 'Monday', start_time: '08:00', end_time: '09:00', subject_name: '', teacher_name: '', room: '', schedule_type: 'Regular', notes: '', color: 'teal' });

  const load = () => {
    setLoading(true);
    Promise.all([
      base44.entities.Class.get(id),
      base44.entities.Student.list(),
      base44.entities.Subject.filter({ class_id: id }).catch(() => []),
      base44.entities.Schedule.filter({ class_id: id }).catch(() => []),
    ]).then(([c, s, subs, sched]) => {
      setCls(c);
      setAllStudents(s);
      setStudents(s.filter(st => st.grade === c.grade_level && st.section === c.section));
      setSubjects(subs);
      setSchedules(sched);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const filteredStudents = students.filter(s => `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filteredStudents.length / 10) || 1;
  const currentStudents = filteredStudents.slice((page - 1) * 10, page * 10);

  const handleAddSubject = async () => {
    if (!subjectForm.name) return;
    await base44.entities.Subject.create({ ...subjectForm, class_id: id, grade_level: cls.grade_level });
    setSubjectDrawer(false);
    setSubjectForm({ name: '', code: '', description: '', grade_level: '', category: '', teacher_name: '', room: '', color: 'teal' });
    load();
  };

  const handleAddSchedule = async () => {
    if (!scheduleForm.subject_name) return;
    await base44.entities.Schedule.create({ ...scheduleForm, class_id: id, class_name: `${cls.grade_level} ${cls.section}` });
    setScheduleDrawer(false);
    setScheduleForm({ day: 'Monday', start_time: '08:00', end_time: '09:00', subject_name: '', teacher_name: '', room: '', schedule_type: 'Regular', notes: '', color: 'teal' });
    load();
  };

  const handleDeleteSubject = async (s) => { await base44.entities.Subject.delete(s.id); load(); };
  const handleDeleteSchedule = async (s) => { await base44.entities.Schedule.delete(s.id); load(); };

  const handleEnrollStudent = async (s) => {
    await base44.entities.Student.update(s.id, { grade: cls.grade_level, section: cls.section, enrollment_status: 'enrolled' });
    load();
  };

  const handleRemoveStudent = async (s) => {
    await base44.entities.Student.update(s.id, { enrollment_status: 'transferred' });
    load();
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;
  if (!cls) return <div className="text-center py-12 text-gray-400">Class not found</div>;

  const tabs = [
    { id: 'students', label: 'Students', icon: Users },
    { id: 'subjects', label: 'Subjects', icon: BookOpen },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'attendance', label: 'Attendance', icon: CheckSquare },
  ];

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/classes')} className="flex items-center gap-1.5 text-sm text-[hsl(var(--kp-teal))] hover:underline">
        <ArrowLeft className="w-4 h-4" /> Classes <span className="text-gray-400">/</span> {cls.grade_level} {cls.section}
      </button>

      <PagePanel>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl font-bold text-[hsl(var(--kp-teal))]">{cls.grade_level} {cls.section}</h2>
            <p className="text-sm text-gray-500">Adviser: {cls.adviser_name || '—'} • Room: {cls.room || '—'} • {students.length}/{cls.capacity} students</p>
          </div>
        </div>

        <div className="flex gap-1.5 mb-5 overflow-x-auto kp-no-scrollbar">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${tab === t.id ? 'bg-[hsl(var(--kp-teal))] text-white' : 'bg-gray-50 text-[hsl(var(--kp-teal))] hover:bg-gray-100'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'students' && (
          <div>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="text-sm font-medium text-[hsl(var(--kp-teal))] py-2">Students ({students.length}/{cls.capacity})</div>
              <SearchInput value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
              <KpButton variant="green" onClick={() => setAddStudentDrawer(true)}><UserPlus className="w-4 h-4" /> Add Student</KpButton>
            </div>
            {currentStudents.length === 0 ? (
              <EmptyState message="No students enrolled" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100 text-xs text-gray-400"><th className="text-left py-2 px-2 font-medium">Student Name</th><th className="text-left py-2 px-2 font-medium">LRN</th><th className="text-left py-2 px-2 font-medium">Status</th><th className="text-right py-2 px-2 font-medium">Actions</th></tr></thead>
                  <tbody>
                    {currentStudents.map(s => (
                      <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-2 px-2"><div className="flex items-center gap-2"><Avatar name={`${s.first_name} ${s.last_name}`} src={s.photo_url} size="w-7 h-7" /><span className="font-medium text-gray-700">{s.first_name} {s.last_name}</span></div></td>
                        <td className="py-2 px-2 text-gray-500 font-mono text-xs">{s.lrn || '—'}</td>
                        <td className="py-2 px-2"><StatusBadge status={s.enrollment_status} /></td>
                        <td className="py-2 px-2 text-right"><ActionMenu items={[{ label: 'Remove', icon: Trash2, onClick: () => handleRemoveStudent(s), className: 'text-[hsl(var(--kp-red))]' }]} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {filteredStudents.length > 0 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
          </div>
        )}

        {tab === 'subjects' && (
          <div>
            <div className="flex justify-end mb-4"><KpButton variant="green" onClick={() => setSubjectDrawer(true)}><Plus className="w-4 h-4" /> Add Subject</KpButton></div>
            {subjects.length === 0 ? <EmptyState message="No subjects added" /> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {subjects.map(s => (
                  <div key={s.id} className="p-4 rounded-xl border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: colorMap[s.color] || colorMap.teal }}><BookOpen className="w-4 h-4 text-white" /></div>
                        <div><div className="font-medium text-gray-700 text-sm">{s.name}</div><div className="text-xs text-gray-400">{s.code || '—'}</div></div>
                      </div>
                      <ActionMenu items={[{ label: 'Delete', icon: Trash2, onClick: () => handleDeleteSubject(s), className: 'text-[hsl(var(--kp-red))]' }]} />
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-gray-500">
                      <div>Teacher: {s.teacher_name || '—'}</div>
                      <div>Room: {s.room || '—'}</div>
                      {s.time && <div>Time: {s.time}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'schedule' && (
          <div>
            <div className="flex justify-between mb-4">
              <KpButton variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4" /> Print</KpButton>
              <KpButton variant="green" onClick={() => setScheduleDrawer(true)}><Plus className="w-4 h-4" /> Add Schedule</KpButton>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 font-medium text-xs text-gray-400 w-20">Time</th>
                    {days.map(d => <th key={d} className="text-left py-2 px-2 font-medium text-xs text-gray-400 min-w-[120px]">{d.slice(0, 3)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map((time) => (
                    <tr key={time} className="border-b border-gray-50">
                      <td className="py-2 px-2 text-xs text-gray-500 font-medium">{time}</td>
                      {days.map(day => {
                        const sched = schedules.find(s => s.day === day && s.start_time === time);
                        return (
                          <td key={day} className="py-1.5 px-1.5">
                            {sched && (
                              <div className="p-2 rounded-lg text-xs" style={{ backgroundColor: (colorMap[sched.color] || colorMap.teal) + '20', borderLeft: `3px solid ${colorMap[sched.color] || colorMap.teal}` }}>
                                <div className="font-medium text-gray-700 truncate">{sched.subject_name}</div>
                                <div className="text-gray-400 truncate">{sched.teacher_name}</div>
                                <div className="text-gray-400">{sched.room}</div>
                                <button onClick={() => handleDeleteSchedule(sched)} className="text-[hsl(var(--kp-red))] mt-1"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'attendance' && (
          <div>
            <p className="text-sm text-gray-500 mb-4">Attendance for this class is tracked via the QR Gate Scanner.</p>
            <div className="grid grid-cols-3 gap-3 max-w-md">
              <div className="p-3 rounded-xl bg-green-50 text-center"><div className="text-xl font-bold text-[hsl(var(--kp-green))]">0</div><div className="text-xs text-gray-400">Present</div></div>
              <div className="p-3 rounded-xl bg-red-50 text-center"><div className="text-xl font-bold text-[hsl(var(--kp-red))]">0</div><div className="text-xs text-gray-400">Absent</div></div>
              <div className="p-3 rounded-xl bg-orange-50 text-center"><div className="text-xl font-bold text-[hsl(var(--kp-orange))]">0</div><div className="text-xs text-gray-400">Late</div></div>
            </div>
          </div>
        )}
      </PagePanel>

      <Drawer open={addStudentDrawer} onClose={() => setAddStudentDrawer(false)} title="Add Student to Class">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Select students from existing records to enroll in {cls.grade_level} {cls.section}.</p>
          {allStudents.filter(s => s.grade !== cls.grade_level || s.section !== cls.section).slice(0, 20).map(s => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
              <div className="flex items-center gap-2"><Avatar name={`${s.first_name} ${s.last_name}`} size="w-8 h-8" /><div><div className="text-sm font-medium text-gray-700">{s.first_name} {s.last_name}</div><div className="text-xs text-gray-400">{s.grade} - {s.section || '—'}</div></div></div>
              <KpButton variant="outline" onClick={() => handleEnrollStudent(s)}>Enroll</KpButton>
            </div>
          ))}
        </div>
      </Drawer>

      <Drawer open={subjectDrawer} onClose={() => setSubjectDrawer(false)} title="Add New Subject">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Subject Name</label><input value={subjectForm.name} onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Subject Code</label><input value={subjectForm.code} onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Category</label><input value={subjectForm.category} onChange={e => setSubjectForm({ ...subjectForm, category: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Teacher</label><input value={subjectForm.teacher_name} onChange={e => setSubjectForm({ ...subjectForm, teacher_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Room</label><input value={subjectForm.room} onChange={e => setSubjectForm({ ...subjectForm, room: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
          </div>
          <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Description</label><textarea value={subjectForm.description} onChange={e => setSubjectForm({ ...subjectForm, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
          <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Display Color</label><div className="flex gap-2 flex-wrap">{Object.entries(colorMap).map(([name, color]) => <button key={name} onClick={() => setSubjectForm({ ...subjectForm, color: name })} className={`w-8 h-8 rounded-full ${subjectForm.color === name ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`} style={{ backgroundColor: color }} />)}</div></div>
          <div className="flex gap-3 pt-2"><KpButton variant="light" className="flex-1" onClick={() => setSubjectDrawer(false)}>Cancel</KpButton><KpButton variant="green" className="flex-1" onClick={handleAddSubject}>Save</KpButton></div>
        </div>
      </Drawer>

      <Drawer open={scheduleDrawer} onClose={() => setScheduleDrawer(false)} title="Add New Schedule">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Day</label><select value={scheduleForm.day} onChange={e => setScheduleForm({ ...scheduleForm, day: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">{days.map(d => <option key={d}>{d}</option>)}</select></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Subject</label><select value={scheduleForm.subject_name} onChange={e => setScheduleForm({ ...scheduleForm, subject_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"><option value="">Select</option>{subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Start Time</label><input type="time" value={scheduleForm.start_time} onChange={e => setScheduleForm({ ...scheduleForm, start_time: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">End Time</label><input type="time" value={scheduleForm.end_time} onChange={e => setScheduleForm({ ...scheduleForm, end_time: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Teacher</label><input value={scheduleForm.teacher_name} onChange={e => setScheduleForm({ ...scheduleForm, teacher_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Room</label><input value={scheduleForm.room} onChange={e => setScheduleForm({ ...scheduleForm, room: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
          </div>
          <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Notes</label><textarea value={scheduleForm.notes} onChange={e => setScheduleForm({ ...scheduleForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
          <div className="flex gap-3 pt-2"><KpButton variant="light" className="flex-1" onClick={() => setScheduleDrawer(false)}>Cancel</KpButton><KpButton variant="green" className="flex-1" onClick={handleAddSchedule}>Save Schedule</KpButton></div>
        </div>
      </Drawer>
    </div>
  );
}