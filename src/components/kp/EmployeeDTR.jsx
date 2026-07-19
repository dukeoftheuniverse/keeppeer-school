import React, { useState, useMemo } from 'react';
import { Download, Clock, Calendar, Printer } from 'lucide-react';
import { KpButton, StatusBadge } from '@/components/kp/ui';

// Group raw attendance records into a per-day DTR row:
// AM In / AM Out (before noon) · PM In / PM Out (after noon)
function buildDTR(attendance) {
  const byDate = {};
  (attendance || []).forEach(a => {
    if (!a.date) return;
    (byDate[a.date] = byDate[a.date] || []).push(a);
  });
  const rows = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1)).map(date => {
    const recs = byDate[date].sort((x, y) => (x.time || '').localeCompare(y.time || ''));
    const toMin = (t) => {
      if (!t) return -1;
      const [h, m] = t.split(/[: ]/).map(Number);
      let hh = h;
      if (t.toUpperCase().includes('PM') && hh < 12) hh += 12;
      if (t.toUpperCase().includes('AM') && hh === 12) hh = 0;
      return hh * 60 + (m || 0);
    };
    let amIn = '', amOut = '', pmIn = '', pmOut = '';
    recs.forEach(r => {
      const mins = toMin(r.time);
      if (r.scan_type === 'time_in') {
        if (mins < 720) amIn = amIn || r.time;
        else pmIn = pmIn || r.time;
      } else if (r.scan_type === 'time_out') {
        if (mins < 720) amOut = amOut || r.time;
        else pmOut = pmOut || r.time;
      }
    });
    const present = recs.some(r => r.scan_type === 'time_in');
    return { date, amIn, amOut, pmIn, pmOut, present };
  });
  return rows;
}

export default function EmployeeDTR({ employee, attendance }) {
  const [month, setMonth] = useState(new Date().toLocaleDateString('en-CA').slice(0, 7));

  const dtr = useMemo(() => buildDTR(attendance), [attendance]);
  const monthRows = useMemo(() => dtr.filter(r => r.date.startsWith(month)), [dtr, month]);

  const fullName = `${employee?.first_name || ''} ${employee?.last_name || ''}`.trim();
  const monthName = new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const downloadCSV = () => {
    const header = ['Date', 'Day', 'AM Time In', 'AM Time Out', 'PM Time In', 'PM Time Out', 'Status'];
    const lines = monthRows.map(r => [
      r.date,
      new Date(r.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'long' }),
      r.amIn || '—',
      r.amOut || '—',
      r.pmIn || '—',
      r.pmOut || '—',
      r.present ? 'Present' : 'Absent',
    ].join(','));
    const csv = [`Daily Time Record — ${fullName}`, `Employee ID: ${employee?.employee_id || '—'}`, `Position: ${employee?.position || '—'}`, `Month: ${monthName}`, '', header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `DTR-${fullName.replace(/\s/g, '_')}-${month}.csv`;
    a.click();
  };

  const printDTR = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const rowsHtml = monthRows.map(r => `<tr>
      <td>${r.date}</td><td>${new Date(r.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'long' })}</td>
      <td>${r.amIn || '—'}</td><td>${r.amOut || '—'}</td><td>${r.pmIn || '—'}</td><td>${r.pmOut || '—'}</td>
      <td>${r.present ? 'Present' : 'Absent'}</td>
    </tr>`).join('');
    w.document.write(`<!doctype html><html><head><title>DTR — ${fullName}</title>
      <style>body{font-family:Arial,sans-serif;padding:32px;color:#1f2937}
      h1{font-size:18px;text-align:center;margin:0}h2{font-size:13px;text-align:center;font-weight:normal;color:#555;margin:4px 0 16px}
      .meta{display:flex;justify-content:space-between;font-size:12px;margin-bottom:12px}
      table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #999;padding:6px 8px;text-align:center}
      th{background:#004D5A;color:#fff}tr:nth-child(even){background:#f4fafb}
      .sign{margin-top:48px;display:flex;justify-content:space-between;font-size:11px}
      .sign div{text-align:center;width:40%}.sign div span{display:block;border-top:1px solid #333;padding-top:4px;margin-top:36px}
      </style></head><body>
      <h1>DAILY TIME RECORD</h1>
      <h2>${monthName}</h2>
      <div class="meta"><span><b>Name:</b> ${fullName}</span><span><b>Employee ID:</b> ${employee?.employee_id || '—'}</span></div>
      <div class="meta"><span><b>Position:</b> ${employee?.position || '—'}</span><span><b>Department:</b> ${employee?.department || '—'}</span></div>
      <table><thead><tr><th>Date</th><th>Day</th><th>AM In</th><th>AM Out</th><th>PM In</th><th>PM Out</th><th>Status</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="sign"><div><span>Employee Signature</span></div><div><span>Supervisor Signature</span></div></div>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm font-bold text-[hsl(var(--kp-teal))]"><Calendar className="w-4 h-4" /> Daily Time Record</div>
        <div className="flex items-center gap-2">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
          <KpButton variant="outline" onClick={downloadCSV}><Download className="w-4 h-4" /> CSV</KpButton>
          <KpButton variant="green" onClick={printDTR}><Printer className="w-4 h-4" /> Print DTR</KpButton>
        </div>
      </div>

      {monthRows.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No attendance records for {monthName}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400">
                <th className="text-left py-2 px-2 font-medium">Date</th>
                <th className="text-left py-2 px-2 font-medium">Day</th>
                <th className="text-left py-2 px-2 font-medium"><Clock className="w-3 h-3 inline mr-1" />AM In</th>
                <th className="text-left py-2 px-2 font-medium">AM Out</th>
                <th className="text-left py-2 px-2 font-medium"><Clock className="w-3 h-3 inline mr-1" />PM In</th>
                <th className="text-left py-2 px-2 font-medium">PM Out</th>
                <th className="text-left py-2 px-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {monthRows.map(r => (
                <tr key={r.date} className="border-b border-gray-50">
                  <td className="py-2 px-2 text-gray-600">{r.date}</td>
                  <td className="py-2 px-2 text-gray-500">{new Date(r.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'long' })}</td>
                  <td className="py-2 px-2 text-gray-700 font-mono">{r.amIn || '—'}</td>
                  <td className="py-2 px-2 text-gray-700 font-mono">{r.amOut || '—'}</td>
                  <td className="py-2 px-2 text-gray-700 font-mono">{r.pmIn || '—'}</td>
                  <td className="py-2 px-2 text-gray-700 font-mono">{r.pmOut || '—'}</td>
                  <td className="py-2 px-2"><StatusBadge status={r.present ? 'present' : 'absent'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}