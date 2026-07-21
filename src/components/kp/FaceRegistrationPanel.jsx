import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { logAudit } from '@/lib/audit';
import FaceEnrollModal from '@/components/kp/FaceEnrollModal';
import { ScanFace, Trash2, RefreshCw, ShieldCheck, Loader2 } from 'lucide-react';

const STATUS_STYLE = {
  'Not Registered': 'bg-gray-100 text-gray-600',
  'Registration In Progress': 'bg-yellow-100 text-yellow-700',
  'Consent Pending': 'bg-yellow-100 text-yellow-700',
  'Processing': 'bg-blue-100 text-blue-700',
  'Active': 'bg-green-100 text-green-700',
  'Low Quality': 'bg-orange-100 text-orange-700',
  'Re-enrollment Required': 'bg-orange-100 text-orange-700',
  'Needs Update': 'bg-orange-100 text-orange-700',
  'Suspended': 'bg-red-100 text-red-700',
  'Disabled': 'bg-gray-100 text-gray-500',
  'Deleted': 'bg-gray-100 text-gray-500',
};

export default function FaceRegistrationPanel({ personProfileId, personType, idNumber, fullName, registeredBy, onPhotoChange }) {
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    base44.entities.FaceEnrollment.filter({ personProfileId }).then((rows) => {
      setEnrollment(rows && rows[0] ? rows[0] : null);
    }).catch(() => setEnrollment(null)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [personProfileId]);

  const status = enrollment?.recognitionStatus || 'Not Registered';
  const active = status === 'Active';

  const remove = async () => {
    if (!enrollment) return;
    if (!window.confirm('Delete facial data? This permanently removes the face template and capture records. The user must re-enroll to use face attendance.')) return;
    setBusy(true);
    try {
      await base44.entities.FaceTemplateReference.deleteMany({ enrollmentId: enrollment.facialRecordId || enrollment.id }).catch(() => {});
      await base44.entities.FaceCaptureSession.deleteMany({ enrollmentId: enrollment.facialRecordId || enrollment.id }).catch(() => {});
      await base44.entities.FaceEnrollment.update(enrollment.id, { recognitionStatus: 'Deleted', accountStatus: 'Disabled' }).catch(() => {});
      await logAudit('Deletion', 'FaceEnrollment', personProfileId, `Facial data deleted for ${fullName}.`);
      load();
    } finally { setBusy(false); }
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[status] || 'bg-gray-100 text-gray-600'}`}>
          {loading ? 'Checking…' : status}
        </span>
        {active && <span className="text-[11px] text-green-600 flex items-center gap-0.5"><ShieldCheck className="w-3 h-3" /> Template active</span>}
      </div>
      <div className="flex gap-2">
        {!active ? (
          <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[hsl(var(--kp-green))] text-white text-xs font-semibold hover:brightness-105 shadow-md">
            <ScanFace className="w-3.5 h-3.5" /> Register Face
          </button>
        ) : (
          <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[hsl(var(--kp-teal))] text-white text-xs font-semibold hover:brightness-105 shadow-md">
            <RefreshCw className="w-3.5 h-3.5" /> Re-register
          </button>
        )}
        {enrollment && (
          <button onClick={remove} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-300 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
          </button>
        )}
      </div>
      <FaceEnrollModal
        open={open}
        onClose={() => setOpen(false)}
        personProfileId={personProfileId}
        personType={personType}
        idNumber={idNumber}
        fullName={fullName}
        registeredBy={registeredBy}
        existingEnrollmentId={enrollment?.id}
        onPhotoChange={onPhotoChange}
        onDone={load}
      />
    </div>
  );
}