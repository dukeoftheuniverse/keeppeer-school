import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { PagePanel, KpButton, StatusBadge, EmptyState } from '@/components/kp/ui';
import { Plus, MoreVertical, Upload, Info, Pencil, Trash2, Check } from 'lucide-react';
import { logAudit } from '@/lib/audit';
import { IDCardFront } from '@/components/kp/IDCardPreview';

const THEMES = {
  blue: { primary_color: '#0056D2', footer_text: 'Be Respectful. Be Responsible. Be a KeepPeer.' },
  green: { primary_color: '#166534', footer_text: 'Excellence. Integrity. Service.' },
  white: { primary_color: '#0EA5E9', footer_text: 'Learn Today. Lead Tomorrow.' },
  navy: { primary_color: '#1E293B', footer_text: 'Innovate. Create. Elevate.' },
  teal: { primary_color: '#004D5A', footer_text: 'Be Respectful. Be Responsible. Be a KeepPeer.' },
};

const BACKGROUND_PRESETS = [
  { name: 'Blue Wave', theme: 'blue' },
  { name: 'Green Wave', theme: 'green' },
  { name: 'Dark Blue Geometric', theme: 'navy' },
  { name: 'White Minimal', theme: 'white' },
  { name: 'Blue Yellow Accent', theme: 'blue' },
  { name: 'Navy Gold', theme: 'navy' },
];

