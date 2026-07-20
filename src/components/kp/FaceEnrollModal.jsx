import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import CameraViewfinder from '@/components/kp/CameraViewfinder';
import { X, ScanFace, Loader2, CheckCircle2, AlertTriangle, Save, RefreshCw } from 'lucide-react';

/**
 * FaceEnrollModal — turns on the camera, detects/verifies a face with AI,
 * captures a reference photo, and saves it as the person's facial specimen.
 * Props: open, onClose, personName, onSave(fileUrl) => Promise
 */
export default function FaceEnrollModal({ open, onClose, personName, onSave }) {
  const camRef = useRef(null);
  const [phase, setPhase] = useState('idle'); // idle | detecting | ready | saving | saved | fail
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  if (!open) return null;

  const reset = () => { setPhase('idle'); setPreview(null); setError(null); setInfo(null); };

  const detectFace = async () => {
    setError(null);
    setInfo(null);
    if (!camRef.current || !camRef.current.isStreaming()) { setError('Camera is still starting. Please wait a moment and retry.'); return; }

    const dataURL = camRef.current.capture();
    if (!dataURL) { setError('Could not capture a frame. Please retry.'); return; }

    setPhase('detecting');
    try {
      const blob = await (await fetch(dataURL)).blob();
      const file = new File([blob], 'face-enroll.jpg', { type: 'image/jpeg' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const llm = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a face-capture quality checker for a school ID photo / facial recognition enrollment. Examine the image. Determine:
- has_face: is there exactly ONE clear human face visible?
- frontal: is the face roughly frontal (not profile)?
- well_lit: is lighting adequate (not too dark/bright)?
- clear: is the face in focus and unoccluded (no mask, hand, heavy shadow)?
- suitable: overall suitable to use as a reference photo for facial recognition?
Return ONLY JSON: {"has_face": boolean, "frontal": boolean, "well_lit": boolean, "clear": boolean, "suitable": boolean, "notes": string}`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            has_face: { type: 'boolean' }, frontal: { type: 'boolean' },
            well_lit: { type: 'boolean' }, clear: { type: 'boolean' },
            suitable: { type: 'boolean' }, notes: { type: 'string' },
          },
        },
      });

      if (!llm?.suitable) {
        setPhase('fail');
        setError(llm?.notes || 'Face not suitable for enrollment. Ensure good lighting, face the camera directly, and remove obstructions.');
        return;
      }

      setPreview(file_url);
      setInfo(llm?.notes || 'Face detected and verified.');
      setPhase('ready');
    } catch (e) {
      setPhase('fail');
      setError('Face detection failed: ' + (e?.message || 'unexpected error') + '. Please retry.');
    }
  };

  const save = async () => {
    if (!preview) return;
    setPhase('saving');
    try {
      await onSave(preview);
      setPhase('saved');
    } catch (e) {
      setPhase('ready');
      setError('Could not save: ' + (e?.message || 'unexpected error'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="kp-panel rounded-2xl shadow-2xl w-full max-w-lg p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ScanFace className="w-5 h-5 text-[hsl(var(--kp-teal))]" />
            <h3 className="text-base font-bold text-[hsl(var(--kp-teal))]">Record Facial Specimen</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <p className="text-sm text-gray-500 mb-3">Enrolling <strong className="text-[hsl(var(--kp-teal))]">{personName}</strong>. The camera turns on automatically — face the camera, then tap <strong>Detect &amp; Capture</strong>.</p>

        <CameraViewfinder ref={camRef} active facingMode="user"
          overlay={
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`w-40 h-52 border-4 rounded-[50%] transition-all ${phase === 'detecting' ? 'border-yellow-400 animate-pulse' : phase === 'ready' || phase === 'saved' ? 'border-green-400' : phase === 'fail' ? 'border-red-400' : 'border-white/70'}`} />
            </div>
          }
        >
          <div className="text-center pointer-events-none">
            {phase === 'detecting' && <div className="text-white drop-shadow"><Loader2 className="w-7 h-7 mx-auto mb-1 animate-spin" /><p className="text-sm font-medium">Detecting face...</p></div>}
            {phase === 'ready' && <div><CheckCircle2 className="w-10 h-10 mx-auto text-green-400 drop-shadow" /><p className="text-green-400 font-bold drop-shadow">Face Verified</p></div>}
            {phase === 'fail' && <div><AlertTriangle className="w-10 h-10 mx-auto text-red-400 drop-shadow" /><p className="text-red-400 font-bold drop-shadow">Try Again</p></div>}
          </div>
        </CameraViewfinder>

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-orange-50 border border-orange-200 flex items-start gap-2 text-sm text-orange-700">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}
        {info && !error && (
          <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-200 flex items-start gap-2 text-sm text-green-700">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {info}
          </div>
        )}
        {preview && (phase === 'ready' || phase === 'saving' || phase === 'saved') && (
          <div className="mt-3 flex items-center gap-3">
            <img src={preview} alt="captured" className="w-16 h-16 rounded-xl object-cover border border-gray-200" />
            <span className="text-xs text-gray-500">Reference photo captured and verified by AI.</span>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {phase === 'saved' ? (
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-[hsl(var(--kp-green))] text-white font-bold text-sm flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Done
            </button>
          ) : phase === 'ready' ? (
            <>
              <button onClick={reset} className="flex-1 py-2.5 rounded-lg border border-[hsl(var(--kp-teal))] text-[hsl(var(--kp-teal))] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[hsl(var(--kp-teal))]/10">
                <RefreshCw className="w-4 h-4" /> Retake
              </button>
              <button onClick={save} disabled={phase === 'saving'} className="flex-1 py-2.5 rounded-lg bg-[hsl(var(--kp-green))] text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {phase === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Specimen
              </button>
            </>
          ) : (
            <button onClick={detectFace} disabled={phase === 'detecting'} className="flex-1 py-2.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {phase === 'detecting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanFace className="w-4 h-4" />}
              {phase === 'detecting' ? 'Detecting...' : 'Detect & Capture'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}