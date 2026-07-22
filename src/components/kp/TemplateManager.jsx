import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { PagePanel, KpButton, StatusBadge, EmptyState } from '@/components/kp/ui';
import { Plus, MoreVertical, Upload, Info, Pencil, Trash2, Check, Loader2, Image as ImageIcon, RotateCcw, RectangleHorizontal, RectangleVertical, LayoutTemplate } from 'lucide-react';
import { logAudit } from '@/lib/audit';
import { toast } from '@/components/ui/use-toast';
import { IDCardFront, IDCardBack } from '@/components/kp/IDCardPreview';
import TemplateDesigner from '@/components/kp/TemplateDesigner';

const SAMPLE_LOGO = 'https://media.base44.com/images/public/6a599666b848d4d07cd0e975/af88c433d_generated_image.png';

const THEMES = {
  blue: { primary_color: '#0056D2', footer_text: 'Be Respectful. Be Responsible. Be a KeepPeer.' },
  green: { primary_color: '#166534', footer_text: 'Excellence. Integrity. Service.' },
  sky: { primary_color: '#0EA5E9', footer_text: 'Learn Today. Lead Tomorrow.' },
  navy: { primary_color: '#1E293B', footer_text: 'Innovate. Create. Elevate.' },
  teal: { primary_color: '#004D5A', footer_text: 'Be Respectful. Be Responsible. Be a KeepPeer.' },
};

const SAMPLE_TEMPLATES = [
  { name: 'Classic Blue Student', template_type: 'student', orientation: 'landscape', primary_color: '#0056D2', footer_text: 'Be Respectful. Be Responsible. Be a KeepPeer.', logo_url: SAMPLE_LOGO, expiry_months: 12 },
  { name: 'Forest Green Student', template_type: 'student', orientation: 'landscape', primary_color: '#166534', footer_text: 'Excellence. Integrity. Service.', logo_url: SAMPLE_LOGO, expiry_months: 12 },
  { name: 'Sky Youth Student', template_type: 'student', orientation: 'portrait', primary_color: '#0EA5E9', footer_text: 'Learn Today. Lead Tomorrow.', logo_url: SAMPLE_LOGO, expiry_months: 12 },
  { name: 'Scholar Navy Student', template_type: 'student', orientation: 'portrait', primary_color: '#1E293B', footer_text: 'Innovate. Create. Elevate.', logo_url: SAMPLE_LOGO, expiry_months: 12 },
  { name: 'Royal Violet Student', template_type: 'student', orientation: 'portrait', primary_color: '#6D28D9', footer_text: 'Dream Big. Learn Bigger.', logo_url: SAMPLE_LOGO, expiry_months: 12 },
  { name: 'Sunrise Amber Student', template_type: 'student', orientation: 'landscape', primary_color: '#C2410C', footer_text: 'Rise and Shine to Learn.', logo_url: SAMPLE_LOGO, expiry_months: 12 },
  { name: 'KeepPeer Teal Teacher', template_type: 'employee', orientation: 'landscape', primary_color: '#004D5A', footer_text: 'Be Respectful. Be Responsible. Be a KeepPeer.', logo_url: SAMPLE_LOGO, expiry_months: 24 },
  { name: 'Premium Navy Teacher', template_type: 'employee', orientation: 'portrait', primary_color: '#1E293B', footer_text: 'Excellence in Education.', logo_url: SAMPLE_LOGO, expiry_months: 24 },
  { name: 'Crimson Faculty Teacher', template_type: 'employee', orientation: 'portrait', primary_color: '#991B1B', footer_text: 'Teach. Inspire. Transform.', logo_url: SAMPLE_LOGO, expiry_months: 24 },
  { name: 'Ocean Staff Teacher', template_type: 'employee', orientation: 'landscape', primary_color: '#075985', footer_text: 'Guiding Future Leaders.', logo_url: SAMPLE_LOGO, expiry_months: 24 },
];

