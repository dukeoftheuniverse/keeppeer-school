import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { PagePanel, PageTitle, KpButton, StatusBadge, SearchInput, Pagination, EmptyState, KpSelect } from '@/components/kp/ui';
import Drawer from '@/components/kp/Drawer';
import ActionMenu from '@/components/kp/ActionMenu';
import { Plus, Pencil, Trash2, LayoutGrid, Users, Percent, UserSquare } from 'lucide-react';

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="kp-panel rounded-xl p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-[hsl(var(--kp-teal))]" />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="text-xl font-bold text-[hsl(var(--kp-teal))]">{value}</div>
      {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
    </div>
  );
}

export default function GradeSection() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ academic_year: '2026-2027', grade_level: '', section: '', adviser_name: '', room: '', capacity: 40, session: 'Whole Day', status: 'active' });

  const load = () => {
    setLoading(true);
    Promise.all([
      base44.entities.Class.list(),
      base44.entities.Student.list(),
    ]).then(([c, s]) => { setClasses(c); setStudents(s); }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = classes.filter(c => {
    const name = `${c.grade_level} ${c.section}`.toLowerCase();
    return name.includes(search.toLowerCase()) && (!academicYear || c.academic_year === academicYear);
  });
  const totalPages = Math.ceil(filtered.length / 10) || 1;
  const current = filtered.slice((page - 1) * 10, page * 10);

  const totalStudents = students.length;
  const totalClasses = classes.length;
  const avgClassSize = totalClasses > 0 ? Math.round(totalStudents / totalClasses) : 0;

  const openAdd = () => { setEditMode(false); setForm({ academic_year: academicYear, grade_level: '', section: '', adviser_name: '', room: '', capacity: 40, session: 'Whole Day', status: 'active' }); setDrawerOpen(true); };
  const openEdit = (c) => { setEditMode(true); setForm(c); setDrawerOpen(true); };

  const handleSave = async () => {
    if (!form.grade_level || !form.section) return;
    if (editMode) await base44.entities.Class.update(form.id, form);
    else await base44.entities.Class.create(form);
    setDrawerOpen(false);
    load();
  };

  const handleDelete = async (c) => {
    if (!confirm(`Delete ${c.grade_level} - ${c.section}?`)) return;
    await base44.entities.Class.delete(c.id);
    load();
  };

  const getEnrolled = (c) => students.filter(s => s.grade === c.grade_level && s.section === c.section).length;

  return (
    <div className="space-y-4">
      <PageTitle>Class</PageTitle>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={LayoutGrid} label="Total Classes" value={totalClasses} sub="Across all Grades" />
        <StatCard icon={Users} label="Total Students" value={totalStudents.toLocaleString()} sub="Enrolled Students" />
        <StatCard icon={Percent} label="Average Attendance" value="96.4%" sub="Today's Average" />
        <StatCard icon={UserSquare} label="Average Class Size" value={avgClassSize} sub="Students per class" />
      </div>

      <PagePanel>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <KpSelect value={academicYear} onChange={e => setAcademicYear(e.target.value)} className="w-40">
            <option>2026-2027</option>
            <option>2025-2026</option>
            <option>2024-2025</option>
          </KpSelect>
          <SearchInput value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="flex-1" />
          <KpButton variant="green" onClick={openAdd}><Plus className="w-4 h-4" /> Add Class</KpButton>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : current.length === 0 ? (
          <EmptyState message="No classes found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400">
                  <th className="text-left py-3 px-2 font-medium">Class</th>
                  <th className="text-left py-3 px-2 font-medium">Adviser</th>
                  <th className="text-left py-3 px-2 font-medium">Room</th>
                  <th className="text-left py-3 px-2 font-medium">Students</th>
                  <th className="text-left py-3 px-2 font-medium hidden md:table-cell">Session</th>
                  <th className="text-left py-3 px-2 font-medium hidden md:table-cell">Status</th>
                  <th className="text-right py-3 px-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {current.map(c => {
                  const enrolled = getEnrolled(c);
                  return (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer" onClick={() => navigate(`/class/${c.id}`)}>
                      <td className="py-3 px-2 font-medium text-[hsl(var(--kp-teal))]">{c.grade_level} - {c.section}</td>
                      <td className="py-3 px-2 text-gray-600">{c.adviser_name || '—'}</td>
                      <td className="py-3 px-2 text-gray-600">{c.room || '—'}</td>
                      <td className="py-3 px-2 text-gray-600">{enrolled}/{c.capacity}</td>
                      <td className="py-3 px-2 text-gray-600 hidden md:table-cell">{c.session}</td>
                      <td className="py-3 px-2 hidden md:table-cell"><StatusBadge status={c.status} /></td>
                      <td className="py-3 px-2 text-right" onClick={e => e.stopPropagation()}>
                        <ActionMenu items={[
                          { label: 'Edit', icon: Pencil, onClick: () => openEdit(c) },
                          { label: 'Delete', icon: Trash2, onClick: () => handleDelete(c), className: 'text-[hsl(var(--kp-red))]' },
                        ]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
      </PagePanel>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editMode ? 'Edit Class' : 'Create New Class'}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{editMode ? 'Update class details' : 'Add Class to your School'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Academic Year</label><input value={form.academic_year} onChange={e => setForm({ ...form, academic_year: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Grade Level</label><input value={form.grade_level} onChange={e => setForm({ ...form, grade_level: e.target.value })} placeholder="e.g. Grade 1" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Section</label><input value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} placeholder="e.g. Mansanitas" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Adviser</label><input value={form.adviser_name} onChange={e => setForm({ ...form, adviser_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Classroom</label><input value={form.room} onChange={e => setForm({ ...form, room: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Capacity</label><input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Session</label><select value={form.session} onChange={e => setForm({ ...form, session: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"><option>Whole Day</option><option>Morning</option><option>Afternoon</option></select></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Status</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
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