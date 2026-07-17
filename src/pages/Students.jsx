import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { PagePanel, PageTitle, KpButton, StatusBadge, Avatar, SearchInput, Pagination, EmptyState, KpSelect } from '@/components/kp/ui';
import Drawer from '@/components/kp/Drawer';
import ActionMenu from '@/components/kp/ActionMenu';
import { UserPlus, Pencil, Archive, CreditCard, Eye, Upload, ArrowRightLeft } from 'lucide-react';

export default function Students() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ first_name: '', middle_name: '', last_name: '', suffix: '', lrn: '', grade: '', section: '', gender: '', birth_date: '', enrollment_status: 'enrolled' });

  const load = () => {
    setLoading(true);
    base44.entities.Student.list().then(setStudents).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const grades = [...new Set(students.map(s => s.grade).filter(Boolean))];
  const filtered = students.filter(s => {
    const name = `${s.first_name} ${s.last_name}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || (s.lrn || '').toLowerCase().includes(search.toLowerCase());
    const matchGrade = !gradeFilter || s.grade === gradeFilter;
    return matchSearch && matchGrade;
  });
  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const current = filtered.slice((page - 1) * perPage, page * perPage);

  const openAdd = () => { setEditMode(false); setForm({ first_name: '', middle_name: '', last_name: '', suffix: '', lrn: '', grade: '', section: '', gender: '', birth_date: '', enrollment_status: 'enrolled' }); setDrawerOpen(true); };
  const openEdit = (s) => { setEditMode(true); setForm(s); setDrawerOpen(true); };

  const handleSave = async () => {
    if (!form.first_name || !form.last_name) return;
    const data = { ...form, student_id: form.student_id || 'STU' + Date.now().toString().slice(-8), qr_id: form.qr_id || 'QR-' + Date.now().toString().slice(-12) };
    if (editMode) await base44.entities.Student.update(form.id, data);
    else await base44.entities.Student.create(data);
    setDrawerOpen(false);
    load();
  };

  const handleArchive = async (s) => {
    await base44.entities.Student.update(s.id, { enrollment_status: 'archived' });
    load();
  };

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm({ ...form, photo_url: file_url });
  };

  return (
    <div className="space-y-4">
      <PageTitle>Student Profile</PageTitle>
      <PagePanel>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <KpSelect value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }} className="w-20">
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </KpSelect>
          <KpSelect value={gradeFilter} onChange={e => { setGradeFilter(e.target.value); setPage(1); }} className="w-32">
            <option value="">All Grades</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </KpSelect>
          <SearchInput value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="flex-1" />
          <KpButton variant="green" onClick={openAdd}><UserPlus className="w-4 h-4" /> Add Student</KpButton>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : current.length === 0 ? (
          <EmptyState message="No students found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400">
                  <th className="text-left py-3 px-2 font-medium">Student Name</th>
                  <th className="text-left py-3 px-2 font-medium">LRN Number</th>
                  <th className="text-left py-3 px-2 font-medium">Grade</th>
                  <th className="text-left py-3 px-2 font-medium">Section</th>
                  <th className="text-left py-3 px-2 font-medium hidden sm:table-cell">Status</th>
                  <th className="text-right py-3 px-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {current.map(s => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer" onClick={() => navigate(`/student/${s.id}`)}>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={`${s.first_name} ${s.last_name}`} src={s.photo_url} />
                        <div className="font-medium text-gray-700">{s.first_name} {s.last_name}</div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-gray-500 font-mono text-xs">{s.lrn || '—'}</td>
                    <td className="py-3 px-2 text-gray-600">{s.grade || '—'}</td>
                    <td className="py-3 px-2 text-gray-600">{s.section || '—'}</td>
                    <td className="py-3 px-2 hidden sm:table-cell"><StatusBadge status={s.enrollment_status} /></td>
                    <td className="py-3 px-2 text-right" onClick={e => e.stopPropagation()}>
                      <ActionMenu items={[
                        { label: 'Edit', icon: Pencil, onClick: () => openEdit(s) },
                        { label: 'View Profile', icon: Eye, onClick: () => navigate(`/student/${s.id}`) },
                        { label: 'Generate ID', icon: CreditCard, onClick: () => navigate('/id-maker') },
                        { label: 'Transfer Section', icon: ArrowRightLeft, onClick: () => openEdit(s) },
                        { label: 'Archive', icon: Archive, onClick: () => handleArchive(s), className: 'text-gray-500' },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
      </PagePanel>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editMode ? 'Edit Student' : 'Add Student'}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden">
                {form.photo_url ? <img src={form.photo_url} className="w-full h-full object-cover" /> : <Avatar name={`${form.first_name} ${form.last_name}`} size="w-20 h-20" />}
              </div>
              <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-[hsl(var(--kp-teal))] rounded-full flex items-center justify-center cursor-pointer shadow-md">
                <Upload className="w-3.5 h-3.5 text-white" />
                <input type="file" className="hidden" onChange={handlePhoto} accept="image/*" />
              </label>
            </div>
            <div className="text-sm text-gray-500">Student Photo</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">First Name</label><input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Middle Name</label><input value={form.middle_name} onChange={e => setForm({ ...form, middle_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Last Name</label><input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Suffix</label><input value={form.suffix || ''} onChange={e => setForm({ ...form, suffix: e.target.value })} placeholder="Jr, Sr, III" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">LRN</label><input value={form.lrn} onChange={e => setForm({ ...form, lrn: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Gender</label><select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"><option value="">Select</option><option value="male">Male</option><option value="female">Female</option></select></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Grade</label><input value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} placeholder="e.g. Grade 1" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Section</label><input value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} placeholder="e.g. Mansanitas" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Birth Date</label><input type="date" value={form.birth_date || ''} onChange={e => setForm({ ...form, birth_date: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Enrollment Status</label><select value={form.enrollment_status} onChange={e => setForm({ ...form, enrollment_status: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"><option value="enrolled">Enrolled</option><option value="pending">Pending</option><option value="transferred">Transferred</option><option value="archived">Archived</option></select></div>
          </div>
          <div className="flex gap-3 pt-2">
            <KpButton variant="light" className="flex-1" onClick={() => setDrawerOpen(false)}>Cancel</KpButton>
            <KpButton variant="green" className="flex-1" onClick={handleSave}>{editMode ? 'Update' : 'Create'}</KpButton>
          </div>
        </div>
      </Drawer>
    </div>
  );
}