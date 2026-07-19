import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { PagePanel, PageTitle, KpButton, StatusBadge, SearchInput, Pagination, EmptyState, KpSelect } from '@/components/kp/ui';
import Drawer from '@/components/kp/Drawer';
import ActionMenu from '@/components/kp/ActionMenu';
import DbCombobox from '@/components/kp/DbCombobox';
import { Plus, Pencil, Trash2, LayoutGrid, Users, Percent, UserSquare, Eye, Archive, DoorOpen, Building2 } from 'lucide-react';
import { logAudit } from '@/lib/audit';

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

const defaultClassForm = () => ({ academic_year: '2026-2027', grade_level: '', section: '', adviser_name: '', adviser_id: '', room: '', room_id: '', capacity: 40, session: 'Whole Day', status: 'active' });
const defaultRoomForm = () => ({ name: '', room_code: '', building: '', floor: '', capacity: 40, type: 'classroom', status: 'available' });

export default function GradeSection() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('classes');
  const [classes, setClasses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(defaultClassForm());
  const [roomDrawerOpen, setRoomDrawerOpen] = useState(false);
  const [roomEditMode, setRoomEditMode] = useState(false);
  const [roomForm, setRoomForm] = useState(defaultRoomForm());
  const [opts, setOpts] = useState({ advisers: [], rooms: [] });

  const load = () => {
    setLoading(true);
    Promise.all([
      base44.entities.Class.list(),
      base44.entities.Room.list().catch(() => []),
      base44.entities.Student.list(),
      base44.entities.Employee.list().catch(() => []),
    ]).then(([c, r, s, e]) => {
      setClasses(c); setRooms(r); setStudents(s); setEmployees(e);
      const uniq = (arr) => [...new Set(arr.filter(Boolean))];
      setOpts({
        advisers: uniq(e.map(em => `${em.first_name} ${em.last_name}`.trim())),
        rooms: uniq(r.map(rm => rm.name)),
      });
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // ===== Classes tab =====
  const filteredClasses = classes.filter(c => {
    const name = `${c.grade_level} ${c.section}`.toLowerCase();
    return name.includes(search.toLowerCase()) && (!academicYear || c.academic_year === academicYear);
  });
  const totalPagesC = Math.ceil(filteredClasses.length / 10) || 1;
  const currentClasses = filteredClasses.slice((page - 1) * 10, page * 10);

  const totalStudents = students.length;
  const totalClasses = classes.length;
  const avgClassSize = totalClasses > 0 ? Math.round(totalStudents / totalClasses) : 0;

  const getEnrolled = (c) => students.filter(s => s.grade === c.grade_level && s.section === c.section && s.enrollment_status !== 'archived').length;
  const getClassSchedule = (c) => {
    const sched = classes.filter(x => x.grade_level === c.grade_level && x.section === c.section);
    return c.session ? c.session : '—';
  };

  const openAddClass = () => { setEditMode(false); setForm(defaultClassForm()); setDrawerOpen(true); };
  const openEditClass = (c) => { setEditMode(true); setForm(c); setDrawerOpen(true); };

  const handleSaveClass = async () => {
    if (!form.grade_level || !form.section) return;
    // resolve adviser id
    let adviserId = form.adviser_id;
    if (form.adviser_name && !adviserId) {
      const emp = employees.find(e => `${e.first_name} ${e.last_name}`.trim() === form.adviser_name);
      if (emp) adviserId = emp.id;
    }
    const room = rooms.find(r => r.name === form.room);
    const payload = { ...form, adviser_id: adviserId || '', room_id: room?.id || '', academic_year: form.academic_year || academicYear };
    if (editMode) await base44.entities.Class.update(form.id, payload);
    else await base44.entities.Class.create(payload);
    logAudit(editMode ? 'update_class' : 'create_class', 'Class', form.id || '', `${payload.grade_level} - ${payload.section}`);
    setDrawerOpen(false);
    load();
  };

  const handleArchive = async (c) => {
    if (!confirm(`Archive ${c.grade_level} - ${c.section}?`)) return;
    await base44.entities.Class.update(c.id, { status: 'inactive' });
    logAudit('archive_class', 'Class', c.id, `${c.grade_level} - ${c.section}`);
    load();
  };

  const handleDeleteClass = async (c) => {
    if (!confirm(`Delete ${c.grade_level} - ${c.section}? This cannot be undone.`)) return;
    await base44.entities.Class.delete(c.id);
    logAudit('delete_class', 'Class', c.id, `${c.grade_level} - ${c.section}`);
    load();
  };

  // ===== Classrooms (Rooms) tab =====
  const filteredRooms = rooms.filter(r => {
    const name = `${r.name} ${r.room_code || ''} ${r.building || ''}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });
  const totalPagesR = Math.ceil(filteredRooms.length / 10) || 1;
  const currentRooms = filteredRooms.slice((page - 1) * 10, page * 10);

  const assignedClasses = (r) => classes.filter(c => c.room === r.name).length;

  const openAddRoom = () => { setRoomEditMode(false); setRoomForm(defaultRoomForm()); setRoomDrawerOpen(true); };
  const openEditRoom = (r) => { setRoomEditMode(true); setRoomForm(r); setRoomDrawerOpen(true); };

  const handleSaveRoom = async () => {
    if (!roomForm.name) return;
    if (roomEditMode) await base44.entities.Room.update(roomForm.id, roomForm);
    else await base44.entities.Room.create(roomForm);
    logAudit(roomEditMode ? 'update_room' : 'create_room', 'Room', roomForm.id || '', roomForm.name);
    setRoomDrawerOpen(false);
    load();
  };

  const handleDeleteRoom = async (r) => {
    const count = assignedClasses(r);
    if (count > 0) { alert(`Cannot delete "${r.name}" — it is assigned to ${count} class(es). Reassign those classes first.`); return; }
    if (!confirm(`Delete classroom "${r.name}"?`)) return;
    await base44.entities.Room.delete(r.id);
    logAudit('delete_room', 'Room', r.id, r.name);
    load();
  };

  const resetPage = () => setPage(1);

  return (
    <div className="space-y-4">
      <PageTitle>Classes & Classrooms</PageTitle>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={LayoutGrid} label="Total Classes" value={totalClasses} sub="All sections" />
        <StatCard icon={DoorOpen} label="Total Classrooms" value={rooms.length} sub="Rooms available" />
        <StatCard icon={Users} label="Total Students" value={totalStudents.toLocaleString()} sub="Enrolled students" />
        <StatCard icon={UserSquare} label="Average Class Size" value={avgClassSize} sub="Students per class" />
      </div>

      <PagePanel>
        {/* Tabs */}
        <div className="flex gap-1.5 mb-4">
          {[{ id: 'classes', label: 'Classes', icon: LayoutGrid }, { id: 'classrooms', label: 'Classrooms', icon: DoorOpen }].map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); resetPage(); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium ${tab === t.id ? 'bg-[hsl(var(--kp-teal))] text-white' : 'bg-gray-50 text-[hsl(var(--kp-teal))] hover:bg-gray-100'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'classes' && (
          <>
            {/* Toolbar with prominent Add Class button */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4 items-stretch sm:items-center">
              <KpSelect value={academicYear} onChange={e => { setAcademicYear(e.target.value); resetPage(); }} className="w-40">
                <option>2026-2027</option>
                <option>2025-2026</option>
                <option>2024-2025</option>
              </KpSelect>
              <SearchInput value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} placeholder="Search class name, section..." className="flex-1" />
              <KpButton variant="green" onClick={openAddClass} className="h-10 px-5 text-sm shadow-sm">
                <Plus className="w-5 h-5" /> Add Class
              </KpButton>
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : currentClasses.length === 0 ? (
              <EmptyState message="No classes found. Click 'Add Class' to create one." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-400">
                      <th className="text-left py-3 px-2 font-medium">Class Name</th>
                      <th className="text-left py-3 px-2 font-medium">Grade Level</th>
                      <th className="text-left py-3 px-2 font-medium">Section</th>
                      <th className="text-left py-3 px-2 font-medium hidden md:table-cell">Adviser</th>
                      <th className="text-left py-3 px-2 font-medium hidden lg:table-cell">Classroom</th>
                      <th className="text-left py-3 px-2 font-medium">Students</th>
                      <th className="text-left py-3 px-2 font-medium hidden md:table-cell">Capacity</th>
                      <th className="text-left py-3 px-2 font-medium hidden lg:table-cell">Schedule</th>
                      <th className="text-left py-3 px-2 font-medium">Status</th>
                      <th className="text-right py-3 px-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentClasses.map((c, idx) => {
                      const enrolled = getEnrolled(c);
                      return (
                        <tr key={c.id} className={`border-b border-gray-50 hover:bg-[#E0F7FA]/40 cursor-pointer ${idx % 2 === 1 ? 'bg-[#F0FAFB]/50' : ''}`} onClick={() => navigate(`/class/${c.id}`)}>
                          <td className="py-3 px-2 font-medium text-[hsl(var(--kp-teal))]">{c.grade_level} - {c.section}</td>
                          <td className="py-3 px-2 text-gray-600">{c.grade_level}</td>
                          <td className="py-3 px-2 text-gray-600">{c.section}</td>
                          <td className="py-3 px-2 text-gray-600 hidden md:table-cell">{c.adviser_name || '—'}</td>
                          <td className="py-3 px-2 text-gray-600 hidden lg:table-cell">{c.room || '—'}</td>
                          <td className="py-3 px-2">
                            <span className={`font-medium ${enrolled >= (c.capacity || 0) ? 'text-[hsl(var(--kp-orange))]' : 'text-gray-700'}`}>{enrolled}</span>
                            <span className="text-gray-400">/{c.capacity || '—'}</span>
                          </td>
                          <td className="py-3 px-2 text-gray-600 hidden md:table-cell">{c.capacity || '—'}</td>
                          <td className="py-3 px-2 text-gray-600 hidden lg:table-cell">{getClassSchedule(c)}</td>
                          <td className="py-3 px-2"><StatusBadge status={c.status} /></td>
                          <td className="py-3 px-2 text-right" onClick={e => e.stopPropagation()}>
                            <ActionMenu items={[
                              { label: 'View', icon: Eye, onClick: () => navigate(`/class/${c.id}`) },
                              { label: 'Edit', icon: Pencil, onClick: () => openEditClass(c) },
                              { label: c.status === 'inactive' ? 'Unarchive' : 'Archive', icon: Archive, onClick: () => handleArchive(c) },
                              { label: 'Delete', icon: Trash2, onClick: () => handleDeleteClass(c), className: 'text-[hsl(var(--kp-red))]' },
                            ]} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {filteredClasses.length > 0 && <Pagination page={page} totalPages={totalPagesC} onPageChange={setPage} />}
          </>
        )}

        {tab === 'classrooms' && (
          <>
            {/* Toolbar with prominent Add Classroom button */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4 items-stretch sm:items-center">
              <SearchInput value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} placeholder="Search room name, code, building..." className="flex-1" />
              <KpButton variant="green" onClick={openAddRoom} className="h-10 px-5 text-sm shadow-sm">
                <Plus className="w-5 h-5" /> Add Classroom
              </KpButton>
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : currentRooms.length === 0 ? (
              <EmptyState message="No classrooms found. Click 'Add Classroom' to create one." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-400">
                      <th className="text-left py-3 px-2 font-medium">Room Name</th>
                      <th className="text-left py-3 px-2 font-medium hidden md:table-cell">Room Code</th>
                      <th className="text-left py-3 px-2 font-medium hidden lg:table-cell">Building</th>
                      <th className="text-left py-3 px-2 font-medium hidden md:table-cell">Floor</th>
                      <th className="text-left py-3 px-2 font-medium">Capacity</th>
                      <th className="text-left py-3 px-2 font-medium hidden md:table-cell">Room Type</th>
                      <th className="text-left py-3 px-2 font-medium">Assigned Classes</th>
                      <th className="text-left py-3 px-2 font-medium">Status</th>
                      <th className="text-right py-3 px-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRooms.map((r, idx) => (
                      <tr key={r.id} className={`border-b border-gray-50 hover:bg-[#E0F7FA]/40 ${idx % 2 === 1 ? 'bg-[#F0FAFB]/50' : ''}`}>
                        <td className="py-3 px-2 font-medium text-[hsl(var(--kp-teal))] flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-gray-400" />{r.name}</td>
                        <td className="py-3 px-2 text-gray-600 hidden md:table-cell font-mono text-xs">{r.room_code || '—'}</td>
                        <td className="py-3 px-2 text-gray-600 hidden lg:table-cell">{r.building || '—'}</td>
                        <td className="py-3 px-2 text-gray-600 hidden md:table-cell">{r.floor || '—'}</td>
                        <td className="py-3 px-2 text-gray-600">{r.capacity || '—'}</td>
                        <td className="py-3 px-2 hidden md:table-cell"><span className="capitalize text-gray-600">{r.type}</span></td>
                        <td className="py-3 px-2"><span className="font-medium text-gray-700">{assignedClasses(r)}</span></td>
                        <td className="py-3 px-2"><StatusBadge status={r.status} /></td>
                        <td className="py-3 px-2 text-right">
                          <ActionMenu items={[
                            { label: 'Edit', icon: Pencil, onClick: () => openEditRoom(r) },
                            { label: 'Delete', icon: Trash2, onClick: () => handleDeleteRoom(r), className: 'text-[hsl(var(--kp-red))]' },
                          ]} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {filteredRooms.length > 0 && <Pagination page={page} totalPages={totalPagesR} onPageChange={setPage} />}
          </>
        )}
      </PagePanel>

      {/* Add/Edit Class Drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editMode ? 'Edit Class' : 'Add Class'}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{editMode ? 'Update class details' : 'Create a new class for your school'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Academic Year</label><input value={form.academic_year} onChange={e => setForm({ ...form, academic_year: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Grade Level</label><input value={form.grade_level} onChange={e => setForm({ ...form, grade_level: e.target.value })} placeholder="e.g. Grade 1" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Section Name</label><input value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} placeholder="e.g. Mansanitas" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div className="col-span-2"><DbCombobox label="Adviser" value={form.adviser_name} onChange={v => setForm({ ...form, adviser_name: v })} options={opts.advisers} placeholder="Search or type adviser name" /></div>
            <div className="col-span-2"><DbCombobox label="Classroom" value={form.room} onChange={v => setForm({ ...form, room: v })} options={opts.rooms} placeholder="Search or type classroom" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Capacity</label><input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Session</label><select value={form.session} onChange={e => setForm({ ...form, session: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"><option>Whole Day</option><option>Morning</option><option>Afternoon</option></select></div>
            <div className="col-span-2"><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Schedule Notes</label><input value={form.schedule || ''} onChange={e => setForm({ ...form, schedule: e.target.value })} placeholder="e.g. Mon-Fri 8:00 AM - 4:00 PM" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Status</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
          </div>
          <div className="flex gap-3 pt-2">
            <KpButton variant="light" className="flex-1" onClick={() => setDrawerOpen(false)}>Cancel</KpButton>
            <KpButton variant="green" className="flex-1" onClick={handleSaveClass}>{editMode ? 'Update Class' : 'Create Class'}</KpButton>
          </div>
        </div>
      </Drawer>

      {/* Add/Edit Classroom Drawer */}
      <Drawer open={roomDrawerOpen} onClose={() => setRoomDrawerOpen(false)} title={roomEditMode ? 'Edit Classroom' : 'Add Classroom'}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{roomEditMode ? 'Update classroom details' : 'Register a new classroom/room'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Room Name</label><input value={roomForm.name} onChange={e => setRoomForm({ ...roomForm, name: e.target.value })} placeholder="e.g. Room 101" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Room Code</label><input value={roomForm.room_code} onChange={e => setRoomForm({ ...roomForm, room_code: e.target.value })} placeholder="e.g. R-101" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Building</label><input value={roomForm.building} onChange={e => setRoomForm({ ...roomForm, building: e.target.value })} placeholder="e.g. Main Building" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Floor</label><input value={roomForm.floor} onChange={e => setRoomForm({ ...roomForm, floor: e.target.value })} placeholder="e.g. 1st" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Capacity</label><input type="number" value={roomForm.capacity} onChange={e => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" /></div>
            <div><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Room Type</label><select value={roomForm.type} onChange={e => setRoomForm({ ...roomForm, type: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"><option value="classroom">Classroom</option><option value="laboratory">Laboratory</option><option value="gymnasium">Gymnasium</option><option value="library">Library</option><option value="office">Office</option></select></div>
            <div className="col-span-2"><label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Status</label><select value={roomForm.status} onChange={e => setRoomForm({ ...roomForm, status: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"><option value="available">Available</option><option value="occupied">Occupied</option><option value="maintenance">Maintenance</option></select></div>
          </div>
          <div className="flex gap-3 pt-2">
            <KpButton variant="light" className="flex-1" onClick={() => setRoomDrawerOpen(false)}>Cancel</KpButton>
            <KpButton variant="green" className="flex-1" onClick={handleSaveRoom}>{roomEditMode ? 'Update Classroom' : 'Create Classroom'}</KpButton>
          </div>
        </div>
      </Drawer>
    </div>
  );
}