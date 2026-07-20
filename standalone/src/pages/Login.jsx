import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { GraduationCap, Mail, Lock, User, Loader2, AlertCircle } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { checkUserAuth } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const next = new URLSearchParams(location.search).get('next') || '/';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === 'login') await base44.auth.login(email, password);
      else await base44.auth.register({ email, password, full_name: name, role: 'admin' });
      await checkUserAuth();
      navigate(next);
    } catch (e2) {
      setErr(e2.message || 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen kp-wave-bg flex items-center justify-center p-4">
      <div className="kp-panel rounded-3xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--kp-teal))] mx-auto flex items-center justify-center mb-3">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[hsl(var(--kp-teal))]">KeepPeer School</h1>
          <p className="text-sm text-gray-500">Standalone · MySQL</p>
        </div>

        <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
          {['login', 'register'].map((m) => (
            <button key={m} onClick={() => setMode(m)} type="button"
              className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize ${mode === m ? 'bg-white text-[hsl(var(--kp-teal))] shadow' : 'text-gray-500'}`}>
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required
                className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--kp-teal))]/15" />
          </div>

          {err && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {err}
            </div>
          )}

          <button type="submit" disabled={busy}
            className="w-full py-2.5 rounded-lg bg-[hsl(var(--kp-teal))] text-white font-semibold flex items-center justify-center gap-2 hover:brightness-105 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <p className="text-xs text-gray-400 text-center mt-4">First registered account becomes the admin.</p>
      </div>
    </div>
  );
}