import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  Database, Search, Loader2, MoreVertical, Eye, ScanFace, RefreshCw, Trash2,
  Shield, ShieldOff, CheckCircle2, XCircle, LayoutGrid, List, Filter,
  Users, GraduationCap, Briefcase, UserCheck, AlertTriangle, X, History, FileText
} from 'lucide-react';

const STATUS_COLORS = {
  'Active': 'bg-green-100 text-green-700',
  'Suspended': 'bg-orange-100 text-orange-700',
  'Disabled': 'bg-red-100 text-red-700',
  'Low Quality': 'bg-yellow-100 text-yellow-700',
  'Re-enrollment Required': 'bg-red-100 text-red-700',
  'Consent Pending': 'bg-blue-100 text-blue-700',
  'Registration In Progress': 'bg-gray-100 text-gray-700',
};

export default function RegisteredFaceDatabase() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState([]);
  const [view, setView] = useState('table'); // table | card
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [menuOpen, setMenuOpen] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.FaceEnrollment.list('-created_date', 200);
      setEnrollments(list.filter(e => e.recognitionStatus !== 'Deleted'));
    } catch (e) { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = enrollments.filter(e => {
    if (search && !`${e.fullName} ${e.idNumber} ${e.personType}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && e.personType !== filterType) return false;
    if (filterStatus && e.recognitionStatus !== filterStatus) return false;
    return true;
  });

  const handleAction = async (action, enrollment) => {
    setActionLoading(true);
    setMenuOpen(null);
    const ts = new Date().toISOString();
    try {
      if (action === 'suspend') {
        await base44.entities.FaceEnrollment.update(enrollment.id, { accountStatus: 'Suspended', recognitionStatus: 'Suspended' });
        await base44.entities.BiometricAuditLog.create({ action: 'Suspended', enrollmentId: enrollment.id, personProfileId: enrollment.personProfileId, performedBy: user?.full_name || 'Admin', timestamp: ts, details: `Suspended ${enrollment.fullName}`, isBiometricData: true });
      } else if (action === 'activate') {
        await base44.entities.FaceEnrollment.update(enrollment.id, { accountStatus: 'Active', recognitionStatus: 'Active' });
        await base44.entities.BiometricAuditLog.create({ action: 'Activated', enrollmentId: enrollment.id, personProfileId: enrollment.personProfileId, performedBy: user?.full_name || 'Admin', timestamp: ts, details: `Activated ${enrollment.fullName}`, isBiometricData: true });
      } else if (action === 'reenroll') {
        await base44.entities.FaceEnrollment.update(enrollment.id, { reEnrollmentStatus: 'Required', recognitionStatus: 'Re-enrollment Required' });
      } else if (action === 'test') {
        navigate('/facial-recognition/scan');
        return;
      } else if (action === 'record') {
        navigate('/facial-recognition/record');
        return;
      }
      await load();
    } catch (e) { alert('Action failed: ' + e.message); }
    setActionLoading(false);
  };

  const confirmDelete = async () => {
    if (!deleteReason.trim()) { alert('Please enter a reason for deletion.'); return; }
    setActionLoading(true);
    const ts = new Date().toISOString();
    try {
      await base44.entities.FaceEnrollment.update(deleteTarget.id, { recognitionStatus: 'Deleted', accountStatus: 'Disabled' });
      await base44.entities.BiometricAuditLog.create({
        action: 'Deletion', enrollmentId: deleteTarget.id, personProfileId: deleteTarget.personProfileId,
        performedBy: user?.full_name || 'Admin', timestamp: ts,
        details: `Deleted facial record for ${deleteTarget.fullName}. Reason: ${deleteReason}`,
        isBiometricData: false,
      });
      await base44.entities.SecurityAlert.create({
        alertType: 'Facial Record Deleted', severity: 'Warning',
        personProfileId: deleteTarget.personProfileId, description: `Facial record deleted: ${deleteTarget.fullName}. Reason: ${deleteReason}`,
        timestamp: ts, status: 'Open',
      });
      setDeleteTarget(null); setDeleteReason('');
      await load();
    } catch (e) { alert('Delete failed: ' + e.message); }
    setActionLoading(false);
  };

  return (
    <div className="kp-dash-bg min-h-screen pb-10">
      {/* Header */}
      <div className="bg-[hsl(var(--kp-teal))] px-4 sm:px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/facial-recognition')} className="text-white/80 hover:text-white text-sm font-medium">← Dashboard</button>
          <div className="flex-1" />
          <div className="text-white font-bold text-lg flex items-center gap-2"><Database className="w-5 h-5" /> Registered Face Database</div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Filters */}
        <div className="kp-glass-card rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, ID, type..."
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
              <option value="">All Types</option>
              <option value="Student">Student</option>
              <option value="Teacher">Teacher</option>
              <option value="Employee">Employee</option>
              <option value="Authorized Visitor">Visitor</option>
              <option value="Administrator">Administrator</option>
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
              <option value="Low Quality">Low Quality</option>
              <option value="Re-enrollment Required">Re-enrollment Required</option>
              <option value="Consent Pending">Consent Pending</option>
            </select>
            <div className="flex gap-1">
              <button onClick={() => setView('table')} className={`p-2 rounded-lg border ${view === 'table' ? 'bg-[hsl(var(--kp-teal))] text-white border-[hsl(var(--kp-teal))]' : 'border-gray-200 text-gray-400'}`}><List className="w-4 h-4" /></button>
              <button onClick={() => setView('card')} className={`p-2 rounded-lg border ${view === 'card' ? 'bg-[hsl(var(--kp-teal))] text-white border-[hsl(var(--kp-teal))]' : 'border-gray-200 text-gray-400'}`}><LayoutGrid className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-[hsl(var(--kp-teal))] animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="kp-glass-card rounded-2xl p-10 text-center">
            <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No registered faces found. Use "Record & Profile Person" to enroll.</p>
            <button onClick={() => navigate('/facial-recognition/record')} className="mt-4 px-4 py-2 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-semibold hover:brightness-105">Record New Person</button>
          </div>
        ) : view === 'table' ? (
          <div className="kp-glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto kp-scroll-thin">
              <table className="w-full text-sm">
                <thead className="bg-[hsl(var(--kp-teal))]/5 text-xs uppercase text-[hsl(var(--kp-teal))]">
                  <tr>
                    <th className="text-left p-3 font-semibold">Name</th>
                    <th className="text-left p-3 font-semibold hidden sm:table-cell">ID</th>
                    <th className="text-left p-3 font-semibold">Type</th>
                    <th className="text-left p-3 font-semibold hidden lg:table-cell">Campus</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                    <th className="text-left p-3 font-semibold hidden md:table-cell">Registered</th>
                    <th className="text-right p-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => (
                    <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-full bg-[hsl(var(--kp-teal))]/10 flex items-center justify-center text-xs font-bold text-[hsl(var(--kp-teal))] shrink-0">{e.fullName?.charAt(0) || '?'}</div>
                          <span className="font-medium text-[hsl(var(--kp-teal))] truncate">{e.fullName}</span>
                        </div>
                      </td>
                      <td className="p-3 text-gray-600 hidden sm:table-cell">{e.idNumber || '—'}</td>
                      <td className="p-3"><span className="text-xs font-medium text-gray-600">{e.personType}</span></td>
                      <td className="p-3 text-gray-600 hidden lg:table-cell">{e.registeredCampus || '—'}</td>
                      <td className="p-3"><span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[e.recognitionStatus] || 'bg-gray-100 text-gray-700'}`}>{e.recognitionStatus}</span></td>
                      <td className="p-3 text-gray-500 hidden md:table-cell">{e.registrationDate || '—'}</td>
                      <td className="p-3 text-right relative">
                        <button onClick={() => setMenuOpen(menuOpen === e.id ? null : e.id)} className="p-1.5 rounded-lg hover:bg-gray-100">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                        {menuOpen === e.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                            <div className="absolute right-3 top-10 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 text-left">
                              <MenuItem icon={Eye} label="View Profile" onClick={() => { setMenuOpen(null); }} />
                              <MenuItem icon={ScanFace} label="Test Recognition" onClick={() => handleAction('test', e)} />
                              <MenuItem icon={RefreshCw} label="Re-record Face" onClick={() => handleAction('record', e)} />
                              <MenuItem icon={ShieldOff} label="Suspend" onClick={() => handleAction('suspend', e)} />
                              <MenuItem icon={Shield} label="Activate" onClick={() => handleAction('activate', e)} />
                              <MenuItem icon={RefreshCw} label="Require Re-enrollment" onClick={() => handleAction('reenroll', e)} />
                              <MenuItem icon={History} label="Recognition History" onClick={() => setMenuOpen(null)} />
                              <MenuItem icon={FileText} label="View Consent" onClick={() => setMenuOpen(null)} />
                              <MenuItem icon={Trash2} label="Delete Record" danger onClick={() => { setDeleteTarget(e); setMenuOpen(null); }} />
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Card view */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(e => (
              <div key={e.id} className="kp-glass-card rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-[hsl(var(--kp-teal))]/10 flex items-center justify-center text-lg font-bold text-[hsl(var(--kp-teal))] shrink-0">{e.fullName?.charAt(0) || '?'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-[hsl(var(--kp-teal))] truncate">{e.fullName}</div>
                    <div className="text-xs text-gray-500">{e.idNumber || '—'} • {e.personType}</div>
                  </div>
                  <div className="relative">
                    <button onClick={() => setMenuOpen(menuOpen === e.id ? null : e.id)} className="p-1.5 rounded-lg hover:bg-gray-100">
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </button>
                    {menuOpen === e.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                        <div className="absolute right-0 top-10 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 text-left">
                          <MenuItem icon={Eye} label="View Profile" onClick={() => setMenuOpen(null)} />
                          <MenuItem icon={ScanFace} label="Test Recognition" onClick={() => handleAction('test', e)} />
                          <MenuItem icon={RefreshCw} label="Re-record Face" onClick={() => handleAction('record', e)} />
                          <MenuItem icon={ShieldOff} label="Suspend" onClick={() => handleAction('suspend', e)} />
                          <MenuItem icon={Shield} label="Activate" onClick={() => handleAction('activate', e)} />
                          <MenuItem icon={Trash2} label="Delete Record" danger onClick={() => { setDeleteTarget(e); setMenuOpen(null); }} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[e.recognitionStatus] || 'bg-gray-100 text-gray-700'}`}>{e.recognitionStatus}</span>
                  <span className="text-xs text-gray-400">{e.registrationDate || ''}</span>
                </div>
                <div className="mt-2 text-xs text-gray-500">Quality: {e.enrollmentQualityScore || '—'}% • Matches: {e.successfulMatchCount || 0}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
              <h3 className="font-bold text-[hsl(var(--kp-teal))]">Delete Facial Record</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              You are about to delete the facial recognition record for <strong>{deleteTarget.fullName}</strong>.
              This action will preserve the audit log but remove biometric data access. Please provide a reason.
            </p>
            <textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)} placeholder="Reason for deletion..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white mb-4 min-h-[80px]" />
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={confirmDelete} disabled={actionLoading} className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button onClick={onClick} className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'}`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}