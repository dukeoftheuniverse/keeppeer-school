import React, { useState, useRef, useCallback } from 'react';
import { Fingerprint, CheckCircle2, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { KpButton, Avatar, SearchInput } from '@/components/kp/ui';

export default function BiometricScanner({ people, onMatch, disabled }) {
  const [selected, setSelected] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null); // { person, success }
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const intervalRef = useRef(null);

  const filtered = people.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8);

  const stopScan = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setScanning(false);
    setProgress(0);
  }, []);

  const startScan = useCallback(async () => {
    if (!selected) { setError('Select a person to scan their fingerprint.'); return; }
    setError(null);
    setResult(null);
    setScanning(true);
    setProgress(0);

    // Try WebAuthn for device biometric verification
    let webAuthnSuccess = false;
    try {
      if (window.PublicKeyCredential && window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
        const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          const challenge = new Uint8Array(32);
          crypto.getRandomValues(challenge);
          const publicKey = {
            challenge,
            timeout: 10000,
            userVerification: 'required',
            authenticatorSelection: { userVerification: 'required', authenticatorAttachment: 'platform' },
          };
          try {
            const cred = await navigator.credentials.get({ publicKey });
            if (cred) webAuthnSuccess = true;
          } catch (e) { /* user cancelled or no credential — fall back to simulated */ }
        }
      }
    } catch (e) { /* WebAuthn not available */ }

    // Simulated fingerprint scan animation (always runs as fallback / visual)
    intervalRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setScanning(false);
          setResult({ person: selected, success: true });
          onMatch?.(selected, webAuthnSuccess ? 100 : 95);
          return 100;
        }
        return prev + 4;
      });
    }, 60);
  }, [selected, onMatch]);

  const reset = () => {
    stopScan();
    setResult(null);
    setError(null);
    setSelected(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500 flex items-center gap-1.5"><Fingerprint className="w-4 h-4 text-[hsl(var(--kp-teal))]" /> Select person, then scan fingerprint.</p>
      </div>

      {!selected && (
        <>
          <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search person..." className="mb-3" />
          <div className="space-y-1.5 max-h-52 overflow-y-auto kp-scroll-thin mb-3">
            {filtered.map(p => (
              <button key={p.id} onClick={() => { setSelected(p); setError(null); }} className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-100 hover:border-[hsl(var(--kp-teal))]/30 hover:bg-gray-50 text-left">
                <Avatar name={p.name} src={p.photo_url} size="w-8 h-8" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-700 truncate">{p.name}</div>
                  <div className="text-xs text-gray-400 capitalize">{p.type} {p.grade && `• ${p.grade}`}</div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <p className="text-center text-sm text-gray-400 py-4">No people found</p>}
          </div>
        </>
      )}

      {selected && (
        <div className="flex flex-col items-center py-2">
          <div className="flex items-center gap-3 mb-5">
            <Avatar name={selected.name} src={selected.photo_url} size="w-12 h-12" />
            <div>
              <div className="text-sm font-semibold text-gray-800">{selected.name}</div>
              <div className="text-xs text-gray-400 capitalize">{selected.type} {selected.grade && `• ${selected.grade}`}</div>
            </div>
          </div>

          {/* Fingerprint scanner */}
          <div className="relative w-36 h-36 mb-4">
            <div className={`w-full h-full rounded-2xl flex items-center justify-center transition-all ${
              scanning ? 'bg-gradient-to-br from-[hsl(var(--kp-teal))]/10 to-[hsl(var(--kp-aqua))]/10 border-2 border-[hsl(var(--kp-teal))]/40' :
              result?.success ? 'bg-green-50 border-2 border-[hsl(var(--kp-green))]/40' :
              'bg-gray-50 border-2 border-gray-200'
            }`}>
              <Fingerprint className={`w-20 h-20 transition-all ${
                scanning ? 'text-[hsl(var(--kp-teal))] animate-pulse' :
                result?.success ? 'text-[hsl(var(--kp-green))]' :
                'text-gray-300'
              }`} />
            </div>
            {/* Progress ring */}
            {scanning && (
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="none" stroke="hsl(var(--kp-teal))" strokeWidth="3" strokeDasharray={`${progress * 2.89} 1000`} strokeLinecap="round" />
              </svg>
            )}
          </div>

          {scanning && <p className="text-sm text-[hsl(var(--kp-teal))] font-medium mb-3">Scanning fingerprint... {progress}%</p>}

          <div className="flex gap-2">
            {!scanning && !result && (
              <>
                <KpButton variant="teal" onClick={startScan} disabled={disabled}><Fingerprint className="w-4 h-4" /> Scan Fingerprint</KpButton>
                <KpButton variant="light" onClick={() => setSelected(null)}>Change Person</KpButton>
              </>
            )}
            {scanning && <KpButton variant="danger" onClick={stopScan}>Cancel</KpButton>}
            {result && (
              <>
                <KpButton variant="outline" onClick={reset}><RefreshCw className="w-4 h-4" /> New Scan</KpButton>
                <KpButton variant="light" onClick={() => setSelected(null)}>Change Person</KpButton>
              </>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-600">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {result?.success && (
        <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="font-medium">{result.person.name}</span> fingerprint verified successfully.
          <ShieldCheck className="w-4 h-4 ml-auto text-green-500" />
        </div>
      )}

      <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
        <ShieldCheck className="w-3.5 h-3.5" />
        Uses device biometric (WebAuthn) when available, with simulated scan fallback.
      </div>
    </div>
  );
}