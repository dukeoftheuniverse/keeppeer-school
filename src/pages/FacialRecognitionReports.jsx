import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  FileText, Loader2, ChevronDown, ChevronUp, Download, Calendar, Filter,
  Users, CheckCircle2, XCircle, ShieldAlert, Database, Clock, AlertTriangle,
  Activity, Fingerprint, Trash2, UserCheck, Monitor
} from 'lucide-react';

const THEME_COLORS = ['#00838F', '#4CAF50', '#FFB300', '#F29339', '#2196F3', '#9C27B0', '#CC2424', '#00BCD4', '#795548', '#607D8B', '#E91E63', '#3F51B5'];
const STATUS_STAGES = ['Not Registered', 'Registration In Progress', 'Consent Pending', 'Face Recording Required', 'Active', 'Low Quality', 'Re-enrollment Required', 'Processing'];

const REPORTS = [
  { id: 'profiles', label: 'Registered Facial Profiles', icon: Fingerprint, color: 'bg-blue-500' },
  { id: 'completion', label: 'Registration Completion', icon: Activity, color: 'bg-green-500' },
  { id: 'success', label: 'Successful Recognition', icon: CheckCircle2, color: 'bg-teal-500' },
  { id: 'failed', label: 'Failed Recognition', icon: XCircle, color: 'bg-red-500' },
  { id: 'attendance', label: 'Attendance from Facial Recognition', icon: Clock, color: 'bg-orange-500' },
  { id: 'lowconf', label: 'Low-Confidence Matches', icon: AlertTriangle, color: 'bg-yellow-500' },
  { id: 'spoofing', label: 'Spoofing Attempts', icon: ShieldAlert, color: 'bg-red-600' },
  { id: 'overrides', label: 'Manual Overrides', icon: UserCheck, color: 'bg-purple-500' },
  { id: 'deletions', label: 'Deleted Facial Records', icon: Trash2, color: 'bg-gray-600' },
  { id: 'consents', label: 'Consent Records', icon: FileText, color: 'bg-indigo-500' },
  { id: 'scanners', label: 'Scanner Performance', icon: Monitor, color: 'bg-cyan-500' },
  { id: 'accuracy', label: 'Recognition Accuracy', icon: Activity, color: 'bg-green-600' },
];

