import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  Clock, Search, Loader2, Download, ChevronDown, ChevronUp, Calendar,
  Users, CheckCircle2, AlertCircle, XCircle, RefreshCw, MapPin, Shield
} from 'lucide-react';

const ACTIONS = ['School Time In', 'School Time Out', 'Classroom Present', 'Teacher Time In', 'Teacher Time Out', 'Employee Time In', 'Employee Time Out', 'Event Entry', 'Event Exit', 'Visitor Entry', 'Visitor Exit', 'Restricted Area Access'];
const STATUSES = ['Present', 'Late', 'Excused', 'Early Departure', 'Overtime', 'Wrong Classroom', 'Outside Scheduled Time', 'Unauthorized Location', 'Duplicate Scan', 'Missing Time Out'];
const STATUS_COLOR = { 'Present': 'bg-green-100 text-green-700', 'Late': 'bg-orange-100 text-orange-700', 'Excused': 'bg-blue-100 text-blue-700', 'Early Departure': 'bg-yellow-100 text-yellow-700', 'Overtime': 'bg-teal-100 text-teal-700', 'Wrong Classroom': 'bg-red-100 text-red-700', 'Outside Scheduled Time': 'bg-red-100 text-red-700', 'Unauthorized Location': 'bg-red-100 text-red-700', 'Duplicate Scan': 'bg-purple-100 text-purple-700', 'Missing Time Out': 'bg-gray-100 text-gray-700' };

