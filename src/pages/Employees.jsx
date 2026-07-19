import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { PagePanel, PageTitle, KpButton, StatusBadge, Avatar, SearchInput, Pagination, EmptyState, KpSelect } from '@/components/kp/ui';
import Drawer from '@/components/kp/Drawer';
import ActionMenu from '@/components/kp/ActionMenu';
import { UserPlus, Pencil, Trash2, Eye, Calendar, Upload } from 'lucide-react';

export default function Employees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ first_name: '', middle_name: '', last_name: '', employee_id: '', position: 'Teacher', department: '', email: '', mobile_number: '', access_level: 'teacher', status: 'active', hire_date: '' });
  const [roleFilter, setRoleFilter] = useState('all');

  const load = () => {
    setLoading(true);
    base44.entities.Employee.list().then(setEmployees).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = employees.filter(e => {
    const name = `${e.first_name} ${e.last_name}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || (e.employee_id || '').toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' ? true : roleFilter === 'faculty' ? e.access_level === 'teacher' : e.access_level === 'staff';
    return matchSearch && matchRole;
  });
  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const current = filtered.slice((page - 1) * perPage, page * perPage);

  const openAdd = () => { setEditMode(false); setForm({ first_name: '', middle_name: '', last_name: '', employee_id: '', position: 'Teacher', department: '', email: '', mobile_number: '', access_level: 'teacher', status: 'active', hire_date: '' }); setDrawerOpen(true); };
  const openEdit = (emp) => { setEditMode(true); setForm(emp); setDrawerOpen(true); };

  const handleSave = async () => {
    if (!form.first_name || !form.last_name) return;
    if (editMode) await base44.entities.Employee.update(form.id, form);
    else await base44.entities.Employee.create({ ...form, employee_id: form.employee_id || 'EMP' + Date.now().toString().slice(-8) });
    setDrawerOpen(false);
    load();
  };

  const handleDelete = async (emp) => {
    if (!confirm(`Delete ${emp.first_name} ${emp.last_name}?`)) return;
    await base44.entities.Employee.delete(emp.id);
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
      <PageTitle>Faculty & Staff</PageTitle>
      <PagePanel>
        <div className="flex gap-1.5 mb-4">
          {[{ k: 'all', label: 'All' }, { k: 'faculty', label: 'Faculty (Teachers)' }, { k: 'staff', label: 'Staff' }].map(t => (
            <button key={t.k} onClick={() => { setRoleFilter(t.k); setPage(1); }} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${roleFilter === t.k ? 'bg-[hsl(var(--kp-teal))] text-white' : 'bg-[hsl(var(--accent))] text-[hsl(var(--kp-teal))] hover:brightness-95'}`}>{t.label}</button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <KpSelect value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }} className="w-20">
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </KpSelect>
          <SearchInput value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="flex-1" />
          <KpButton variant="green" onClick={openAdd}><UserPlus className="w-4 h-4" /> Add Faculty / Staff</KpButton>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : current.length === 0 ? (
          <EmptyState message="No faculty & staff found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400">
                  <th className="text-left py-3 px-2 font-medium">Faculty & Staff</th>
                  <th className="text-left py-3 px-2 font-medium">ID Number</th>
                  <th className="text-left py-3 px-2 font-medium">Position</th>
                  <th className="text-left py-3 px-2 font-medium hidden sm:table-cell">Status</th>
                  <th className="text-right py-3 px-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {current.map(emp => (
                  <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={`${emp.first_name} ${emp.last_name}`} src={emp.photo_url} />
                        <div>
                          <button onClick={() => navigate(`/employee/${emp.id}`)} className="font-medium text-gray-700 hover:text-[hsl(var(--kp-teal))] hover:underline text-left">{emp.first_name} {emp.last_name}</button>
                          <div className="text-xs text-gray-400">{emp.department || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-gray-500 font-mono text-xs">{emp.employee_id || '—'}</td>
                    <td className="py-3 px-2 text-gray-600">{emp.position || '—'}</td>
                    <td className="py-3 px-2 hidden sm:table-cell"><StatusBadge status={emp.status} /></td>
                    <td className="py-3 px-2 text-right">
                      <ActionMenu items={[
                        { label: 'View Profile', icon: Eye, onClick: () => navigate(`/employee/${emp.id}`) },
                        { label: 'Edit', icon: Pencil, onClick: () => openEdit(emp) },
                        { label: 'View Schedule', icon: Calendar, onClick: () => {} },
                        { label: 'Attendance History', icon: Calendar, onClick: () => navigate(`/employee/${emp.id}`) },
                        { label: 'Delete', icon: Trash2, onClick: () => handleDelete(emp), className: 'text-[hsl(var(--kp-red))]' },
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

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editMode ? 'Edit Faculty / Staff' : 'Add Faculty / Staff'}>
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
            <div className="text-sm text-gray-500">Employee Photo</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">First Name</label><input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Middle Name</label><input value={form.middle_name} onChange={e => setForm({ ...form, middle_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Last Name</label><input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Employee ID</label><input value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Position</label><input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Department</label><input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Mobile Number</label><input value={form.mobile_number} onChange={e => setForm({ ...form, mobile_number: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Access Level</label><select value={form.access_level} onChange={e => setForm({ ...form, access_level: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"><option value="admin">Admin</option><option value="teacher">Teacher</option><option value="staff">Staff</option></select></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Status</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Hire Date</label><input type="date" value={form.hire_date || ''} onChange={e => setForm({ ...form, hire_date: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Advisory Class</label><input value={form.advisory_class || ''} onChange={e => setForm({ ...form, advisory_class: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
          </div>
          <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Assigned Subjects</label><input value={form.assigned_subjects || ''} onChange={e => setForm({ ...form, assigned_subjects: e.target.value })} placeholder="e.g. English, Mathematics" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
          <div className="flex gap-3 pt-2">
            <KpButton variant="light" className="flex-1" onClick={() => setDrawerOpen(false)}>Cancel</KpButton>
            <KpButton variant="green" className="flex-1" onClick={handleSave}>{editMode ? 'Update' : 'Create'}</KpButton>
          </div>
        </div>
      </Drawer>
    </div>
  );
}