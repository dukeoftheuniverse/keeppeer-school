import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  AlertTriangle, Loader2, Shield, CheckCircle2, XCircle, Eye, UserPlus,
  FileText, Bell, ShieldAlert, Filter, X, ChevronDown
} from 'lucide-react';

const RESULT_COLOR = {
  'No Match': 'bg-gray-100 text-gray-700',
  'Low Confidence': 'bg-yellow-100 text-yellow-700',
  'Multiple Faces': 'bg-orange-100 text-orange-700',
  'Poor Lighting': 'bg-blue-100 text-blue-700',
  'Face Too Far': 'bg-blue-100 text-blue-700',
  'Spoofing Detected': 'bg-red-100 text-red-700',
  'Suspended Account': 'bg-red-100 text-red-700',
  'Camera Permission Denied': 'bg-purple-100 text-purple-700',
  'Connection Error': 'bg-purple-100 text-purple-700',
};
const SEVERITY_COLOR = { 'Info': 'bg-blue-100 text-blue-700', 'Warning': 'bg-yellow-100 text-yellow-700', 'High': 'bg-orange-100 text-orange-700', 'Critical': 'bg-red-100 text-red-700' };

export default function FailedRecognitionReview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState('failed');
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState({ resultType: '', severity: '', status: '', reviewType: '' });
  const [reviewDialog, setReviewDialog] = useState(null);
  const [resolveDialog, setResolveDialog] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [resolveNotes, setResolveNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [att, revs, alts] = await Promise.all([
        base44.entities.RecognitionAttempt.list('-created_date', 200).catch(() => []),
        base44.entities.ManualReview.filter({ reviewDecision: 'Pending' }).catch(() => []),
        base44.entities.SecurityAlert.list('-created_date', 50).catch(() => []),
      ]);
      setAttempts(att.filter(a => a.result !== 'Success'));
      setReviews(revs);
      setAlerts(alts);
    } catch (e) { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sendToReview = async (attempt) => {
    setActionLoading(true);
    try {
      await base44.entities.ManualReview.create({
        attemptId: attempt.attemptId, reviewType: 'Low Confidence Match',
        confidenceScore: attempt.confidenceScore,
        reason: `Failed recognition: ${attempt.result} at ${attempt.scannerLocation}`,
        submittedBy: user?.full_name || 'Admin', submittedDate: new Date().toLocaleDateString('en-CA'),
        reviewDecision: 'Pending',
      });
      await load();
      alert('Sent to manual review queue.');
    } catch (e) { alert('Failed to send to review.'); }
    setActionLoading(false);
  };

  const doReview = async (decision) => {
    if (!reviewDialog) return;
    setActionLoading(true);
    try {
      await base44.entities.ManualReview.update(reviewDialog.id, {
        reviewDecision: decision, reviewedBy: user?.full_name || 'Admin',
        reviewDate: new Date().toLocaleDateString('en-CA'), notes: reviewNotes,
      });
      await base44.entities.BiometricAuditLog.create({
        action: 'Manual Review', enrollmentId: reviewDialog.enrollmentId,
        personProfileId: reviewDialog.personProfileId,
        performedBy: user?.full_name || 'Admin', timestamp: new Date().toISOString(),
        details: `Review ${decision}: ${reviewDialog.reason}. Notes: ${reviewNotes}`, isBiometricData: false,
      });
      setReviewDialog(null); setReviewNotes('');
      await load();
    } catch (e) { alert('Review action failed.'); }
    setActionLoading(false);
  };

  const resolveAlert = async () => {
    if (!resolveDialog) return;
    setActionLoading(true);
    try {
      await base44.entities.SecurityAlert.update(resolveDialog.id, {
        status: 'Resolved', resolvedBy: user?.full_name || 'Admin',
        resolvedDate: new Date().toLocaleDateString('en-CA'), resolutionNotes: resolveNotes,
      });
      setResolveDialog(null); setResolveNotes('');
      await load();
    } catch (e) { alert('Failed to resolve alert.'); }
    setActionLoading(false);
  };

  const filteredAttempts = filter.resultType ? attempts.filter(a => a.result === filter.resultType) : attempts;
  const filteredReviews = filter.reviewType ? reviews.filter(r => r.reviewType === filter.reviewType) : reviews;
  const filteredAlerts = filter.severity ? alerts.filter(a => a.severity === filter.severity) : filter.status ? alerts.filter(a => a.status === filter.status) : alerts;

  return (
    <div className="kp-dash-bg min-h-screen pb-10">
      <div className="bg-[hsl(var(--kp-teal))] px-4 sm:px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/facial-recognition')} className="text-white/80 hover:text-white text-sm font-medium">← Dashboard</button>
          <div className="flex-1" />
          <div className="text-white font-bold text-lg flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Failed Recognition & Manual Review</div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Tabs */}
        <div className="kp-glass-card rounded-2xl p-2 flex gap-1">
          <TabBtn active={tab === 'failed'} onClick={() => setTab('failed')} icon={XCircle} label="Failed Recognition Log" count={filteredAttempts.length} />
          <TabBtn active={tab === 'reviews'} onClick={() => setTab('reviews')} icon={Eye} label="Manual Review Queue" count={filteredReviews.length} />
          <TabBtn active={tab === 'alerts'} onClick={() => setTab('alerts')} icon={ShieldAlert} label="Security Alerts" count={filteredAlerts.length} />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-[hsl(var(--kp-teal))] animate-spin" /></div>
        ) : (
          <>
            {/* Failed Recognition Log */}
            {tab === 'failed' && (
              <>
                <div className="flex gap-2">
                  <select value={filter.resultType} onChange={e => setFilter({ ...filter, resultType: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                    <option value="">All Results</option>
                    {Object.keys(RESULT_COLOR).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                {filteredAttempts.length === 0 ? (
                  <EmptyState icon={CheckCircle2} text="No failed recognition attempts. Everything is running smoothly." />
                ) : (
                  <div className="kp-glass-card rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto kp-scroll-thin">
                      <table className="w-full text-sm">
                        <thead className="bg-[hsl(var(--kp-teal))]/5 text-xs uppercase text-[hsl(var(--kp-teal))]">
                          <tr>
                            <th className="text-left p-3 font-semibold">Date/Time</th>
                            <th className="text-left p-3 font-semibold">Location</th>
                            <th className="text-left p-3 font-semibold">Result</th>
                            <th className="text-left p-3 font-semibold hidden sm:table-cell">Type</th>
                            <th className="text-left p-3 font-semibold hidden md:table-cell">Quality</th>
                            <th className="text-left p-3 font-semibold hidden lg:table-cell">Liveness</th>
                            <th className="text-right p-3 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAttempts.map(a => (
                            <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                              <td className="p-3 text-gray-600 text-xs whitespace-nowrap">{a.timestamp ? new Date(a.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                              <td className="p-3 text-gray-600 text-xs">{a.scannerLocation || '—'}</td>
                              <td className="p-3"><span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${RESULT_COLOR[a.result] || 'bg-gray-100 text-gray-700'}`}>{a.result}</span></td>
                              <td className="p-3 text-gray-600 hidden sm:table-cell text-xs">{a.personType || 'Unknown'}</td>
                              <td className="p-3 text-gray-600 hidden md:table-cell text-xs">{a.qualityScore ? `${a.qualityScore}%` : '—'}</td>
                              <td className="p-3 hidden lg:table-cell">{a.livenessPassed ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}</td>
                              <td className="p-3 text-right">
                                <div className="flex justify-end gap-1">
                                  <button onClick={() => sendToReview(a)} className="px-2 py-1 rounded text-[10px] font-semibold bg-blue-500 text-white hover:brightness-105">Review</button>
                                  {a.result === 'No Match' && <button onClick={() => navigate('/facial-recognition/record')} className="px-2 py-1 rounded text-[10px] font-semibold bg-green-500 text-white hover:brightness-105">Register</button>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Manual Review Queue */}
            {tab === 'reviews' && (
              <>
                <div className="flex gap-2">
                  <select value={filter.reviewType} onChange={e => setFilter({ ...filter, reviewType: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                    <option value="">All Types</option>
                    <option value="Low Confidence Match">Low Confidence Match</option>
                    <option value="Spoofing Attempt">Spoofing Attempt</option>
                    <option value="Similar Faces">Similar Faces</option>
                    <option value="Repeated Failed Recognition">Repeated Failed Recognition</option>
                    <option value="Suspended Account">Suspended Account</option>
                    <option value="Outside Schedule">Outside Schedule</option>
                    <option value="Manual Override">Manual Override</option>
                  </select>
                </div>
                {filteredReviews.length === 0 ? (
                  <EmptyState icon={CheckCircle2} text="No pending manual reviews. All caught up!" />
                ) : (
                  <div className="kp-glass-card rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto kp-scroll-thin">
                      <table className="w-full text-sm">
                        <thead className="bg-[hsl(var(--kp-teal))]/5 text-xs uppercase text-[hsl(var(--kp-teal))]">
                          <tr>
                            <th className="text-left p-3 font-semibold">Submitted</th>
                            <th className="text-left p-3 font-semibold">Review Type</th>
                            <th className="text-left p-3 font-semibold hidden sm:table-cell">Person</th>
                            <th className="text-left p-3 font-semibold hidden md:table-cell">Confidence</th>
                            <th className="text-left p-3 font-semibold hidden lg:table-cell">Reason</th>
                            <th className="text-right p-3 font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredReviews.map(r => (
                            <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                              <td className="p-3 text-gray-600 text-xs">{r.submittedDate || '—'}</td>
                              <td className="p-3"><span className="text-xs font-semibold text-[hsl(var(--kp-teal))]">{r.reviewType}</span></td>
                              <td className="p-3 text-gray-600 hidden sm:table-cell text-xs">{r.fullName || 'Unknown'}</td>
                              <td className="p-3 text-gray-600 hidden md:table-cell text-xs">{r.confidenceScore ? `${r.confidenceScore}%` : '—'}</td>
                              <td className="p-3 text-gray-600 hidden lg:table-cell text-xs max-w-xs truncate">{r.reason}</td>
                              <td className="p-3 text-right">
                                <div className="flex justify-end gap-1">
                                  <button onClick={() => setReviewDialog({ ...r, decision: 'Approved' })} className="px-2 py-1 rounded text-[10px] font-semibold bg-green-500 text-white hover:brightness-105">Approve</button>
                                  <button onClick={() => setReviewDialog({ ...r, decision: 'Rejected' })} className="px-2 py-1 rounded text-[10px] font-semibold bg-red-500 text-white hover:brightness-105">Reject</button>
                                  <button onClick={() => setReviewDialog({ ...r, decision: 'Requires Re-enrollment' })} className="px-2 py-1 rounded text-[10px] font-semibold bg-orange-500 text-white hover:brightness-105">Re-enroll</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Security Alerts */}
            {tab === 'alerts' && (
              <>
                <div className="flex flex-wrap gap-2">
                  <select value={filter.severity} onChange={e => setFilter({ ...filter, severity: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                    <option value="">All Severity</option>
                    <option value="Info">Info</option>
                    <option value="Warning">Warning</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                  <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                    <option value="">All Status</option>
                    <option value="Open">Open</option>
                    <option value="Investigating">Investigating</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Dismissed">Dismissed</option>
                  </select>
                </div>
                {filteredAlerts.length === 0 ? (
                  <EmptyState icon={Shield} text="No security alerts. System is secure." />
                ) : (
                  <div className="space-y-2">
                    {filteredAlerts.map(a => (
                      <div key={a.id} className="kp-glass-card rounded-2xl p-4 flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${SEVERITY_COLOR[a.severity] || 'bg-gray-100 text-gray-700'}`}>
                          <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-[hsl(var(--kp-teal))]">{a.alertType}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SEVERITY_COLOR[a.severity] || 'bg-gray-100 text-gray-700'}`}>{a.severity}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${a.status === 'Open' ? 'bg-red-100 text-red-700' : a.status === 'Resolved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{a.status}</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{a.description}</p>
                          <div className="text-[10px] text-gray-400 mt-1">{a.timestamp ? new Date(a.timestamp).toLocaleString() : ''} • {a.location || '—'}</div>
                        </div>
                        {a.status !== 'Resolved' && a.status !== 'Dismissed' && (
                          <button onClick={() => setResolveDialog(a)} className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-semibold hover:brightness-105 shrink-0">Resolve</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Review Dialog */}
      {reviewDialog && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setReviewDialog(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[hsl(var(--kp-teal))]">{reviewDialog.decision === 'Approved' ? 'Approve Review' : reviewDialog.decision === 'Rejected' ? 'Reject Review' : 'Require Re-enrollment'}</h3>
              <button onClick={() => setReviewDialog(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="text-sm text-gray-600 mb-2">Review Type: <strong>{reviewDialog.reviewType}</strong></div>
            {reviewDialog.fullName && <div className="text-sm text-gray-600 mb-2">Person: <strong>{reviewDialog.fullName}</strong></div>}
            <div className="text-sm text-gray-600 mb-3">Reason: {reviewDialog.reason}</div>
            <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Enter review notes..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white min-h-[80px] mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setReviewDialog(null)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={() => doReview(reviewDialog.decision)} disabled={actionLoading} className="flex-1 px-4 py-2.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Confirm ${reviewDialog.decision}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Alert Dialog */}
      {resolveDialog && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setResolveDialog(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[hsl(var(--kp-teal))]">Resolve Security Alert</h3>
              <button onClick={() => setResolveDialog(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="text-sm text-gray-600 mb-2">Alert: <strong>{resolveDialog.alertType}</strong></div>
            <div className="text-sm text-gray-600 mb-3">{resolveDialog.description}</div>
            <textarea value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} placeholder="Resolution notes..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white min-h-[80px] mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setResolveDialog(null)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={resolveAlert} disabled={actionLoading} className="flex-1 px-4 py-2.5 rounded-lg bg-green-500 text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Resolve Alert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label, count }) {
  return (
    <button onClick={onClick} className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${active ? 'bg-[hsl(var(--kp-teal))] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
      <Icon className="w-4 h-4" /> {label} <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-gray-100'}`}>{count}</span>
    </button>
  );
}
function EmptyState({ icon: Icon, text }) {
  return (
    <div className="kp-glass-card rounded-2xl p-10 text-center">
      <Icon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}