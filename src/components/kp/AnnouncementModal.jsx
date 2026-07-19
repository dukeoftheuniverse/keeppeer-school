import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { PagePanel, KpButton, KpInput, KpSelect } from '@/components/kp/ui';
import { Megaphone, X, Loader2, AlertTriangle, CloudRain } from 'lucide-react';
import { logAudit } from '@/lib/audit';

export default function AnnouncementModal({ open, onClose, onCreated, defaultAudience = 'school', defaultClass = '', user }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('normal');
  const [category, setCategory] = useState('school_announcement');
  const [audience, setAudience] = useState(defaultAudience);
  const [targetClass, setTargetClass] = useState(defaultClass);
  const [classes, setClasses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setAudience(defaultAudience);
      setTargetClass(defaultClass);
      setTitle(''); setContent(''); setPriority('normal'); setCategory('school_announcement'); setError(null);
    }
  }, [open, defaultAudience, defaultClass]);

  useEffect(() => {
    base44.entities.Class.list().then(setClasses).catch(() => {});
  }, []);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true); setError(null);
    try {
      const record = {
        title: title.trim(),
        content: content.trim(),
        date: new Date().toLocaleDateString('en-CA'),
        priority,
        category,
        audience,
        target_class: audience === 'class' ? targetClass : '',
        author_id: user?.id || '',
        author_name: user?.full_name || 'Administrator',
      };
      const created = await base44.entities.Announcement.create(record);
      logAudit('create_announcement', 'Announcement', created.id, `${title} (${audience})`);
      onCreated?.(created);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create announcement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-[hsl(var(--kp-teal))] flex items-center gap-2">
            <Megaphone className="w-5 h-5" /> Record Announcement
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {error && <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</div>}

          <KpInput label="Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. No Classes Tomorrow Due to Typhoon" autoFocus />

          <div>
            <label className="text-xs font-medium text-[hsl(var(--kp-teal))] mb-1 block">Message</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={4} placeholder="Announcement details..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <KpSelect label="Category" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="school_announcement">School Announcement</option>
              <option value="class_announcement">Class Announcement</option>
              <option value="weather_alert">Weather Alert</option>
              <option value="event">Event</option>
            </KpSelect>
            <KpSelect label="Priority" value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </KpSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <KpSelect label="Audience" value={audience} onChange={e => setAudience(e.target.value)}>
              <option value="school">School-wide</option>
              <option value="class">Specific Class</option>
              <option value="teacher">Teacher</option>
            </KpSelect>
            {audience === 'class' && (
              <KpSelect label="Target Class" value={targetClass} onChange={e => setTargetClass(e.target.value)}>
                <option value="">Select class</option>
                {classes.map(c => <option key={c.id} value={`${c.grade_level} - ${c.section}`}>{c.grade_level} - {c.section}</option>)}
              </KpSelect>
            )}
          </div>

          {category === 'weather_alert' && (
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-600 flex items-center gap-2">
              <CloudRain className="w-4 h-4" /> Weather alerts are also shown on the dashboard safety monitor.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <KpButton type="button" variant="light" onClick={onClose}>Cancel</KpButton>
            <KpButton type="submit" variant="green" disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Posting...</> : <><Megaphone className="w-4 h-4" /> Post Announcement</>}
            </KpButton>
          </div>
        </form>
      </div>
    </div>
  );
}