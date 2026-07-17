import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { PagePanel, PageTitle, KpButton, SearchInput, StatusBadge, EmptyState } from '@/components/kp/ui';
import { Search, Printer, RefreshCw, QrCode, Building2, PenLine, Calendar } from 'lucide-react';
import { logAudit } from '@/lib/audit';

export default function IDMaker() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [school, setSchool] = useState(null);
  const [searching, setSearching] = useState(false);
  const [cardStatus, setCardStatus] = useState('issued');

  useEffect(() => {
    base44.entities.School.list().then(res => setSchool(res[0] || null)).catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSelected(null);
    try {
      const [students, employees] = await Promise.all([
        base44.entities.Student.list(),
        base44.entities.Employee.list(),
      ]);
      const q = query.toLowerCase();
      const matched = [
        ...students.map(s => ({ ...s, type: 'student', name: `${s.first_name} ${s.last_name}` })),
        ...employees.map(e => ({ ...e, type: 'employee', name: `${e.first_name} ${e.last_name}` })),
      ].filter(p => p.name.toLowerCase().includes(q) || (p.lrn || '').toLowerCase().includes(q) || (p.employee_id || '').toLowerCase().includes(q) || (p.student_id || '').toLowerCase().includes(q));
      setResults(matched);
    } finally { setSearching(false); }
  };

  const handleGenerate = async () => {
    if (!selected) return;
    const cardNumber = 'ID-' + Date.now().toString().slice(-10);
    const qrCode = selected.qr_id || `QR-${Date.now()}`;
    const issueDate = new Date().toLocaleDateString('en-CA');
    const expiryDate = new Date(new Date().getFullYear() + 1, 5, 30).toLocaleDateString('en-CA');
    try {
      await base44.entities.GeneratedIDCard.create({
        person_id: selected.id, person_name: selected.name, person_type: selected.type,
        card_number: cardNumber, qr_code: qrCode, status: cardStatus, issue_date: issueDate, expiry_date: expiryDate,
      });
      if (selected.type === 'student') await base44.entities.Student.update(selected.id, { id_card_id: cardNumber, qr_id: qrCode });
      else await base44.entities.Employee.update(selected.id, { id_card_id: cardNumber });
      logAudit('generate_id', 'GeneratedIDCard', selected.id, `${selected.name} - ${cardNumber}`);
    } catch (e) { /* silent */ }
  };

  return (
    <div className="space-y-4">
      <PageTitle>ID Maker</PageTitle>

      <PagePanel>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <SearchInput value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by LRN, ID number, or name..." className="flex-1" />
          <KpButton variant="green" onClick={handleSearch}><Search className="w-4 h-4" /> Search</KpButton>
        </div>

        {searching && <div className="text-center py-8 text-gray-400">Searching...</div>}
        {!searching && results.length > 0 && !selected && (
          <div className="space-y-2">
            {results.map(r => (
              <button key={r.id} onClick={() => setSelected(r)} className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 text-left">
                <div><div className="font-medium text-gray-700">{r.name}</div><div className="text-xs text-gray-400">{r.type === 'student' ? `LRN: ${r.lrn || '—'}` : `ID: ${r.employee_id || '—'}`}</div></div>
                <StatusBadge status={r.type} />
              </button>
            ))}
          </div>
        )}
        {!searching && !selected && results.length === 0 && query && (
          <EmptyState message="No matching records found" />
        )}
        {!searching && !selected && !query && (
          <div className="text-center py-12 text-gray-400">
            <QrCode className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Search for a student or employee to generate an ID</p>
          </div>
        )}
      </PagePanel>

      {selected && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PagePanel>
            <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4">ID Preview - Front</h3>
            <div className="mx-auto max-w-sm aspect-[1.6/1] rounded-2xl shadow-xl overflow-hidden bg-gradient-to-br from-[hsl(var(--kp-teal))] to-[hsl(var(--kp-teal-dark))] p-1">
              <div className="w-full h-full bg-white rounded-xl flex flex-col">
                <div className="bg-[hsl(var(--kp-teal))] px-4 py-2 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center"><Building2 className="w-4 h-4 text-white" /></div>
                  <div><div className="text-[8px] text-white/70 uppercase tracking-wide">School</div><div className="text-white text-xs font-bold">Keeppeer</div></div>
                  <div className="ml-auto text-[8px] text-white/70">{school?.academic_year || '2026-2027'}</div>
                </div>
                <div className="flex-1 p-4 flex gap-3">
                  <div className="w-16 h-20 rounded-lg bg-gray-200 overflow-hidden shrink-0">
                    {selected.photo_url ? <img src={selected.photo_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">Photo</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-gray-400 uppercase">Name</div>
                    <div className="text-sm font-bold text-[hsl(var(--kp-teal))] truncate">{selected.name}</div>
                    <div className="text-[10px] text-gray-400 uppercase mt-1">{selected.type === 'student' ? 'LRN' : 'Employee ID'}</div>
                    <div className="text-xs text-gray-600 font-mono">{selected.type === 'student' ? (selected.lrn || '—') : (selected.employee_id || '—')}</div>
                    {selected.type === 'student' && <><div className="text-[10px] text-gray-400 uppercase mt-1">Grade & Section</div><div className="text-xs text-gray-600">{selected.grade || '—'} - {selected.section || '—'}</div></>}
                  </div>
                  <div className="w-14 h-14 shrink-0">
                    {selected.qr_id && <img src={`https://api.qrserver.com/v1/create-qr-code/?size=56x56&data=${encodeURIComponent(selected.qr_id)}`} alt="QR" className="w-full h-full" />}
                  </div>
                </div>
                <div className="px-4 py-1.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[8px] text-gray-400">{school?.school_name || 'Labangal Elementary School'}</span>
                  <span className="text-[8px] text-gray-400">Expires: {new Date(new Date().getFullYear() + 1, 5, 30).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </PagePanel>

          <PagePanel>
            <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4">ID Preview - Back</h3>
            <div className="mx-auto max-w-sm aspect-[1.6/1] rounded-2xl shadow-xl overflow-hidden bg-white p-1">
              <div className="w-full h-full rounded-xl border-2 border-dashed border-gray-200 p-4 flex flex-col">
                <div className="text-center mb-2"><div className="text-[8px] text-gray-400 uppercase">School ID</div><div className="text-xs font-bold text-[hsl(var(--kp-teal))]">{school?.school_id || '100567'}</div></div>
                <div className="flex-1 space-y-2 text-[9px] text-gray-500">
                  <div className="flex items-center gap-1.5"><Building2 className="w-3 h-3" /> {school?.school_name || 'Labangal Elementary School'}</div>
                  <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Valid for SY {school?.academic_year || '2026-2027'}</div>
                  <div className="flex items-center gap-1.5"><PenLine className="w-3 h-3" /> Authorized by: {school?.principal || 'Maria Santos'}</div>
                  <div className="border-t border-gray-100 pt-2 mt-2"><p className="leading-relaxed">This ID is the property of {school?.school_name || 'the school'}. If found, please return to the address below.</p></div>
                  <div className="text-gray-400">{school?.address || '—'}</div>
                </div>
                <div className="text-center border-t border-gray-100 pt-2"><div className="text-[7px] text-gray-300">Powered by Keeppeer School Management</div></div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <span className="text-sm text-gray-600">Card Status</span>
                <select value={cardStatus} onChange={e => setCardStatus(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white">
                  <option value="issued">Issued</option>
                  <option value="lost">Lost</option>
                  <option value="revoked">Revoked</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <KpButton variant="green" onClick={handleGenerate}><RefreshCw className="w-4 h-4" /> Regenerate</KpButton>
                <KpButton variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4" /> Print</KpButton>
                <KpButton variant="light" onClick={() => setSelected(null)}>Close</KpButton>
              </div>
            </div>
          </PagePanel>
        </div>
      )}
    </div>
  );
}