export default function AttendanceRecords() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [filters, setFilters] = useState({ search: '', personType: '', action: '', status: '', campus: '', location: '', dateFrom: '', dateTo: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toLocaleDateString('en-CA');
      const list = await base44.entities.AttendanceTransaction.list('-created_date', 500);
      setRecords(list);
      setFilters(f => ({ ...f, dateFrom: today, dateTo: today }));
    } catch (e) { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = records.filter(r => {
    if (filters.search && !`${r.fullName} ${r.idNumber}`.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.personType && r.personType !== filters.personType) return false;
    if (filters.action && r.attendanceAction !== filters.action) return false;
    if (filters.status && r.attendanceStatus !== filters.status) return false;
    if (filters.campus && r.campus !== filters.campus) return false;
    if (filters.location && r.scannerLocation !== filters.location) return false;
    return true;
  });

  const todayRecords = filtered.filter(r => {
    const d = r.actualTime ? new Date(r.actualTime).toLocaleDateString('en-CA') : '';
    return d === new Date().toLocaleDateString('en-CA');
  });

  const stats = {
    total: todayRecords.length,
    present: todayRecords.filter(r => r.attendanceStatus === 'Present').length,
    late: todayRecords.filter(r => r.attendanceStatus === 'Late').length,
    early: todayRecords.filter(r => r.attendanceStatus === 'Early Departure').length,
    unauthorized: todayRecords.filter(r => ['Unauthorized Location', 'Outside Scheduled Time'].includes(r.attendanceStatus)).length,
    duplicate: todayRecords.filter(r => r.attendanceStatus === 'Duplicate Scan').length,
  };

  const exportCSV = () => {
    const headers = ['Date/Time', 'Full Name', 'ID Number', 'Person Type', 'Action', 'Status', 'Scanner Location', 'Campus', 'Confidence'];
    const rows = filtered.map(r => [r.actualTime || '', r.fullName || '', r.idNumber || '', r.personType || '', r.attendanceAction || '', r.attendanceStatus || '', r.scannerLocation || '', r.campus || '', r.recognitionAttemptId || '']);
    const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `attendance_records_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="kp-dash-bg min-h-screen pb-10">
      <div className="bg-[hsl(var(--kp-teal))] px-4 sm:px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/facial-recognition')} className="text-white/80 hover:text-white text-sm font-medium">← Dashboard</button>
          <div className="flex-1" />
          <div className="text-white font-bold text-lg flex items-center gap-2"><Clock className="w-5 h-5" /> Facial Recognition Attendance</div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Scans" value={stats.total} icon={Users} color="text-blue-600" bg="bg-blue-50" />
          <StatCard label="Present" value={stats.present} icon={CheckCircle2} color="text-green-600" bg="bg-green-50" />
          <StatCard label="Late" value={stats.late} icon={Clock} color="text-orange-600" bg="bg-orange-50" />
          <StatCard label="Early Departure" value={stats.early} icon={AlertCircle} color="text-yellow-600" bg="bg-yellow-50" />
          <StatCard label="Unauthorized" value={stats.unauthorized} icon={XCircle} color="text-red-600" bg="bg-red-50" />
          <StatCard label="Duplicate" value={stats.duplicate} icon={RefreshCw} color="text-purple-600" bg="bg-purple-50" />
        </div>

        {/* Filters */}
        <div className="kp-glass-card rounded-2xl p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="Search name or ID..."
                  className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
              </div>
              <div className="flex gap-2">
                <input type="date" value={filters.dateFrom} onChange={e => setFilters({ ...filters, dateFrom: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
                <input type="date" value={filters.dateTo} onChange={e => setFilters({ ...filters, dateTo: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
              </div>
              <button onClick={exportCSV} className="px-4 py-2 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-semibold hover:brightness-105 flex items-center gap-1.5 shrink-0">
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Select value={filters.personType} onChange={v => setFilters({ ...filters, personType: v })} options={['', 'Student', 'Teacher', 'Employee', 'Authorized Visitor', 'Administrator']} labels={['All Types', 'Student', 'Teacher', 'Employee', 'Visitor', 'Administrator']} />
              <Select value={filters.action} onChange={v => setFilters({ ...filters, action: v })} options={['', ...ACTIONS]} labels={['All Actions', ...ACTIONS]} />
              <Select value={filters.status} onChange={v => setFilters({ ...filters, status: v })} options={['', ...STATUSES]} labels={['All Status', ...STATUSES]} />
              <Select value={filters.location} onChange={v => setFilters({ ...filters, location: v })} options={['', 'Main Entrance', 'Classroom 10A', 'Visitor Desk']} labels={['All Locations', 'Main Entrance', 'Classroom 10A', 'Visitor Desk']} />
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-[hsl(var(--kp-teal))] animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="kp-glass-card rounded-2xl p-10 text-center">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No attendance records found for the selected filters.</p>
          </div>
        ) : (
          <div className="kp-glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto kp-scroll-thin">
              <table className="w-full text-sm">
                <thead className="bg-[hsl(var(--kp-teal))]/5 text-xs uppercase text-[hsl(var(--kp-teal))]">
                  <tr>
                    <th className="text-left p-3 font-semibold">Date/Time</th>
                    <th className="text-left p-3 font-semibold">Name</th>
                    <th className="text-left p-3 font-semibold hidden sm:table-cell">Type</th>
                    <th className="text-left p-3 font-semibold">Action</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-left p-3 font-semibold hidden lg:table-cell">Location</th>
                    <th className="text-left p-3 font-semibold hidden md:table-cell">Campus</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <React.Fragment key={r.id}>
                      <tr onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer">
                        <td className="p-3 text-gray-600 text-xs whitespace-nowrap">{r.actualTime ? new Date(r.actualTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td className="p-3">
                          <div className="font-medium text-[hsl(var(--kp-teal))]">{r.fullName}</div>
                          <div className="text-xs text-gray-500">{r.idNumber}</div>
                        </td>
                        <td className="p-3 text-gray-600 hidden sm:table-cell text-xs">{r.personType}</td>
                        <td className="p-3 text-gray-600 text-xs">{r.attendanceAction}</td>
                        <td className="p-3"><span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${STATUS_COLOR[r.attendanceStatus] || 'bg-gray-100 text-gray-700'}`}>{r.attendanceStatus}</span></td>
                        <td className="p-3 text-gray-600 hidden lg:table-cell text-xs">{r.scannerLocation || '—'}</td>
                        <td className="p-3 text-gray-600 hidden md:table-cell text-xs">{r.campus || '—'}</td>
                        <td className="p-3 text-gray-400">{expanded === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</td>
                      </tr>
                      {expanded === r.id && (
                        <tr className="bg-gray-50">
                          <td colSpan={8} className="p-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              <div><span className="text-gray-400">Grade/Section:</span><br /><span className="text-gray-700 font-medium">{r.gradeSection || '—'}</span></div>
                              <div><span className="text-gray-400">Dept/Position:</span><br /><span className="text-gray-700 font-medium">{r.departmentPosition || '—'}</span></div>
                              <div><span className="text-gray-400">Scheduled Time:</span><br /><span className="text-gray-700 font-medium">{r.scheduledTime || '—'}</span></div>
                              <div><span className="text-gray-400">Actual Time:</span><br /><span className="text-gray-700 font-medium">{r.actualTime ? new Date(r.actualTime).toLocaleTimeString() : '—'}</span></div>
                              <div><span className="text-gray-400">Scanner Location:</span><br /><span className="text-gray-700 font-medium">{r.scannerLocation || '—'}</span></div>
                              <div><span className="text-gray-400">Access Level:</span><br /><span className="text-gray-700 font-medium">{r.accessPermissionLevel || '—'}</span></div>
                              <div className="col-span-2"><span className="text-gray-400">Notes:</span><br /><span className="text-gray-700">{r.notes || '—'}</span></div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }) {
  return (
    <div className="kp-glass-card rounded-2xl p-3 flex items-center gap-2.5">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}><Icon className={`w-5 h-5 ${color}`} /></div>
      <div className="min-w-0"><div className="text-xl font-bold text-[hsl(var(--kp-teal))] leading-tight">{value}</div><div className="text-[10px] text-gray-500 truncate">{label}</div></div>
    </div>
  );
}
function Select({ value, onChange, options, labels }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
      {options.map((o, i) => <option key={o || i} value={o}>{labels[i]}</option>)}
    </select>
  );
}