export default function TemplateManager() {
  const [tab, setTab] = useState('student');
  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);
  const [selectedBg, setSelectedBg] = useState('blue');

  const load = () => {
    setLoading(true);
    base44.entities.IDCardTemplate.list('-created_date').then(res => setTemplates(res)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = templates.filter(t =>
    (tab === 'student' ? t.template_type === 'student' : t.template_type === 'employee') &&
    (t.name?.toLowerCase().includes(search.toLowerCase()) || true)
  );

  const handleCreate = async (data) => {
    await base44.entities.IDCardTemplate.create({
      name: data.name,
      template_type: tab,
      primary_color: data.primary_color,
      expiry_months: data.expiry_months || 12,
      fields: 'name,photo,id,qr',
    });
    logAudit('create_template', 'IDCardTemplate', '', `Created ${data.name}`);
    setShowCreate(false);
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.IDCardTemplate.delete(id);
    setMenuOpen(null);
    load();
  };

  return (
    <div className="space-y-5">
      {/* Templates Section */}
      <PagePanel>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-[hsl(var(--kp-teal))]">ID Card Templates</h2>
            <p className="text-xs text-gray-500">Create, customize, and manage ID card templates for students and teachers.</p>
          </div>
          <KpButton variant="green" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> Create Template</KpButton>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex gap-1 border-b border-gray-100">
            {['student', 'employee'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-[hsl(var(--kp-teal))] text-[hsl(var(--kp-teal))]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                {t === 'student' ? 'Student Templates' : 'Teacher Templates'}
              </button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..."
            className="sm:ml-auto w-full sm:w-64 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">Loading templates...</div>
        ) : filtered.length === 0 ? (
          <EmptyState message="No templates yet. Click 'Create Template' to add one." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {filtered.map(tpl => {
              const theme = THEMES[tpl.primary_color] || { primary_color: tpl.primary_color || '#004D5A', footer_text: tpl.fields || 'Be Respectful.' };
              const sample = { name: 'Sample Name', type: tpl.template_type, grade: 'Grade 7', section: 'A', lrn: '13600125001', photo_url: '', qr_id: 'SAMPLE' };
              return (
                <div key={tpl.id} className="relative rounded-xl border border-gray-100 bg-white overflow-hidden group">
                  <div className="relative p-3">
                    <IDCardFront person={sample} school={{ school_name: 'KeepPeer Elementary School', academic_year: '2026-2027', school_id: '100567' }} cardNumber="ID-00000001" template={theme} />
                  </div>
                  <div className="px-3 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-700">{tpl.name}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">Updated: {new Date(tpl.updated_date || tpl.created_date).toLocaleDateString()}</div>
                      </div>
                      <StatusBadge status="active" />
                    </div>
                  </div>
                  <button onClick={() => setMenuOpen(menuOpen === tpl.id ? null : tpl.id)}
                    className="absolute bottom-3 right-3 p-1.5 rounded-md hover:bg-gray-100 text-gray-400">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {menuOpen === tpl.id && (
                    <div className="absolute bottom-12 right-3 z-10 w-32 rounded-lg border border-gray-100 bg-white shadow-lg py-1">
                      <button onClick={() => { setMenuOpen(null); }} className="w-full px-3 py-1.5 text-left text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-2"><Pencil className="w-3 h-3" /> Edit</button>
                      <button onClick={() => handleDelete(tpl.id)} className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"><Trash2 className="w-3 h-3" /> Delete</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PagePanel>

      {/* Backgrounds Section */}
      <PagePanel>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-[hsl(var(--kp-teal))]">ID Backgrounds</h2>
            <p className="text-xs text-gray-500">Upload and manage background designs for your ID cards.</p>
          </div>
          <KpButton variant="green"><Upload className="w-4 h-4" /> Upload Background</KpButton>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {BACKGROUND_PRESETS.map((bg, i) => {
            const isActive = selectedBg === bg.theme + i;
            return (
              <div key={i} className="relative">
                <div onClick={() => setSelectedBg(bg.theme + i)}
                  className={`aspect-[1.585/1] rounded-lg overflow-hidden cursor-pointer relative border-2 ${isActive ? 'border-[hsl(var(--kp-teal))]' : 'border-gray-100'}`}>
                  <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${THEMES[bg.theme].primary_color}, ${THEMES[bg.theme].primary_color}cc)` }}>
                    <div className="w-full h-full opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 30%, white 0%, transparent 40%), radial-gradient(circle at 70% 70%, white 0%, transparent 40%)' }} />
                  </div>
                  {isActive && (
                    <>
                      <div className="absolute top-1.5 left-1.5"><StatusBadge status="active" /></div>
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[hsl(var(--kp-teal))] flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>
                    </>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); }} className="absolute bottom-1.5 right-1.5 p-1 rounded-md bg-white/80 text-gray-500 hover:bg-white"><MoreVertical className="w-3 h-3" /></button>
                </div>
                <div className="text-[10px] text-gray-500 mt-1.5 text-center">{bg.name}</div>
                <div className="text-[9px] text-gray-300 text-center">Uploaded: Jul {17 - i}, 2026</div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 rounded-lg bg-blue-50 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-600">Note: Uploaded backgrounds will be available when creating or editing ID card templates.</p>
        </div>
      </PagePanel>

      {showCreate && <CreateTemplateModal tab={tab} onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
    </div>
  );
}

function CreateTemplateModal({ tab, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [theme, setTheme] = useState('blue');
  const [expiry, setExpiry] = useState(12);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-[hsl(var(--kp-teal))] mb-4">New {tab === 'student' ? 'Student' : 'Teacher'} Template</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Template Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Default Student ID"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
          </div>
          <div>
            <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Theme Color</label>
            <div className="flex gap-2">
              {Object.entries(THEMES).map(([key, t]) => (
                <button key={key} onClick={() => setTheme(key)}
                  className={`w-8 h-8 rounded-full border-2 ${theme === key ? 'border-gray-800' : 'border-transparent'}`}
                  style={{ background: t.primary_color }} title={key} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Expiry (months)</label>
            <input type="number" value={expiry} onChange={e => setExpiry(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <KpButton variant="light" onClick={onClose}>Cancel</KpButton>
          <KpButton variant="green" disabled={!name.trim()} onClick={() => onCreate({ name, primary_color: THEMES[theme].primary_color, expiry_months: expiry })}>Create Template</KpButton>
        </div>
      </div>
    </div>
  );
}