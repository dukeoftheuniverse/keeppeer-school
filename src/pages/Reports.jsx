import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { PagePanel, PageTitle, KpButton, KpSelect, StatusBadge, Avatar, EmptyState, SearchInput } from '@/components/kp/ui';
import { Printer, Download, FileText, Calendar, Users, Clock, UserX, QrCode, LayoutGrid, BookOpen } from 'lucide-react';

function exportCSV(filename, headers, rows) {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const reportTabs = [
  { id: 'daily', label: 'Daily Attendance', icon: Calendar },
  { id: 'monthly', label: 'Monthly Attendance', icon: Calendar },
  { id: 'student-history', label: 'Student Attendance History', icon: Users },
  { id: 'employee', label: 'Employee Attendance', icon: Users },
  { id: 'enrollment-grade', label: 'Enrollment by Grade', icon: LayoutGrid },
  { id: 'class-lists', label: 'Class Lists', icon: BookOpen },
  { id: 'late', label: 'Late Arrivals', icon: Clock },
  { id: 'absence', label: 'Absence Summary', icon: UserX },
  { id: 'scan-logs', label: 'QR Scan Logs', icon: QrCode },
];

export default function Reports() {
  const [tab, setTab] = useState('daily');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toLocaleDateString('en-CA'));
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    const today = new Date().toLocaleDateString('en-CA');
    Promise.all([
      base44.entities.Attendance.list(),
      base44.entities.Student.list(),
      base44.entities.Employee.list(),
      base44.entities.Class.list(),
    ]).then(([att, students, employees, classes]) => {
      let rows = [];
      if (tab === 'daily') {
        rows = att.filter(a => a.date === (dateFilter || today)).map(a => ({
          name: a.person_name, type: a.person_type, status: a.status, method: a.method, scan_type: a.scan_type, time: a.time, date: a.date, grade: a.grade, section: a.section
        }));
      } else if (tab === 'monthly') {
        rows = att.filter(a => (a.date || '').startsWith(monthFilter)).map(a => ({
          name: a.person_name, type: a.person_type, status: a.status, scan_type: a.scan_type, time: a.time, date: a.date
        }));
      } else if (tab === 'student-history') {
        rows = att.filter(a => a.person_type === 'student').map(a => ({
          name: a.person_name, status: a.status, scan_type: a.scan_type, time: a.time, date: a.date, grade: a.grade, section: a.section
        }));
      } else if (tab === 'employee') {
        rows = att.filter(a => a.person_type === 'employee').map(a => ({
          name: a.person_name, status: a.status, scan_type: a.scan_type, time: a.time, date: a.date
        }));
      } else if (tab === 'enrollment-grade') {
        const byGrade = {};
        students.forEach(s => { const g = s.grade || 'Unassigned'; byGrade[g] = (byGrade[g] || 0) + 1; });
        rows = Object.entries(byGrade).map(([grade, count]) => ({ grade, enrolled: count }));
      } else if (tab === 'class-lists') {
        rows = students.map(s => ({ name: `${s.first_name} ${s.last_name}`, lrn: s.lrn, grade: s.grade, section: s.section, status: s.enrollment_status }));
      } else if (tab === 'late') {
        rows = att.filter(a => a.status === 'late').map(a => ({
          name: a.person_name, type: a.person_type, time: a.time, date: a.date, grade: a.grade, section: a.section
        }));
      } else if (tab === 'absence') {
        rows = att.filter(a => a.status === 'absent').map(a => ({
          name: a.person_name, type: a.person_type, date: a.date, grade: a.grade, section: a.section
        }));
      } else if (tab === 'scan-logs') {
        rows = att.filter(a => a.method === 'qr').map(a => ({
          name: a.person_name, type: a.person_type, scan_type: a.scan_type, status: a.status, time: a.time, date: a.date
        }));
      }
      if (search) rows = rows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
      setData(rows);
    }).finally(() => setLoading(false));
  }, [tab, dateFilter, monthFilter, search]);

  const getHeaders = () => {
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  };

  const handlePrint = () => window.print();
  const handleCSV = () => {
    const headers = getHeaders();
    exportCSV(`${tab}-report-${new Date().toISOString().slice(0, 10)}.csv`, headers, data.map(r => headers.map(h => r[h])));
  };

  const activeTab = reportTabs.find(t => t.id === tab);

  return (
    <div className="space-y-4">
      <PageTitle subtitle="Generate and export attendance, enrollment, and scan reports">Reports</PageTitle>

      <PagePanel>
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="lg:w-52 shrink-0">
            <div className="space-y-0.5">
              {reportTabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-[hsl(var(--kp-teal))] text-white' : 'text-[hsl(var(--kp-teal))] hover:bg-gray-50'}`}>
                  <t.icon className="w-4 h-4 shrink-0" /> <span className="truncate">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              {tab === 'daily' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Date:</label>
                  <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                </div>
              )}
              {tab === 'monthly' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Month:</label>
                  <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                </div>
              )}
              <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter results..." className="flex-1" />
              <div className="flex gap-2">
                <KpButton variant="outline" onClick={handleCSV}><Download className="w-4 h-4" /> CSV</KpButton>
                <KpButton variant="outline" onClick={handlePrint}><Printer className="w-4 h-4" /> Print</KpButton>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-[hsl(var(--kp-teal))]">
              <FileText className="w-4 h-4" /> {activeTab?.label} ({data.length} records)
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading report...</div>
            ) : data.length === 0 ? (
              <EmptyState message="No records found for this report" />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {getHeaders().map(h => (
                        <th key={h} className="text-left py-2.5 px-3 font-medium text-xs text-gray-500 capitalize whitespace-nowrap">{h.replace(/_/g, ' ')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 100).map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                        {getHeaders().map(h => (
                          <td key={h} className="py-2 px-3 text-gray-600 whitespace-nowrap">
                            {h === 'status' ? <StatusBadge status={row[h]} /> : String(row[h] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.length > 100 && <div className="py-2 text-center text-xs text-gray-400">Showing first 100 of {data.length} records. Export CSV for full data.</div>}
              </div>
            )}
          </div>
        </div>
      </PagePanel>
    </div>
  );
}