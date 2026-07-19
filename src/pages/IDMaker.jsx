import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { PagePanel, PageTitle, KpButton, StatusBadge, Avatar, EmptyState } from '@/components/kp/ui';
import { Search, QrCode, Loader2, Printer, ArrowLeft, Download, ScanLine, CheckCircle2, Clock, ArrowRight, FileText, LayoutTemplate } from 'lucide-react';
import { logAudit } from '@/lib/audit';
import { IDCardFront, IDCardBack } from '@/components/kp/IDCardPreview';
import TemplateManager from '@/components/kp/TemplateManager';

export default function IDMaker() {
  const [view, setView] = useState('generator'); // generator | templates
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('student');
  const [results, setResults] = useState([]);
  const [allPeople, setAllPeople] = useState([]);
  const [selected, setSelected] = useState(null);
  const [school, setSchool] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generatedCard, setGeneratedCard] = useState(null);
  const [todayLogs, setTodayLogs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    base44.entities.School.list().then(res => setSchool(res[0])).catch(() => {});
    base44.entities.IDCardTemplate.list('-created_date').then(res => {
      setTemplates(res);
      setSelectedTemplate(res[0] || null);
    }).catch(() => {});
    const loadPeople = () => {
      Promise.all([base44.entities.Student.list(), base44.entities.Employee.list()])
        .then(([students, employees]) => {
          const people = [
            ...students.map(s => ({ ...s, type: 'student', name: `${s.first_name} ${s.last_name}` })),
            ...employees.map(e => ({ ...e, type: 'employee', name: `${e.first_name} ${e.last_name}` })),
          ];
          setAllPeople(people);
          setResults(people);
        }).catch(() => {});
    };
    loadPeople();
    base44.entities.Attendance.list('-created_date', 10).then(setTodayLogs).catch(() => {});
  }, []);

  // Live search filter
  useEffect(() => {
    if (!query.trim()) { setResults(allPeople); return; }
    const q = query.toLowerCase();
    setResults(allPeople.filter(p =>
      p.type === (searchType === 'student' ? 'student' : 'employee') &&
      (p.name.toLowerCase().includes(q) || (p.lrn || '').toLowerCase().includes(q) || (p.student_id || '').toLowerCase().includes(q) || (p.employee_id || '').toLowerCase().includes(q))
    ));
  }, [query, searchType, allPeople]);

  // Auto-select the default template for the current person type
  useEffect(() => {
    if (!templates.length) return;
    const def = templates.find(t => t.template_type === searchType && t.is_default);
    if (def) setSelectedTemplate(def);
  }, [searchType, templates]);

  const filteredResults = results.filter(p => p.type === (searchType === 'student' ? 'student' : 'employee'));

  const handleGenerate = async () => {
    if (!selected) return;
    setGenerating(true);
    setGeneratedCard(null);
    // Simulate processing time
    await new Promise(r => setTimeout(r, 1200));
    const cardNumber = 'ID-' + Date.now().toString().slice(-8);
    const qrCode = selected.qr_id || `KP-${selected.id?.slice(-6) || Date.now().toString().slice(-6)}`;
    const issueDate = new Date().toLocaleDateString('en-CA');
    const expiryDate = new Date(new Date().getFullYear() + 1, 5, 30).toLocaleDateString('en-CA');
    try {
      const card = await base44.entities.GeneratedIDCard.create({
        person_id: selected.id, person_name: selected.name, person_type: selected.type,
        card_number: cardNumber, qr_code: qrCode, status: 'issued', issue_date: issueDate, expiry_date: expiryDate,
      });
      if (selected.type === 'student') {
        await base44.entities.Student.update(selected.id, { id_card_id: cardNumber, qr_id: qrCode });
      } else {
        await base44.entities.Employee.update(selected.id, { id_card_id: cardNumber });
      }
      logAudit('generate_id', 'GeneratedIDCard', selected.id, `${selected.name} - ${cardNumber}`);
      setGeneratedCard({ ...card, cardNumber, qrCode });
    } catch (e) {
      setGeneratedCard({ cardNumber, qrCode, error: true });
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = (side) => {
    const front = document.getElementById('id-front');
    const back = document.getElementById('id-back');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Print ID - ${selected?.name}</title><style>@page{size:landscape;margin:0}body{display:flex;gap:20px;justify-content:center;padding:20px;font-family:sans-serif}</style></head><body>`);
    if (side !== 'back' && front) w.document.write(`<div>${front.innerHTML}</div>`);
    if (side !== 'front' && back) w.document.write(`<div>${back.innerHTML}</div>`);
    w.document.write('</body></html>');
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const downloadPreview = () => {
    const el = document.getElementById('id-preview-area');
    if (!el) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>ID Preview - ${selected?.name}</title><style>body{font-family:sans-serif;padding:24px;background:#f8fafc}</style></head><body>${el.innerHTML}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ID-Preview-${selected?.name?.replace(/\s/g, '_')}.html`;
    a.click();
  };

  const template = selectedTemplate
    ? {
        primary_color: selectedTemplate.primary_color,
        accent_color: selectedTemplate.accent_color || selectedTemplate.primary_color,
        font_color: selectedTemplate.font_color || '#1f2937',
        footer_text: selectedTemplate.footer_text,
        school_name_override: selectedTemplate.school_name_override,
        logo_url: selectedTemplate.logo_url,
        orientation: selectedTemplate.orientation,
        background_url: selectedTemplate.background_url,
        photo_shape: selectedTemplate.photo_shape || 'circle',
        show_qr: selectedTemplate.show_qr !== false,
        show_photo: selectedTemplate.show_photo !== false,
        show_grade: selectedTemplate.show_grade !== false,
        show_id_number: selectedTemplate.show_id_number !== false,
      }
    : { primary_color: '#0056D2', footer_text: 'Be Respectful. Be Responsible. Be a KeepPeer.' };
  const today = new Date().toLocaleDateString('en-CA');
  const todayEntries = todayLogs.filter(a => a.date === today && a.person_type === 'student' && a.scan_type === 'time_in');
  const todayExits = todayLogs.filter(a => a.date === today && a.person_type === 'student' && a.scan_type === 'time_out');

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageTitle>Auto ID Generator</PageTitle>
        <div className="flex gap-1.5 bg-white/70 rounded-xl p-1">
          <button onClick={() => setView('generator')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${view === 'generator' ? 'bg-[hsl(var(--kp-teal))] text-white' : 'text-gray-500'}`}><FileText className="w-4 h-4" /> Generator</button>
          <button onClick={() => setView('templates')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${view === 'templates' ? 'bg-[hsl(var(--kp-teal))] text-white' : 'text-gray-500'}`}><LayoutTemplate className="w-4 h-4" /> Templates</button>
        </div>
      </div>

      {view === 'templates' ? <TemplateManager /> : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Search + Generate */}
          <div className="lg:col-span-4 space-y-4">
            <PagePanel>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-[hsl(var(--kp-teal))] text-white text-xs font-bold flex items-center justify-center">1</span>
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">Search Student or Teacher</h3>
              </div>

              <div className="flex gap-1 border-b border-gray-100 mb-3">
                {['student', 'employee'].map(t => (
                  <button key={t} onClick={() => { setSearchType(t); setSelected(null); setGeneratedCard(null); }}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${searchType === t ? 'border-[hsl(var(--kp-teal))] text-[hsl(var(--kp-teal))]' : 'border-transparent text-gray-400'}`}>
                    {t === 'student' ? 'Students' : 'Teachers'}
                  </button>
                ))}
              </div>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder={searchType === 'student' ? "Enter LRN or name..." : "Enter ID or name..."}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto kp-scroll-thin">
                {filteredResults.length === 0 ? <EmptyState message="No matching records" /> : filteredResults.slice(0, 20).map(p => (
                  <button key={p.id} onClick={() => { setSelected(p); setGeneratedCard(null); }}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${selected?.id === p.id ? 'border-[hsl(var(--kp-teal))] bg-[hsl(var(--accent))]' : 'border-gray-100 hover:bg-gray-50'}`}>
                    <Avatar name={p.name} src={p.photo_url} size="w-10 h-10" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-700 truncate">{p.name}</div>
                      <div className="text-[11px] text-gray-400">{searchType === 'student' ? `LRN: ${p.lrn || '—'}` : `ID: ${p.employee_id || '—'}`}</div>
                      {p.grade && <div className="text-[11px] text-gray-400">{p.grade} • DOB: {p.birth_date || '—'}</div>}
                    </div>
                    <StatusBadge status={searchType === 'student' ? p.enrollment_status : p.status} />
                  </button>
                ))}
              </div>
            </PagePanel>

            {selected && (
              <PagePanel>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-[hsl(var(--kp-teal))] text-white text-xs font-bold flex items-center justify-center">2</span>
                  <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">Generate ID</h3>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 mb-3">
                  <Avatar name={selected.name} src={selected.photo_url} size="w-12 h-12" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-700">{selected.name}</div>
                    <div className="text-xs text-gray-400">{searchType === 'student' ? `LRN: ${selected.lrn || '—'}` : `ID: ${selected.employee_id || '—'}`}</div>
                  </div>
                  <StatusBadge status="active" />
                </div>
                <KpButton variant="green" onClick={handleGenerate} disabled={generating} className="w-full py-2.5">
                  {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating ID, please wait...</> : <><QrCode className="w-4 h-4" /> Generate ID</>}
                </KpButton>
                {generating && (
                  <div className="mt-3 flex flex-col items-center gap-2 py-4">
                    <Loader2 className="w-8 h-8 text-[hsl(var(--kp-teal))] animate-spin" />
                    <p className="text-xs text-gray-400">Generating ID, please wait...</p>
                  </div>
                )}
                {generatedCard && !generating && (
                  <div className="mt-3 p-2.5 rounded-lg bg-green-50 border border-green-200 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-green-700">
                      <span className="font-semibold">ID Generated!</span><br />
                      Card No: <span className="font-mono">{generatedCard.cardNumber}</span>
                    </div>
                  </div>
                )}
              </PagePanel>
            )}
          </div>

          {/* Right: Preview */}
          <div className="lg:col-span-8">
            <PagePanel>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">ID Card Preview</h3>
                <div className="flex items-center gap-2">
                  {templates.length > 0 && (
                    <select value={selectedTemplate?.id || ''} onChange={e => setSelectedTemplate(templates.find(t => t.id === e.target.value))}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15">
                      {templates.filter(t => t.template_type === searchType).map(t => (
                        <option key={t.id} value={t.id}>{t.name} — {t.orientation || 'landscape'}{t.is_default ? ' (Default)' : ''}</option>
                      ))}
                    </select>
                  )}
                  {selected && generatedCard && (
                    <KpButton variant="outline" onClick={downloadPreview}><Download className="w-4 h-4" /> Download Preview</KpButton>
                  )}
                </div>
              </div>

              {!selected ? (
                <div className="text-center py-16 text-gray-400">
                  <QrCode className="w-14 h-14 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Search and select a student or teacher to preview the ID card</p>
                </div>
              ) : (
                <div id="id-preview-area" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-400 mb-2 font-medium">Front</div>
                      <div id="id-front"><IDCardFront person={selected} school={school} cardNumber={generatedCard?.cardNumber} template={template} /></div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-2 font-medium">Back</div>
                      <div id="id-back"><IDCardBack person={selected} school={school} template={template} /></div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                    <KpButton variant="light" onClick={() => { setSelected(null); setGeneratedCard(null); }}><ArrowLeft className="w-4 h-4" /> Back to Search</KpButton>
                    <KpButton variant="outline" onClick={() => handlePrint('front')}><Printer className="w-4 h-4" /> Print</KpButton>
                    <KpButton variant="green" onClick={() => handlePrint('both')}><Printer className="w-4 h-4" /> Print Both Sides</KpButton>
                  </div>
                </div>
              )}
            </PagePanel>

            {/* Smart Attendance Info Bar */}
            <PagePanel className="mt-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[hsl(var(--kp-teal))] flex items-center justify-center shrink-0"><ScanLine className="w-5 h-5 text-white" /></div>
                  <div>
                    <h4 className="text-sm font-bold text-[hsl(var(--kp-teal))]">Smart Attendance with QR</h4>
                    <p className="text-xs text-gray-500 max-w-md">Tap or scan the QR code at the gate's RFID/QR scanner. The system will automatically record the student's attendance with date and time.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:ml-auto">
                  <TimelineNode label="Entry Recorded" time="8:00 AM" active={todayEntries.length > 0} />
                  <ArrowRight className="w-4 h-4 text-gray-300 hidden sm:block" />
                  <TimelineNode label="In School" time="8:00 - 3:00 PM" color="teal" />
                  <ArrowRight className="w-4 h-4 text-gray-300 hidden sm:block" />
                  <TimelineNode label="Exit Recorded" time="3:05 PM" active={todayExits.length > 0} />
                </div>
              </div>
            </PagePanel>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineNode({ label, time, active, color }) {
  const dot = active ? 'bg-green-100 text-green-600 border-green-200' : color === 'teal' ? 'bg-[hsl(var(--accent))] text-[hsl(var(--kp-teal))] border-[hsl(var(--kp-teal))]/20' : 'bg-gray-100 text-gray-400 border-gray-200';
  return (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 ${dot}`}>
        {active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
      </div>
      <div>
        <div className="text-[11px] font-medium text-gray-600">{label}</div>
        <div className="text-[10px] text-gray-400">{time}</div>
      </div>
    </div>
  );
}