export default function FacialRecognitionReports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [data, setData] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [enrollments, attempts, transactions, alerts, consents, auditLogs, devices, reviews] = await Promise.all([
        base44.entities.FaceEnrollment.list().catch(() => []),
        base44.entities.RecognitionAttempt.list().catch(() => []),
        base44.entities.AttendanceTransaction.list().catch(() => []),
        base44.entities.SecurityAlert.list().catch(() => []),
        base44.entities.BiometricConsent.list().catch(() => []),
        base44.entities.BiometricAuditLog.list().catch(() => []),
        base44.entities.ScannerDevice.list().catch(() => []),
        base44.entities.ManualReview.list().catch(() => []),
      ]);
      setData({ enrollments, attempts, transactions, alerts, consents, auditLogs, devices, reviews });
    } catch (e) { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const exportCSV = (filename, headers, rows) => {
    const csv = [headers, ...rows].map(row => row.map(c => `"${c ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const toggle = (id) => setExpanded(expanded === id ? null : id);

  return (
    <div className="kp-dash-bg min-h-screen pb-10">
      <div className="bg-[hsl(var(--kp-teal))] px-4 sm:px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/facial-recognition')} className="text-white/80 hover:text-white text-sm font-medium">← Dashboard</button>
          <div className="flex-1" />
          <div className="text-white font-bold text-lg flex items-center gap-2"><FileText className="w-5 h-5" /> Reports & Analytics</div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Date Range Filter */}
        <div className="kp-glass-card rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--kp-teal))]"><Calendar className="w-4 h-4" /> Date Range:</div>
          <input type="date" value={dateRange.from} onChange={e => setDateRange({ ...dateRange, from: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
          <span className="text-gray-400">to</span>
          <input type="date" value={dateRange.to} onChange={e => setDateRange({ ...dateRange, to: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
          <span className="text-xs text-gray-400 ml-auto">SIMULATED DATA — 12 report types available</span>
        </div>

        {/* Report Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {REPORTS.map(r => (
            <button key={r.id} onClick={() => toggle(r.id)} className={`kp-glass-card rounded-2xl p-4 text-left hover:scale-[1.02] transition-transform ${expanded === r.id ? 'ring-2 ring-[hsl(var(--kp-teal))]' : ''}`}>
              <div className={`w-10 h-10 rounded-xl ${r.color} flex items-center justify-center mb-2`}><r.icon className="w-5 h-5 text-white" /></div>
              <div className="font-bold text-sm text-[hsl(var(--kp-teal))]">{r.label}</div>
              <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">{expanded === r.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Click to {expanded === r.id ? 'collapse' : 'expand'}</div>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-[hsl(var(--kp-teal))] animate-spin" /></div>
        ) : expanded ? (
          <ReportContent id={expanded} data={data} exportCSV={exportCSV} />
        ) : (
          <div className="kp-glass-card rounded-2xl p-10 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Select a report card above to view its content.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportContent({ id, data, exportCSV }) {
  const { enrollments = [], attempts = [], transactions = [], alerts = [], consents = [], auditLogs = [], devices = [], reviews = [] } = data;

  // Report 1: Registered Facial Profiles
  if (id === 'profiles') {
    const byType = ['Student', 'Teacher', 'Employee', 'Administrator', 'Authorized Visitor'].map(t => ({ name: t, count: enrollments.filter(e => e.personType === t).length }));
    const byTime = [...enrollments].sort((a, b) => (a.registrationDate || '').localeCompare(b.registrationDate || '')).reduce((acc, e) => {
      const d = e.registrationDate || 'Unknown';
      const found = acc.find(x => x.date === d);
      if (found) found.count++; else acc.push({ date: d, count: 1 });
      return acc;
    }, []);
    return (
      <div className="kp-glass-card rounded-2xl p-5 space-y-4">
        <Header title="Registered Facial Profiles" onExport={() => exportCSV('facial_profiles', ['Name', 'Type', 'ID', 'Status', 'Quality', 'Date'], enrollments.map(e => [e.fullName, e.personType, e.idNumber, e.recognitionStatus, e.enrollmentQualityScore, e.registrationDate]))} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Registrations by Person Type">
            <ResponsiveContainer width="100%" height={250}><BarChart data={byType}><CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="count" fill="#00838F" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Registrations Over Time">
            <ResponsiveContainer width="100%" height={250}><LineChart data={byTime}><CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Line type="monotone" dataKey="count" stroke="#4CAF50" strokeWidth={2} dot={{ r: 4 }} /></LineChart></ResponsiveContainer>
          </ChartCard>
        </div>
        <SimpleTable headers={['Name', 'Type', 'ID Number', 'Status', 'Quality Score', 'Registration Date']} rows={enrollments.map(e => [e.fullName, e.personType, e.idNumber, e.recognitionStatus, e.enrollmentQualityScore, e.registrationDate])} />
      </div>
    );
  }

  // Report 2: Registration Completion
  if (id === 'completion') {
    const stages = STATUS_STAGES.map(s => ({ name: s, value: enrollments.filter(e => e.recognitionStatus === s).length })).filter(s => s.value > 0);
    return (
      <div className="kp-glass-card rounded-2xl p-5 space-y-4">
        <Header title="Registration Completion" onExport={() => exportCSV('registration_completion', ['Stage', 'Count'], stages.map(s => [s.name, s.value]))} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Completion Stages Distribution">
            <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={stages} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>{stages.map((s, i) => <Cell key={i} fill={THEME_COLORS[i % THEME_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          </ChartCard>
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-[hsl(var(--kp-teal))]">Stage Breakdown</h4>
            {stages.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: THEME_COLORS[i % THEME_COLORS.length] }} /><span className="text-sm text-gray-700">{s.name}</span></div>
                <span className="text-sm font-bold text-[hsl(var(--kp-teal))]">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Report 3: Successful Recognition
  if (id === 'success') {
    const success = attempts.filter(a => a.result === 'Success');
    const byLocation = [...new Set(success.map(a => a.scannerLocation))].map(l => ({ name: l || 'Unknown', count: success.filter(a => a.scannerLocation === l).length }));
    const byType = ['Student', 'Teacher', 'Employee', 'Administrator', 'Authorized Visitor'].map(t => ({ name: t, count: success.filter(a => a.matchedPersonType === t).length }));
    const byDay = success.reduce((acc, a) => {
      const d = a.timestamp ? new Date(a.timestamp).toLocaleDateString('en-CA') : 'Unknown';
      const found = acc.find(x => x.date === d);
      if (found) found.count++; else acc.push({ date: d, count: 1 });
      return acc;
    }, []);
    const rate = attempts.length ? Math.round(success.length / attempts.length * 100) : 0;
    return (
      <div className="kp-glass-card rounded-2xl p-5 space-y-4">
        <Header title="Successful Recognition" onExport={() => exportCSV('successful_recognition', ['Date', 'Name', 'Type', 'Location', 'Confidence'], success.map(a => [a.timestamp, a.matchedPersonName, a.matchedPersonType, a.scannerLocation, a.confidenceScore]))} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatBox label="Total Successful" value={success.length} color="text-green-600" />
          <StatBox label="Success Rate" value={`${rate}%`} color="text-teal-600" />
          <StatBox label="Avg Confidence" value={success.length ? Math.round(success.reduce((s, a) => s + (a.confidenceScore || 0), 0) / success.length) + '%' : '—'} color="text-blue-600" />
          <StatBox label="Total Attempts" value={attempts.length} color="text-gray-600" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard title="By Day"><ResponsiveContainer width="100%" height={200}><BarChart data={byDay}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="count" fill="#00838F" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>
          <ChartCard title="By Location"><ResponsiveContainer width="100%" height={200}><BarChart data={byLocation}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="count" fill="#4CAF50" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>
          <ChartCard title="By Person Type"><ResponsiveContainer width="100%" height={200}><BarChart data={byType}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis /><Tooltip /><Bar dataKey="count" fill="#FFB300" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>
        </div>
      </div>
    );
  }

  // Report 4: Failed Recognition
  if (id === 'failed') {
    const failed = attempts.filter(a => a.result !== 'Success');
    const success = attempts.filter(a => a.result === 'Success');
    const byReason = [...new Set(failed.map(a => a.result))].map(r => ({ name: r, count: failed.filter(a => a.result === r).length }));
    const ratio = [{ name: 'Success', value: success.length }, { name: 'Failed', value: failed.length }];
    return (
      <div className="kp-glass-card rounded-2xl p-5 space-y-4">
        <Header title="Failed Recognition" onExport={() => exportCSV('failed_recognition', ['Date', 'Location', 'Result', 'Quality', 'Notes'], failed.map(a => [a.timestamp, a.scannerLocation, a.result, a.qualityScore, a.notes]))} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="By Failure Reason"><ResponsiveContainer width="100%" height={250}><BarChart data={byReason} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} /><Tooltip /><Bar dataKey="count" fill="#CC2424" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></ChartCard>
          <ChartCard title="Success vs Failure Ratio">
            <ResponsiveContainer width="100%" height={250}><PieChart><Pie data={ratio} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label><Cell fill="#4CAF50" /><Cell fill="#CC2424" /></Pie><Tooltip /></PieChart></ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    );
  }

  // Report 5: Attendance from Facial Recognition
  if (id === 'attendance') {
    const byAction = [...new Set(transactions.map(t => t.attendanceAction))].map(a => ({ name: a, count: transactions.filter(t => t.attendanceAction === a).length }));
    const byStatus = [...new Set(transactions.map(t => t.attendanceStatus))].map(s => ({ name: s, count: transactions.filter(t => t.attendanceStatus === s).length }));
    return (
      <div className="kp-glass-card rounded-2xl p-5 space-y-4">
        <Header title="Attendance from Facial Recognition" onExport={() => exportCSV('fr_attendance', ['Name', 'Type', 'Action', 'Status', 'Location', 'Time'], transactions.map(t => [t.fullName, t.personType, t.attendanceAction, t.attendanceStatus, t.scannerLocation, t.actualTime]))} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Attendance Action Breakdown"><ResponsiveContainer width="100%" height={250}><BarChart data={byAction} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} /><Tooltip /><Bar dataKey="count" fill="#00838F" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></ChartCard>
          <ChartCard title="Status Breakdown"><ResponsiveContainer width="100%" height={250}><PieChart><Pie data={byStatus} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>{byStatus.map((s, i) => <Cell key={i} fill={THEME_COLORS[i % THEME_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></ChartCard>
        </div>
        <SimpleTable headers={['Name', 'Action', 'Status', 'Location', 'Time']} rows={transactions.map(t => [t.fullName, t.attendanceAction, t.attendanceStatus, t.scannerLocation, t.actualTime ? new Date(t.actualTime).toLocaleString() : '—'])} />
      </div>
    );
  }

  // Report 6: Low-Confidence Matches
  if (id === 'lowconf') {
    const lowConf = attempts.filter(a => a.result === 'Low Confidence');
    return (
      <div className="kp-glass-card rounded-2xl p-5 space-y-4">
        <Header title="Low-Confidence Matches" onExport={() => exportCSV('low_confidence', ['Date', 'Matched Person', 'Confidence', 'Location', 'Notes'], lowConf.map(a => [a.timestamp, a.matchedPersonName, a.confidenceScore, a.scannerLocation, a.notes]))} />
        {lowConf.length === 0 ? <Empty text="No low-confidence matches recorded." /> :
          <SimpleTable headers={['Date/Time', 'Matched Person', 'Confidence', 'Scanner Location', 'Notes']} rows={lowConf.map(a => [a.timestamp ? new Date(a.timestamp).toLocaleString() : '—', a.matchedPersonName || '—', a.confidenceScore ? `${a.confidenceScore}%` : '—', a.scannerLocation || '—', a.notes || '—'])} />}
      </div>
    );
  }

  // Report 7: Spoofing Attempts
  if (id === 'spoofing') {
    const spoofing = alerts.filter(a => a.alertType === 'Spoofing Attempt');
    return (
      <div className="kp-glass-card rounded-2xl p-5 space-y-4">
        <Header title="Spoofing Attempts" onExport={() => exportCSV('spoofing_attempts', ['Date', 'Location', 'Severity', 'Description', 'Status'], spoofing.map(a => [a.timestamp, a.location, a.severity, a.description, a.status]))} />
        {spoofing.length === 0 ? <Empty text="No spoofing attempts detected." /> :
          <SimpleTable headers={['Date/Time', 'Location', 'Severity', 'Description', 'Status']} rows={spoofing.map(a => [a.timestamp ? new Date(a.timestamp).toLocaleString() : '—', a.location || '—', a.severity, a.description, a.status])} />}
      </div>
    );
  }

  // Report 8: Manual Overrides
  if (id === 'overrides') {
    const approved = reviews.filter(r => r.reviewDecision === 'Approved');
    return (
      <div className="kp-glass-card rounded-2xl p-5 space-y-4">
        <Header title="Manual Overrides" onExport={() => exportCSV('manual_overrides', ['Date', 'Type', 'Person', 'Reason', 'Reviewed By'], approved.map(r => [r.reviewDate, r.reviewType, r.fullName, r.reason, r.reviewedBy]))} />
        {approved.length === 0 ? <Empty text="No approved manual overrides." /> :
          <SimpleTable headers={['Review Date', 'Review Type', 'Person', 'Reason', 'Reviewed By', 'Notes']} rows={approved.map(r => [r.reviewDate, r.reviewType, r.fullName || '—', r.reason, r.reviewedBy || '—', r.notes || '—'])} />}
      </div>
    );
  }

  // Report 9: Deleted Facial Records
  if (id === 'deletions') {
    const deletions = auditLogs.filter(a => a.action === 'Deletion');
    return (
      <div className="kp-glass-card rounded-2xl p-5 space-y-4">
        <Header title="Deleted Facial Records" onExport={() => exportCSV('deleted_records', ['Date', 'Performed By', 'Person ID', 'Details'], deletions.map(a => [a.timestamp, a.performedBy, a.personProfileId, a.details]))} />
        {deletions.length === 0 ? <Empty text="No facial record deletions logged." /> :
          <SimpleTable headers={['Date/Time', 'Performed By', 'Person Profile ID', 'Enrollment ID', 'Details']} rows={deletions.map(a => [a.timestamp ? new Date(a.timestamp).toLocaleString() : '—', a.performedBy, a.personProfileId || '—', a.enrollmentId || '—', a.details || '—'])} />}
      </div>
    );
  }

  // Report 10: Consent Records
  if (id === 'consents') {
    return (
      <div className="kp-glass-card rounded-2xl p-5 space-y-4">
        <Header title="Consent Records" onExport={() => exportCSV('consent_records', ['Consenting Person', 'Relationship', 'Method', 'Date', 'Withdrawn'], consents.map(c => [c.consentingPersonName, c.relationshipToStudent, c.consentMethod, c.consentDate, c.consentWithdrawn ? 'Yes' : 'No']))} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatBox label="Total Consents" value={consents.length} color="text-indigo-600" />
          <StatBox label="Active" value={consents.filter(c => !c.consentWithdrawn).length} color="text-green-600" />
          <StatBox label="Withdrawn" value={consents.filter(c => c.consentWithdrawn).length} color="text-red-600" />
          <StatBox label="In Person" value={consents.filter(c => c.consentMethod === 'In Person').length} color="text-blue-600" />
        </div>
        {consents.length === 0 ? <Empty text="No consent records found." /> :
          <SimpleTable headers={['Consenting Person', 'Relationship', 'Method', 'Consent Date', 'Withdrawn', 'Processor']} rows={consents.map(c => [c.consentingPersonName, c.relationshipToStudent || '—', c.consentMethod, c.consentDate, c.consentWithdrawn ? 'Yes' : 'No', c.adminProcessor || '—'])} />}
      </div>
    );
  }

  // Report 11: Scanner Performance
  if (id === 'scanners') {
    const perf = devices.map(d => {
      const devAttempts = attempts.filter(a => a.scannerDeviceId === d.deviceId || a.scannerLocation === d.location);
      const success = devAttempts.filter(a => a.result === 'Success').length;
      return { name: d.deviceName, scans: devAttempts.length, success, failure: devAttempts.length - success, rate: devAttempts.length ? Math.round(success / devAttempts.length * 100) : 0, lastHeartbeat: d.lastHeartbeat, status: d.status };
    });
    return (
      <div className="kp-glass-card rounded-2xl p-5 space-y-4">
        <Header title="Scanner Performance" onExport={() => exportCSV('scanner_performance', ['Device', 'Scans', 'Success', 'Failure', 'Rate', 'Status', 'Last Heartbeat'], perf.map(p => [p.name, p.scans, p.success, p.failure, p.rate + '%', p.status, p.lastHeartbeat]))} />
        {perf.length === 0 ? <Empty text="No scanner devices registered." /> :
          <SimpleTable headers={['Device Name', 'Total Scans', 'Success', 'Failure', 'Success Rate', 'Status', 'Last Heartbeat']} rows={perf.map(p => [p.name, p.scans, p.success, p.failure, `${p.rate}%`, p.status, p.lastHeartbeat ? new Date(p.lastHeartbeat).toLocaleString() : '—'])} />}
      </div>
    );
  }

  // Report 12: Recognition Accuracy
  if (id === 'accuracy') {
    const success = attempts.filter(a => a.result === 'Success').length;
    const total = attempts.length;
    const accuracy = total ? Math.round(success / total * 100) : 0;
    const avgConf = total ? Math.round(attempts.reduce((s, a) => s + (a.confidenceScore || 0), 0) / total) : 0;
    const falsePositive = Math.max(0, 100 - accuracy - 5); // simulated
    const trend = attempts.reduce((acc, a) => {
      const d = a.timestamp ? new Date(a.timestamp).toLocaleDateString('en-CA') : 'Unknown';
      const found = acc.find(x => x.date === d);
      if (found) { found.success += a.result === 'Success' ? 1 : 0; found.total += 1; } else acc.push({ date: d, success: a.result === 'Success' ? 1 : 0, total: 1 });
      return acc;
    }, []).map(d => ({ date: d.date, rate: d.total ? Math.round(d.success / d.total * 100) : 0 }));
    return (
      <div className="kp-glass-card rounded-2xl p-5 space-y-4">
        <Header title="Recognition Accuracy" onExport={() => exportCSV('recognition_accuracy', ['Metric', 'Value'], [['Overall Accuracy', accuracy + '%'], ['Avg Confidence', avgConf + '%'], ['False Positive Rate (simulated)', falsePositive + '%'], ['Total Attempts', total]])} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatBox label="Overall Accuracy" value={`${accuracy}%`} color="text-green-600" />
          <StatBox label="Avg Confidence" value={`${avgConf}%`} color="text-blue-600" />
          <StatBox label="False Positive (sim)" value={`${falsePositive}%`} color="text-orange-600" />
          <StatBox label="Total Attempts" value={total} color="text-gray-600" />
        </div>
        <ChartCard title="Accuracy Trend Over Time">
          <ResponsiveContainer width="100%" height={250}><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} /><Tooltip /><Line type="monotone" dataKey="rate" stroke="#00838F" strokeWidth={2} dot={{ r: 4 }} name="Accuracy %" /></LineChart></ResponsiveContainer>
        </ChartCard>
      </div>
    );
  }

  return null;
}

function Header({ title, onExport }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
      <h3 className="font-bold text-base text-[hsl(var(--kp-teal))]">{title}</h3>
      <button onClick={onExport} className="px-3 py-1.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-xs font-semibold hover:brightness-105 flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Export CSV</button>
    </div>
  );
}
function ChartCard({ title, children }) {
  return <div><h4 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-2">{title}</h4><div className="bg-white rounded-xl p-3 border border-gray-100">{children}</div></div>;
}
function StatBox({ label, value, color }) {
  return <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-center"><div className={`text-xl font-bold ${color}`}>{value}</div><div className="text-[10px] text-gray-500 mt-0.5">{label}</div></div>;
}
function SimpleTable({ headers, rows }) {
  const [page, setPage] = useState(0);
  const perPage = 10;
  const pages = Math.ceil(rows.length / perPage);
  const pageRows = rows.slice(page * perPage, (page + 1) * perPage);
  return (
    <div>
      <div className="overflow-x-auto kp-scroll-thin rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-[hsl(var(--kp-teal))]/5 text-xs uppercase text-[hsl(var(--kp-teal))]"><tr>{headers.map(h => <th key={h} className="text-left p-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{pageRows.map((r, i) => <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">{r.map((c, j) => <td key={j} className="p-3 text-gray-600 text-xs">{c ?? '—'}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-500">Page {page + 1} of {pages} ({rows.length} records)</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium disabled:opacity-50 hover:bg-gray-50">Previous</button>
            <button onClick={() => setPage(Math.min(pages - 1, page + 1))} disabled={page === pages - 1} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium disabled:opacity-50 hover:bg-gray-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
function Empty({ text }) {
  return <div className="text-center py-8 text-sm text-gray-400">{text}</div>;
}