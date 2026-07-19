import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { PagePanel, PageTitle, KpButton, KpInput, KpSelect } from '@/components/kp/ui';
import { Upload, Save, Building2, Clock } from 'lucide-react';
import RolloverTool from '@/components/kp/RolloverTool';

export default function SchoolProfile() {
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('details');

  useEffect(() => {
    base44.entities.School.list().then(res => {
      setSchool(res[0] || { school_name: '', school_id: '', school_type: '', school_level: '', division: '', district: '', principal: '', mobile_number: '', email: '', address: '', academic_year: '2026-2027', school_hours: '7:00 AM - 5:00 PM', logo_url: '' });
    }).finally(() => setLoading(false));
  }, []);

  const update = (field, value) => setSchool({ ...school, [field]: value });

  const handleSave = async () => {
    setSaving(true);
    try {
      if (school.id) await base44.entities.School.update(school.id, school);
      else await base44.entities.School.create(school);
    } finally { setSaving(false); }
  };

  const handleLogo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    update('logo_url', file_url);
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-4">
      <PageTitle>School Profile</PageTitle>
      <PagePanel>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden">
              {school.logo_url ? <img src={school.logo_url} alt="logo" className="w-full h-full object-cover" /> : <Building2 className="w-8 h-8 text-gray-300" />}
            </div>
            <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-[hsl(var(--kp-teal))] rounded-full flex items-center justify-center cursor-pointer shadow-md">
              <Upload className="w-3.5 h-3.5 text-white" />
              <input type="file" className="hidden" onChange={handleLogo} accept="image/*" />
            </label>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-[hsl(var(--kp-teal))]">{school.school_name || 'School Name'}</h2>
            <p className="text-sm text-gray-500">{school.school_type || '—'} • ID: {school.school_id || '—'}</p>
          </div>
          <KpSelect value={school.academic_year} onChange={e => update('academic_year', e.target.value)} className="w-40">
            <option>2026-2027</option>
            <option>2025-2026</option>
            <option>2024-2025</option>
          </KpSelect>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto kp-no-scrollbar">
          <button onClick={() => setTab('details')} className="whitespace-nowrap" className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tab === 'details' ? 'bg-[hsl(var(--kp-teal))] text-white' : 'bg-white border border-gray-200 text-[hsl(var(--kp-teal))]'}`}>School Details</button>
          <button onClick={() => setTab('hours')} className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${tab === 'hours' ? 'bg-[hsl(var(--kp-teal))] text-white' : 'bg-white border border-gray-200 text-[hsl(var(--kp-teal))]'}`}>School Hours</button>
          <button onClick={() => setTab('academic')} className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${tab === 'academic' ? 'bg-[hsl(var(--kp-teal))] text-white' : 'bg-white border border-gray-200 text-[hsl(var(--kp-teal))]'}`}>Academic Year</button>
        </div>

        {tab === 'details' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <KpInput label="School Name" value={school.school_name} onChange={e => update('school_name', e.target.value)} />
            <KpInput label="School ID" value={school.school_id} onChange={e => update('school_id', e.target.value)} />
            <KpInput label="School Type" value={school.school_type} onChange={e => update('school_type', e.target.value)} placeholder="e.g. Public Elementary School" />
            <KpSelect label="School Level" value={school.school_level} onChange={e => update('school_level', e.target.value)}>
              <option value="">Select level</option>
              <option>Elementary</option>
              <option>Junior High School</option>
              <option>Senior High School</option>
              <option>Integrated</option>
            </KpSelect>
            <KpInput label="Division" value={school.division} onChange={e => update('division', e.target.value)} />
            <KpInput label="District or Cluster" value={school.district} onChange={e => update('district', e.target.value)} />
            <KpInput label="Principal or School Head" value={school.principal} onChange={e => update('principal', e.target.value)} />
            <KpInput label="Mobile Number" value={school.mobile_number} onChange={e => update('mobile_number', e.target.value)} />
            <KpInput label="Email" value={school.email} onChange={e => update('email', e.target.value)} />
            <KpInput label="School Address" value={school.address} onChange={e => update('address', e.target.value)} className="sm:col-span-2" />
          </div>
        )}

        {tab === 'hours' && (
          <div className="space-y-4 max-w-md">
            <div className="flex items-center gap-2 text-[hsl(var(--kp-teal))]">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">School Hours</span>
            </div>
            <KpInput label="Daily Schedule" value={school.school_hours} onChange={e => update('school_hours', e.target.value)} placeholder="e.g. 7:00 AM - 5:00 PM" />
            <p className="text-xs text-gray-400">Set the standard operating hours for the school. This will be used for attendance calculations.</p>
          </div>
        )}

        {tab === 'academic' && (
          <RolloverTool school={school} onDone={() => {}} />
        )}

        {tab !== 'academic' && (
        <div className="flex justify-end mt-6">
          <KpButton variant="green" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
          </KpButton>
        </div>
        )}
      </PagePanel>
    </div>
  );
}