const SAMPLE_BACKGROUNDS = [
  { name: 'Blue Wave', url: '', gradient: 'linear-gradient(135deg, #0056D2, #0056D2cc)', date: 'Jul 10, 2026' },
  { name: 'Green Wave', url: '', gradient: 'linear-gradient(135deg, #166534, #166534cc)', date: 'Jul 8, 2026' },
  { name: 'Dark Blue Geometric', url: '', gradient: 'linear-gradient(135deg, #1E293B, #334155)', date: 'Jul 5, 2026' },
  { name: 'White Minimal', url: '', gradient: 'linear-gradient(135deg, #f8fafc, #e2e8f0)', date: 'Jul 3, 2026' },
  { name: 'Teal Accent', url: '', gradient: 'linear-gradient(135deg, #004D5A, #0EA5E9)', date: 'Jul 1, 2026' },
  { name: 'Navy Gold', url: '', gradient: 'linear-gradient(135deg, #1E293B, #D4A017)', date: 'Jun 28, 2026' },
];

const BG_STORAGE_KEY = 'kp_id_backgrounds';

export default function TemplateManager() {
  const [tab, setTab] = useState('student');
  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);
  const [backgrounds, setBackgrounds] = useState(SAMPLE_BACKGROUNDS);
  const [selectedBg, setSelectedBg] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [applying, setApplying] = useState(null);
  const [designing, setDesigning] = useState(null);
  const [school, setSchool] = useState(null);
  const fileInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      let res = await base44.entities.IDCardTemplate.list('-created_date');
      if (res.length === 0) {
        // Seed sample templates (mark first of each type as default)
        const seeded = await base44.entities.IDCardTemplate.bulkCreate(
          SAMPLE_TEMPLATES.map((t, i) => ({ ...t, is_default: i === 0 || i === 6 }))
        );
        res = seeded;
      }
      // Ensure each type has exactly one default
      const hasStudentDefault = res.some(t => t.template_type === 'student' && t.is_default);
      const hasEmployeeDefault = res.some(t => t.template_type === 'employee' && t.is_default);
      if (!hasStudentDefault || !hasEmployeeDefault) {
        const updates = [];
        if (!hasStudentDefault) {
          const s = res.find(t => t.template_type === 'student');
          if (s) { await base44.entities.IDCardTemplate.update(s.id, { is_default: true }); s.is_default = true; }
        }
        if (!hasEmployeeDefault) {
          const e = res.find(t => t.template_type === 'employee');
          if (e) { await base44.entities.IDCardTemplate.update(e.id, { is_default: true }); e.is_default = true; }
        }
      }
      setTemplates(res);
    } catch (e) { /* */ }
    setLoading(false);
  };

  const loadBackgrounds = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(BG_STORAGE_KEY) || '[]');
      setBackgrounds([...stored, ...SAMPLE_BACKGROUNDS]);
    } catch (e) { setBackgrounds(SAMPLE_BACKGROUNDS); }
  };

  useEffect(() => {
    load();
    loadBackgrounds();
    base44.entities.School.list().then(res => setSchool(res[0] || null)).catch(() => {});
  }, []);

  const filtered = templates.filter(t =>
    (tab === 'student' ? t.template_type === 'student' : t.template_type === 'employee') &&
    (t.name?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCreate = async (data) => {
    await base44.entities.IDCardTemplate.create({
      name: data.name,
      template_type: tab,
      orientation: data.orientation,
      primary_color: data.primary_color,
      accent_color: data.accent_color,
      font_color: data.font_color,
      footer_text: data.footer_text,
      school_name_override: data.school_name_override || '',
      logo_url: data.logo_url || SAMPLE_LOGO,
      background_url: data.background_url || '',
      photo_shape: data.photo_shape || 'circle',
      show_qr: data.show_qr !== false,
      show_photo: data.show_photo !== false,
      show_grade: data.show_grade !== false,
      show_id_number: data.show_id_number !== false,
      expiry_months: data.expiry_months || 12,
      fields: 'name,photo,id,qr',
    });
    logAudit('create_template', 'IDCardTemplate', '', `Created ${data.name} (${data.orientation})`);
    setShowCreate(false);
    load();
  };

  const handleApplyDefault = async (tpl) => {
    setApplying(tpl.id);
    try {
      // Unset all same-type templates, then set this one as default
      const sameType = templates.filter(t => t.template_type === tpl.template_type && t.id !== tpl.id);
      await base44.entities.IDCardTemplate.bulkUpdate(sameType.map(t => ({ id: t.id, is_default: false })));
      await base44.entities.IDCardTemplate.update(tpl.id, { is_default: true });
      logAudit('apply_default_template', 'IDCardTemplate', tpl.id, `Set "${tpl.name}" as default ${tpl.template_type} template`);
      setMenuOpen(null);
      load();
    } catch (e) { /* */ }
    setApplying(null);
  };

  const handleEdit = (tpl) => {
    setMenuOpen(null);
    setEditing(tpl);
  };

  const handleDesign = (tpl) => {
    setMenuOpen(null);
    setDesigning(tpl);
  };

  const handleSaveDesign = async (data) => {
    if (designing) {
      await base44.entities.IDCardTemplate.update(designing.id, {
        name: data.name,
        orientation: data.orientation,
        primary_color: data.primary_color,
        accent_color: data.accent_color,
        font_color: data.font_color,
        header_font: data.header_font,
        body_font: data.body_font,
        logo_url: data.logo_url,
        background_url: data.background_url,
        layout: data.layout,
      });
      logAudit('design_template', 'IDCardTemplate', designing.id, `Designed ${data.name} layout`);
    }
    setDesigning(null);
    load();
  };

  const handleSaveEdit = async (data) => {
    if (editing) {
      await base44.entities.IDCardTemplate.update(editing.id, {
        name: data.name,
        orientation: data.orientation,
        primary_color: data.primary_color,
        accent_color: data.accent_color,
        font_color: data.font_color,
        footer_text: data.footer_text,
        school_name_override: data.school_name_override || '',
        background_url: data.background_url || '',
        logo_url: data.logo_url || SAMPLE_LOGO,
        photo_shape: data.photo_shape || 'circle',
        show_qr: data.show_qr !== false,
        show_photo: data.show_photo !== false,
        show_grade: data.show_grade !== false,
        show_id_number: data.show_id_number !== false,
        expiry_months: data.expiry_months || 12,
      });
      logAudit('update_template', 'IDCardTemplate', editing.id, `Updated ${data.name}`);
    }
    setEditing(null);
    load();
  };

  const handleDelete = async (id) => {
    const tpl = templates.find(t => t.id === id);
    await base44.entities.IDCardTemplate.delete(id);
    // If we deleted the default, promote another of the same type
    if (tpl?.is_default) {
      const remaining = await base44.entities.IDCardTemplate.list('-created_date');
      const next = remaining.find(t => t.template_type === tpl.template_type);
      if (next) await base44.entities.IDCardTemplate.update(next.id, { is_default: true });
    }
    setMenuOpen(null);
    load();
  };

  const handleUploadBackground = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const stored = JSON.parse(localStorage.getItem(BG_STORAGE_KEY) || '[]');
      const newBg = { name: file.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Custom Background', url: file_url, gradient: '', date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) };
      stored.unshift(newBg);
      localStorage.setItem(BG_STORAGE_KEY, JSON.stringify(stored));
      loadBackgrounds();
      setSelectedBg(0);
    } catch (err) {
      toast({ title: 'Background upload failed', description: String(err?.message || err), variant: 'destructive' });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteBackground = (idx) => {
    if (idx >= SAMPLE_BACKGROUNDS.length) {
      const stored = JSON.parse(localStorage.getItem(BG_STORAGE_KEY) || '[]');
      stored.splice(idx - SAMPLE_BACKGROUNDS.length, 1);
      localStorage.setItem(BG_STORAGE_KEY, JSON.stringify(stored));
      loadBackgrounds();
    }
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

        <div className="mb-4 p-3 rounded-lg bg-[hsl(var(--accent))] flex items-start gap-2">
          <Info className="w-4 h-4 text-[hsl(var(--kp-teal))] shrink-0 mt-0.5" />
          <p className="text-xs text-[hsl(var(--kp-teal))]">Click <span className="font-semibold">Apply</span> on any template to set it as the default for that category. The applied template is automatically used when generating new IDs in the Generator. Only one template per category (Student / Teacher) can be the default at a time.</p>
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
          <EmptyState message="No templates match your search." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {filtered.map(tpl => {
              const theme = { primary_color: tpl.primary_color || '#004D5A', accent_color: tpl.accent_color || tpl.primary_color || '#2BB5C6', font_color: tpl.font_color || '#1f2937', footer_text: tpl.footer_text || 'Be Respectful.', logo_url: tpl.logo_url || SAMPLE_LOGO, orientation: tpl.orientation || 'landscape', background_url: tpl.background_url || '', photo_shape: tpl.photo_shape || 'circle', show_qr: tpl.show_qr !== false, show_photo: tpl.show_photo !== false, show_grade: tpl.show_grade !== false, show_id_number: tpl.show_id_number !== false, school_name_override: tpl.school_name_override || '' };
              const sample = { name: 'Juan Dela Cruz', type: tpl.template_type, grade: 'Grade 7', section: 'A', lrn: '13600125001', photo_url: '', qr_id: 'KP-SAMPLE-001' };
              return (
                <div key={tpl.id} className="relative rounded-xl kp-glass-card overflow-hidden group">
                  <div className="relative p-3">
                    <IDCardFront person={sample} school={{ school_name: 'KeepPeer Elementary School', academic_year: '2026-2027', school_id: '100567', logo_url: tpl.logo_url || SAMPLE_LOGO }} cardNumber="ID-00000001" template={theme} />
                  </div>
                  <div className="px-3 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-700 truncate">{tpl.name}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                          <span className="capitalize">{tpl.orientation || 'landscape'}</span>
                          <span>•</span>
                          <span>Updated: {new Date(tpl.updated_date || tpl.created_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {tpl.is_default ? (
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[hsl(var(--kp-green))]/15 text-[hsl(var(--kp-green))]"><Check className="w-2.5 h-2.5" /> Default</span>
                      ) : (
                        <span className="shrink-0 text-[10px] text-gray-300">Inactive</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2.5">
                      {tpl.is_default ? (
                        <div className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium text-[hsl(var(--kp-green))] bg-[hsl(var(--kp-green))]/10 flex items-center justify-center gap-1"><Check className="w-3 h-3" /> Applied</div>
                      ) : (
                        <button onClick={() => handleApplyDefault(tpl)} disabled={applying === tpl.id}
                          className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium bg-[hsl(var(--kp-teal))] text-white hover:bg-[hsl(var(--kp-teal-dark))] flex items-center justify-center gap-1 disabled:opacity-50">
                          {applying === tpl.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Apply
                        </button>
                      )}
                      <button onClick={() => handleDesign(tpl)} className="px-2 py-1.5 rounded-lg text-[11px] font-medium border border-[hsl(var(--kp-teal))]/30 text-[hsl(var(--kp-teal))] hover:bg-[hsl(var(--accent))] flex items-center gap-1"><LayoutTemplate className="w-3 h-3" /> Design</button>
                      <button onClick={() => handleEdit(tpl)} className="px-2 py-1.5 rounded-lg text-[11px] font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit</button>
                      <button onClick={() => setMenuOpen(menuOpen === tpl.id ? null : tpl.id)}
                        className="px-2 py-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {menuOpen === tpl.id && (
                    <div className="absolute bottom-14 right-3 z-10 w-36 rounded-lg kp-glass-card shadow-lg py-1">
                      <button onClick={() => handleEdit(tpl)} className="w-full px-3 py-1.5 text-left text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-2"><Pencil className="w-3 h-3" /> Edit Template</button>
                      <button onClick={() => handleApplyDefault(tpl)} className="w-full px-3 py-1.5 text-left text-xs text-[hsl(var(--kp-teal))] hover:bg-[hsl(var(--accent))] flex items-center gap-2"><Check className="w-3 h-3" /> Set as Default</button>
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
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUploadBackground} className="hidden" />
          <KpButton variant="green" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4" /> Upload Background</>}
          </KpButton>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {backgrounds.map((bg, i) => {
            const isActive = selectedBg === i;
            const isCustom = !!bg.url;
            return (
              <div key={i} className="relative">
                <div onClick={() => setSelectedBg(i)}
                  className={`aspect-[1.585/1] rounded-lg overflow-hidden cursor-pointer relative border-2 ${isActive ? 'border-[hsl(var(--kp-teal))]' : 'border-gray-100'}`}>
                  {bg.url ? (
                    <img src={bg.url} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full relative" style={{ background: bg.gradient }}>
                      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 30%, white 0%, transparent 40%), radial-gradient(circle at 70% 70%, white 0%, transparent 40%)' }} />
                    </div>
                  )}
                  {isActive && (
                    <>
                      <div className="absolute top-1.5 left-1.5"><StatusBadge status="active" /></div>
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[hsl(var(--kp-teal))] flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>
                    </>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); if (isCustom) deleteBackground(i); }} className="absolute bottom-1.5 right-1.5 p-1 rounded-md bg-white/80 text-gray-500 hover:bg-white">
                    <MoreVertical className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-[10px] text-gray-500 mt-1.5 text-center truncate">{bg.name}</div>
                <div className="text-[9px] text-gray-300 text-center">{isCustom ? 'Uploaded' : 'Uploaded'}: {bg.date}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 rounded-lg bg-blue-50 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-600">Note: Uploaded backgrounds will be available when creating or editing ID card templates.</p>
        </div>
      </PagePanel>

      {showCreate && <CreateTemplateModal tab={tab} onClose={() => setShowCreate(false)} onCreate={handleCreate} backgrounds={backgrounds} />}
      {editing && <CreateTemplateModal tab={tab} template={editing} onClose={() => setEditing(null)} onCreate={handleSaveEdit} backgrounds={backgrounds} />}
      {designing && <TemplateDesigner template={designing} school={school} tab={tab} onClose={() => setDesigning(null)} onSave={handleSaveDesign} />}
    </div>
  );
}

function CreateTemplateModal({ tab, onClose, onCreate, backgrounds, template }) {
  const isEdit = !!template;
  const initialThemeKey = template
    ? Object.entries(THEMES).find(([, v]) => v.primary_color.toLowerCase() === (template.primary_color || '').toLowerCase())?.[0] || 'teal'
    : 'blue';
  const [name, setName] = useState(template?.name || '');
  const [theme, setTheme] = useState(initialThemeKey);
  const [orientation, setOrientation] = useState(template?.orientation || 'landscape');
  const [expiry, setExpiry] = useState(template?.expiry_months || 12);
  const [footer, setFooter] = useState(template?.footer_text || THEMES[initialThemeKey].footer_text);
  const [useBg, setUseBg] = useState(template?.background_url ? backgrounds.findIndex(b => b.url === template.background_url) : null);
  const [customColor, setCustomColor] = useState(template && !Object.values(THEMES).some(v => v.primary_color.toLowerCase() === (template.primary_color || '').toLowerCase()) ? template.primary_color : '');
  const [accentColor, setAccentColor] = useState(template?.accent_color || '');
  const [fontColor, setFontColor] = useState(template?.font_color || '#1f2937');
  const [schoolName, setSchoolName] = useState(template?.school_name_override || '');
  const [logoUrl, setLogoUrl] = useState(template?.logo_url || SAMPLE_LOGO);
  const [photoShape, setPhotoShape] = useState(template?.photo_shape || 'circle');
  const [showQr, setShowQr] = useState(template ? template.show_qr !== false : true);
  const [showPhoto, setShowPhoto] = useState(template ? template.show_photo !== false : true);
  const [showGrade, setShowGrade] = useState(template ? template.show_grade !== false : true);
  const [showId, setShowId] = useState(template ? template.show_id_number !== false : true);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const activeColor = customColor || THEMES[theme].primary_color;
  const resolvedAccent = accentColor || activeColor;

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setLogoUrl(file_url);
    } catch (err) {
      toast({ title: 'Logo upload failed', description: String(err?.message || err), variant: 'destructive' });
    }
    setUploadingLogo(false);
  };

  const sample = { name: 'Juan Dela Cruz', type: tab, grade: 'Grade 7', section: 'A', lrn: '13600125001', photo_url: '', qr_id: 'KP-SAMPLE-001' };
  const previewTemplate = {
    primary_color: activeColor,
    accent_color: resolvedAccent,
    font_color: fontColor,
    footer_text: footer,
    school_name_override: schoolName,
    logo_url: logoUrl,
    orientation,
    background_url: useBg !== null && backgrounds[useBg] ? backgrounds[useBg].url : (template?.background_url || ''),
    photo_shape: photoShape,
    show_qr: showQr, show_photo: showPhoto, show_grade: showGrade, show_id_number: showId,
  };

  const ColorSwatch = ({ value, onChange }) => (
    <div className="relative w-8 h-8 rounded-full border-2 border-gray-200 overflow-hidden shrink-0">
      <input type="color" value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 w-full h-full cursor-pointer opacity-0" />
      <div className="w-full h-full" style={{ background: value }} />
    </div>
  );

  const Toggle = ({ checked, onChange, label }) => (
    <label className="flex items-center justify-between gap-2 cursor-pointer">
      <span className="text-xs text-gray-600">{label}</span>
      <button type="button" onClick={() => onChange(!checked)} className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-[hsl(var(--kp-green))]' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="kp-panel rounded-2xl shadow-xl w-full max-w-4xl p-5 max-h-[92vh] overflow-y-auto kp-scroll-thin" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-[hsl(var(--kp-teal))] mb-4">{isEdit ? 'Edit' : 'New'} {tab === 'student' ? 'Student' : 'Teacher'} Template</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Template Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Default Student ID"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Orientation</label>
              <div className="flex gap-2">
                <button onClick={() => setOrientation('landscape')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 border ${orientation === 'landscape' ? 'border-[hsl(var(--kp-teal))] bg-[hsl(var(--accent))] text-[hsl(var(--kp-teal))]' : 'border-gray-200 text-gray-500'}`}>
                  <RectangleHorizontal className="w-4 h-4" /> Landscape
                </button>
                <button onClick={() => setOrientation('portrait')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 border ${orientation === 'portrait' ? 'border-[hsl(var(--kp-teal))] bg-[hsl(var(--accent))] text-[hsl(var(--kp-teal))]' : 'border-gray-200 text-gray-500'}`}>
                  <RectangleVertical className="w-4 h-4" /> Portrait
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Theme Color (primary)</label>
              <div className="flex gap-2 flex-wrap items-center">
                {Object.entries(THEMES).map(([key, t]) => (
                  <button key={key} onClick={() => { setTheme(key); setFooter(t.footer_text); setCustomColor(''); }}
                    className={`w-8 h-8 rounded-full border-2 ${(customColor ? '' : theme === key) ? 'border-gray-800' : 'border-transparent'}`}
                    style={{ background: t.primary_color }} title={key} />
                ))}
                <ColorSwatch value={activeColor} onChange={setCustomColor} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Accent Color</label>
                <div className="flex items-center gap-2">
                  <ColorSwatch value={resolvedAccent} onChange={setAccentColor} />
                  <span className="text-[10px] text-gray-400 font-mono">{resolvedAccent}</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Text Color</label>
                <div className="flex items-center gap-2">
                  <ColorSwatch value={fontColor} onChange={setFontColor} />
                  <span className="text-[10px] text-gray-400 font-mono">{fontColor}</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">School Name Override</label>
              <input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Leave blank to use school profile"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Footer Text</label>
              <input value={footer} onChange={e => setFooter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Logo</label>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                  {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover" /> : <ImageIcon className="w-4 h-4 text-gray-400" />}
                </div>
                <label className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-[hsl(var(--kp-teal))] hover:bg-gray-50 cursor-pointer">
                  {uploadingLogo ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</> : <><Upload className="w-3 h-3" /> Upload Logo</>}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>
                {logoUrl && logoUrl !== SAMPLE_LOGO && <button onClick={() => setLogoUrl(SAMPLE_LOGO)} className="text-xs text-gray-400 hover:text-gray-600">Reset</button>}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Photo Shape</label>
              <div className="flex gap-2">
                <button onClick={() => setPhotoShape('circle')} className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border ${photoShape === 'circle' ? 'border-[hsl(var(--kp-teal))] bg-[hsl(var(--accent))] text-[hsl(var(--kp-teal))]' : 'border-gray-200 text-gray-500'}`}>Circle</button>
                <button onClick={() => setPhotoShape('square')} className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border ${photoShape === 'square' ? 'border-[hsl(var(--kp-teal))] bg-[hsl(var(--accent))] text-[hsl(var(--kp-teal))]' : 'border-gray-200 text-gray-500'}`}>Square</button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Background (optional)</label>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setUseBg(null)} className={`px-2.5 py-1 rounded-md text-xs border ${useBg === null ? 'border-[hsl(var(--kp-teal))] text-[hsl(var(--kp-teal))] bg-[hsl(var(--accent))]' : 'border-gray-200 text-gray-400'}`}>None</button>
                {backgrounds.slice(0, 8).map((bg, i) => (
                  <button key={i} onClick={() => setUseBg(i)} title={bg.name}
                    className={`w-8 h-8 rounded-md border-2 ${useBg === i ? 'border-gray-800' : 'border-gray-200'} overflow-hidden`}>
                    {bg.url ? <img src={bg.url} className="w-full h-full object-cover" /> : <div className="w-full h-full" style={{ background: bg.gradient }} />}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1.5 block">Visible Fields</label>
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                <Toggle checked={showPhoto} onChange={setShowPhoto} label="Photo" />
                <Toggle checked={showQr} onChange={setShowQr} label="QR Code" />
                <Toggle checked={showGrade} onChange={setShowGrade} label="Grade / Position" />
                <Toggle checked={showId} onChange={setShowId} label="ID Number" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Expiry (months)</label>
              <input type="number" value={expiry} onChange={e => setExpiry(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-2 block">Live Preview</label>
            <div className="bg-gray-50 rounded-xl p-4 sticky top-0">
              <IDCardFront person={sample} school={{ school_name: 'KeepPeer Elementary School', academic_year: '2026-2027', school_id: '100567', logo_url: SAMPLE_LOGO }} cardNumber="ID-00000001" template={previewTemplate} />
              <div className="mt-3">
                <IDCardBack person={sample} school={{ school_name: 'KeepPeer Elementary School', academic_year: '2026-2027', school_id: '100567', logo_url: SAMPLE_LOGO }} template={previewTemplate} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5 justify-end">
          <KpButton variant="light" onClick={onClose}>Cancel</KpButton>
          <KpButton variant="green" disabled={!name.trim()} onClick={() => onCreate({
            name, primary_color: activeColor, accent_color: resolvedAccent, font_color: fontColor, footer_text: footer,
            school_name_override: schoolName, orientation, expiry_months: expiry,
            background_url: useBg !== null && backgrounds[useBg] ? backgrounds[useBg].url : (template?.background_url || ''),
            logo_url: logoUrl, photo_shape: photoShape,
            show_qr: showQr, show_photo: showPhoto, show_grade: showGrade, show_id_number: showId,
          })}>{isEdit ? 'Save Changes' : 'Create Template'}</KpButton>
        </div>
      </div>
    </div>
  );
}