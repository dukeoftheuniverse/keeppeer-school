import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { PagePanel, PageTitle, KpButton, StatusBadge, Avatar, SearchInput, Pagination, EmptyState } from '@/components/kp/ui';
import Drawer from '@/components/kp/Drawer';
import ActionMenu from '@/components/kp/ActionMenu';
import { KeyRound, Settings2, Pencil, Lock, Unlock, Trash2, Check, X } from 'lucide-react';

export default function UserAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', access_level: 'teacher', status: 'active' });

  const load = () => {
    setLoading(true);
    base44.entities.Employee.list().then(setAccounts).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = accounts.filter(a => {
    const name = `${a.first_name} ${a.last_name}`.toLowerCase();
    return name.includes(search.toLowerCase()) || (a.email || '').toLowerCase().includes(search.toLowerCase());
  });
  const perPage = 10;
  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const current = filtered.slice((page - 1) * perPage, page * perPage);

  const openActions = (acc) => { setSelected(acc); setDrawerOpen(true); };

  const toggleStatus = async (acc) => {
    await base44.entities.Employee.update(acc.id, { status: acc.status === 'active' ? 'inactive' : 'active' });
    load();
  };

  const handleDelete = async (acc) => {
    if (!confirm(`Remove system access for ${acc.first_name} ${acc.last_name}? The employee record will be kept.`)) return;
    await base44.entities.Employee.update(acc.id, { status: 'inactive' });
    setDrawerOpen(false);
    load();
  };

  const handleAdd = async () => {
    if (!form.first_name || !form.last_name) return;
    await base44.entities.Employee.create({
      ...form,
      employee_id: 'EMP' + Date.now().toString().slice(-8),
      position: form.access_level === 'admin' ? 'Administrator' : 'Teacher',
    });
    setAddOpen(false);
    setForm({ first_name: '', last_name: '', email: '', access_level: 'teacher', status: 'active' });
    load();
  };

  return (
    <div className="space-y-4">
      <PageTitle>User Accounts</PageTitle>
      <PagePanel>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <SearchInput value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="flex-1" />
          <div className="flex gap-2">
            <KpButton variant="outline" onClick={() => setSelected(null) || setDrawerOpen(true)}><Settings2 className="w-4 h-4" /> Actions</KpButton>
            <KpButton variant="green" onClick={() => setAddOpen(true)}><KeyRound className="w-4 h-4" /> Add Access</KpButton>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : current.length === 0 ? (
          <EmptyState message="No user accounts found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400">
                  <th className="text-left py-3 px-2 font-medium">Employee</th>
                  <th className="text-left py-3 px-2 font-medium">Access</th>
                  <th className="text-left py-3 px-2 font-medium">Status</th>
                  <th className="text-right py-3 px-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {current.map(acc => (
                  <tr key={acc.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={`${acc.first_name} ${acc.last_name}`} src={acc.photo_url} />
                        <div>
                          <div className="font-medium text-gray-700">{acc.first_name} {acc.last_name}</div>
                          <div className="text-xs text-gray-400">{acc.email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2"><StatusBadge status={acc.access_level} /></td>
                    <td className="py-3 px-2"><StatusBadge status={acc.status} /></td>
                    <td className="py-3 px-2 text-right">
                      <ActionMenu items={[
                        { label: 'Edit Access', icon: Pencil, onClick: () => openActions(acc) },
                        { label: 'Reset Password', icon: KeyRound, onClick: () => alert('Password reset link sent') },
                        { label: acc.status === 'active' ? 'Deactivate' : 'Activate', icon: acc.status === 'active' ? Lock : Unlock, onClick: () => toggleStatus(acc) },
                        { label: 'Delete', icon: Trash2, onClick: () => handleDelete(acc), className: 'text-[hsl(var(--kp-red))]' },
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

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Actions">
        {selected ? (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-gray-50 text-center">
              <Avatar name={`${selected.first_name} ${selected.last_name}`} src={selected.photo_url} size="w-16 h-16 mx-auto" />
              <div className="mt-2 font-medium text-gray-700">{selected.first_name} {selected.last_name}</div>
              <div className="text-xs text-gray-400">{selected.email}</div>
            </div>
            {[
              { label: 'Edit Access', icon: Pencil },
              { label: 'Change Password', icon: KeyRound },
              { label: selected.status === 'active' ? 'Deactivate' : 'Activate', icon: selected.status === 'active' ? Lock : Check },
              { label: 'Delete', icon: Trash2, danger: true },
            ].map((item, i) => (
              <button key={i} onClick={() => item.danger ? handleDelete(selected) : item.label.includes('Activate') ? toggleStatus(selected) : null}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${item.danger ? 'border-red-200 text-[hsl(var(--kp-red))] hover:bg-red-50' : 'border-gray-200 text-[hsl(var(--kp-teal))] hover:bg-gray-50'}`}>
                <item.icon className="w-4 h-4" /> {item.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {['Access', 'Change Pass', 'Active', 'Delete'].map((label, i) => (
              <button key={i} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-[hsl(var(--kp-teal))] hover:bg-gray-50">
                {label}
              </button>
            ))}
          </div>
        )}
      </Drawer>

      <Drawer open={addOpen} onClose={() => setAddOpen(false)} title="Add Access">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">First Name</label>
              <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Last Name</label>
              <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
          </div>
          <div>
            <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Access Level</label>
            <select value={form.access_level} onChange={e => setForm({ ...form, access_level: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
              <option value="admin">Admin</option>
              <option value="teacher">Teacher</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <KpButton variant="light" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</KpButton>
            <KpButton variant="green" className="flex-1" onClick={handleAdd}>Create Access</KpButton>
          </div>
        </div>
      </Drawer>
    </div>
  );
}