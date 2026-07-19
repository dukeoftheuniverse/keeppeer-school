import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { logAudit } from '@/lib/audit';
import {
  UserPlus, ScanFace, Database, Clock, Monitor, AlertTriangle, Settings,
  Users, GraduationCap, Briefcase, UserCheck, Shield, CheckCircle2, XCircle,
  Loader2, Scan, Fingerprint, Activity, Bell, RefreshCw, Camera, ShieldAlert,
  ChevronRight, FileText
} from 'lucide-react';

export default function FacialRecognitionDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalFaces: 0,
    students: 0,
    teachers: 0,
    employees: 0,
    visitors: 0,
    successToday: 0,
    failedToday: 0,
    pendingReg: 0,
    spoofingAlerts: 0,
    reEnrollment: 0,
  });

  const today = new Date().toLocaleDateString('en-CA');

  const loadStats = useCallback(async () => {
    try {
      const enrollments = await base44.entities.FaceEnrollment.list().catch(() => []);
      const attempts = await base44.entities.RecognitionAttempt.filter({ timestamp: today }).catch(() => []);
      const alerts = await base44.entities.SecurityAlert.filter({ alertType: 'Spoofing Attempt', status: 'Open' }).catch(() => []);

      const active = enrollments.filter(e => e.recognitionStatus === 'Active');
      setStats({
        totalFaces: active.length,
        students: active.filter(e => e.personType === 'Student').length,
        teachers: active.filter(e => e.personType === 'Teacher').length,
        employees: active.filter(e => e.personType === 'Employee').length,
        visitors: active.filter(e => e.personType === 'Authorized Visitor').length,
        successToday: attempts.filter(a => a.result === 'Success').length,
        failedToday: attempts.filter(a => a.result !== 'Success').length,
        pendingReg: enrollments.filter(e => ['Registration In Progress', 'Consent Pending', 'Face Recording Required'].includes(e.recognitionStatus)).length,
        spoofingAlerts: alerts.length,
        reEnrollment: enrollments.filter(e => e.reEnrollmentStatus === 'Required').length,
      });
    } catch (e) { /* */ }
  }, [today]);

  useEffect(() => {
    (async () => { await loadStats(); setLoading(false); })();
  }, [loadStats]);

  const refresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const actionButtons = [
    { label: 'Record & Profile Person', desc: 'Enroll new face', icon: UserPlus, color: 'bg-green-500', path: '/facial-recognition/record' },
    { label: 'Scan and Recognize Face', desc: 'Live face scan', icon: ScanFace, color: 'bg-blue-500', path: '/facial-recognition/scan' },
    { label: 'Registered Face Database', desc: 'View all faces', icon: Database, color: 'bg-purple-500', path: '/facial-recognition/database' },
    { label: 'Attendance Records', desc: 'View transactions', icon: Clock, color: 'bg-orange-500', path: '/facial-recognition/attendance' },
    { label: 'Scanner Devices', desc: 'Manage scanners', icon: Monitor, color: 'bg-gray-500', path: '/facial-recognition/scanners' },
    { label: 'Failed Recognition Review', desc: 'Review queue', icon: AlertTriangle, color: 'bg-red-500', path: '/facial-recognition/review' },
    { label: 'Facial Recognition Settings', desc: 'Configure system', icon: Settings, color: 'bg-gray-800', path: '/facial-recognition/settings' },
    { label: 'Reports & Analytics', desc: 'View analytics', icon: FileText, color: 'bg-indigo-500', path: '/facial-recognition/reports' },
  ];

  const summaryCards = [
    { label: 'Total Registered Faces', value: stats.totalFaces, icon: Fingerprint, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Students Registered', value: stats.students, icon: GraduationCap, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Teachers Registered', value: stats.teachers, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Employees Registered', value: stats.employees, icon: Briefcase, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Visitors Registered', value: stats.visitors, icon: UserCheck, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Successful Scans Today', value: stats.successToday, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Failed Scans Today', value: stats.failedToday, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Pending Face Registrations', value: stats.pendingReg, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Spoofing Alerts', value: stats.spoofingAlerts, icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Re-enrollment Required', value: stats.reEnrollment, icon: RefreshCw, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  ];

  return (
    <div className="kp-dash-bg min-h-screen pb-10">
      {/* Header */}
      <div className="bg-[hsl(var(--kp-teal))] px-4 sm:px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
              <Scan className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg sm:text-xl">Facial Recognition & Attendance Control</h1>
              <p className="text-white/70 text-xs sm:text-sm">SIMULATED MODE — No real biometric API connected</p>
            </div>
          </div>
          <button onClick={refresh} disabled={refreshing} className="text-white bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Action Buttons Grid */}
        <div>
          <h2 className="text-sm font-bold text-[hsl(var(--kp-teal))] uppercase tracking-wider mb-3">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {actionButtons.map((btn) => (
              <button
                key={btn.label}
                onClick={() => navigate(btn.path)}
                className="kp-glass-card rounded-2xl p-5 text-left hover:scale-[1.02] transition-transform group shadow-sm"
              >
                <div className={`w-12 h-12 rounded-xl ${btn.color} flex items-center justify-center mb-3 shadow-md`}>
                  <btn.icon className="w-6 h-6 text-white" />
                </div>
                <div className="font-bold text-sm text-[hsl(var(--kp-teal))] mb-0.5">{btn.label}</div>
                <div className="text-xs text-gray-500">{btn.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div>
          <h2 className="text-sm font-bold text-[hsl(var(--kp-teal))] uppercase tracking-wider mb-3">Summary Overview</h2>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-[hsl(var(--kp-teal))] animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {summaryCards.map((card) => (
                <div key={card.label} className="kp-glass-card rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                      <card.icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-2xl font-bold text-[hsl(var(--kp-teal))] leading-tight">{card.value}</div>
                      <div className="text-xs text-gray-500 truncate">{card.label}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Simulated Mode Notice */}
        <div className="kp-glass-card rounded-2xl p-5 border-l-4 border-yellow-400">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm text-[hsl(var(--kp-teal))] mb-1">SIMULATED Recognition Mode</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                All facial recognition results shown in this module are <strong>simulated</strong> for demonstration purposes.
                No actual biometric data is collected, stored, or matched. A real facial recognition API must be connected
                before this system can process genuine face data. All matching results are clearly labeled as simulated.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}