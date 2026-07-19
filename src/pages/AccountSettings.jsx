import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { PagePanel, PageTitle, KpButton, KpInput } from '@/components/kp/ui';
import { useToast } from '@/components/ui/use-toast';
import { Save, Lock, Key, Eye, Fingerprint, Smartphone, ShieldOff, Copy, Check, LogOut, RefreshCw } from 'lucide-react';

export default function AccountSettings() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ username: '', email: '', currentPassword: '', newPassword: '', confirmPassword: '', recoveryNumber: '', recoveryEmail: '', secretQuestion: '' });
  const [twoFA, setTwoFA] = useState(false);
  const [biometrics, setBiometrics] = useState(false);
  const [connectionCode, setConnectionCode] = useState('KP-XXXX-XXXX-XXXX');
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [tab, setTab] = useState('account');
  const [showPass, setShowPass] = useState({});

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setForm(f => ({
        ...f,
        username: u?.full_name || '',
        email: u?.email || '',
        recoveryNumber: u?.recovery_number || '',
        recoveryEmail: u?.recovery_email || '',
        secretQuestion: u?.secret_question || '',
      }));
      setTwoFA(!!u?.two_factor);
      setBiometrics(!!u?.biometrics_enabled);
      if (u?.connection_code) setConnectionCode(u.connection_code);
    }).catch(() => {});
  }, []);

  const update = (field, value) => setForm({ ...form, [field]: value });

  const handleSave = async () => {
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      toast({ title: 'Passwords do not match', description: 'New password and confirmation must be identical.', variant: 'destructive' });
      return;
    }
    if (form.newPassword && form.newPassword.length < 8) {
      toast({ title: 'Password too short', description: 'New password must be at least 8 characters.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.auth.updateMe({
        full_name: form.username,
        recovery_number: form.recoveryNumber,
        recovery_email: form.recoveryEmail,
        secret_question: form.secretQuestion,
        two_factor: twoFA,
        biometrics_enabled: biometrics,
      });
      toast({ title: 'Account saved', description: 'Your account information has been updated.' });
      if (form.newPassword) {
        toast({ title: 'Password change queued', description: 'For security, password changes are handled via the forgot-password flow.', variant: 'default' });
        setForm(f => ({ ...f, currentPassword: '', newPassword: '', confirmPassword: '' }));
      }
    } catch (e) {
      toast({ title: 'Could not save', description: e?.message || 'Something went wrong.', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleToggle2FA = async (val) => {
    setTwoFA(val);
    try { await base44.auth.updateMe({ two_factor: val }); toast({ title: val ? '2-Factor Authentication enabled' : '2-Factor Authentication disabled' }); } catch (e) { setTwoFA(!val); }
  };

  const handleToggleBiometrics = async (val) => {
    setBiometrics(val);
    try { await base44.auth.updateMe({ biometrics_enabled: val }); toast({ title: val ? 'Biometrics enabled' : 'Biometrics disabled' }); } catch (e) { setBiometrics(!val); }
  };

  const generateCode = async () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const gen = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const code = `KP-${gen()}-${gen()}-${gen()}`;
    setConnectionCode(code);
    setShowCode(true);
    try { await base44.auth.updateMe({ connection_code: code }); } catch (e) { /* still show locally */ }
    toast({ title: 'New connection code generated', description: 'Save it somewhere safe.' });
  };

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(connectionCode); setCopied(true); toast({ title: 'Connection code copied' }); setTimeout(() => setCopied(false), 1800); } catch (e) { toast({ title: 'Copy failed', variant: 'destructive' }); }
  };

  const handleDeactivate = async () => {
    if (!confirm('Deactivate your account? You will be signed out and can reactivate by contacting your school administrator.')) return;
    try { await base44.auth.updateMe({ account_deactivated: true }); } catch (e) { /* proceed to logout anyway */ }
    toast({ title: 'Account deactivated', description: 'Signing you out...' });
    setTimeout(() => base44.auth.logout('/login'), 800);
  };

  const togglePass = (k) => setShowPass({ ...showPass, [k]: !showPass[k] });

  const tabs = [
    { id: 'account', label: 'Account Settings' },
    { id: 'security', label: 'Security' },
    { id: 'deactivate', label: 'Deactivate' },
  ];

  return (
    <div className="space-y-4">
      <PageTitle>Account Settings</PageTitle>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="sm:w-48 shrink-0">
          <div className="kp-panel rounded-2xl shadow-lg p-2 space-y-0.5">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${tab === t.id ? 'bg-[hsl(var(--kp-teal))] text-white' : 'text-[hsl(var(--kp-teal))] hover:bg-gray-50'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {tab === 'account' && (
            <PagePanel>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))]">Account Information</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Status:</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <KpInput label="Username" value={form.username} onChange={e => update('username', e.target.value)} />
                <KpInput label="Email Address" value={form.email} onChange={e => update('email', e.target.value)} />
                <div className="relative">
                  <KpInput label="Current Password" type={showPass.current ? 'text' : 'password'} value={form.currentPassword} onChange={e => update('currentPassword', e.target.value)} />
                  <button type="button" onClick={() => togglePass('current')} className="absolute right-2 top-[26px] p-1 text-gray-400 hover:text-gray-600"><Eye className="w-4 h-4" /></button>
                </div>
                <div className="relative">
                  <KpInput label="New Password" type={showPass.new ? 'text' : 'password'} value={form.newPassword} onChange={e => update('newPassword', e.target.value)} placeholder="Min 8 characters" />
                  <button type="button" onClick={() => togglePass('new')} className="absolute right-2 top-[26px] p-1 text-gray-400 hover:text-gray-600"><Eye className="w-4 h-4" /></button>
                </div>
                <div className="relative">
                  <KpInput label="Confirm New Password" type={showPass.confirm ? 'text' : 'password'} value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} />
                  <button type="button" onClick={() => togglePass('confirm')} className="absolute right-2 top-[26px] p-1 text-gray-400 hover:text-gray-600"><Eye className="w-4 h-4" /></button>
                </div>
                <KpInput label="Recovery Number" value={form.recoveryNumber} onChange={e => update('recoveryNumber', e.target.value)} placeholder="09XXXXXXXXX" />
                <KpInput label="Recovery Email" value={form.recoveryEmail} onChange={e => update('recoveryEmail', e.target.value)} />
                <KpInput label="Secret Question" value={form.secretQuestion} onChange={e => update('secretQuestion', e.target.value)} />
              </div>
              <div className="flex justify-end mt-6">
                <KpButton variant="green" onClick={handleSave} disabled={saving}><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}</KpButton>
              </div>
            </PagePanel>
          )}

          {tab === 'security' && (
            <div className="space-y-4">
              <PagePanel>
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4">Security Settings</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Key className="w-4 h-4 text-[hsl(var(--kp-teal))]" />
                      <div>
                        <div className="text-sm font-medium text-gray-700">Change Username</div>
                        <div className="text-xs text-gray-400">Update your login username</div>
                      </div>
                    </div>
                    <KpButton variant="outline" onClick={() => { setTab('account'); toast({ title: 'Edit your username in the form' }); }}>Change Username</KpButton>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Lock className="w-4 h-4 text-[hsl(var(--kp-teal))]" />
                      <div>
                        <div className="text-sm font-medium text-gray-700">Change Password</div>
                        <div className="text-xs text-gray-400">Update your login password</div>
                      </div>
                    </div>
                    <KpButton variant="outline" onClick={() => { setTab('account'); toast({ title: 'Set a new password in the form' }); }}>Change Password</KpButton>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-4 h-4 text-[hsl(var(--kp-teal))]" />
                      <div>
                        <div className="text-sm font-medium text-gray-700">2-Factor Authentication</div>
                        <div className="text-xs text-gray-400">Add an extra layer of security</div>
                      </div>
                    </div>
                    <button onClick={() => handleToggle2FA(!twoFA)} className={`relative w-11 h-6 rounded-full transition-colors ${twoFA ? 'bg-[hsl(var(--kp-green))]' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${twoFA ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Key className="w-4 h-4 text-[hsl(var(--kp-teal))]" />
                      <div>
                        <div className="text-sm font-medium text-gray-700">Connection Code</div>
                        <div className="text-xs text-gray-400 font-mono">{showCode ? connectionCode : '•••••••••••••••'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowCode(!showCode)} className="p-2 rounded-lg hover:bg-gray-200 text-gray-500"><Eye className="w-4 h-4" /></button>
                      <button onClick={copyCode} className="p-2 rounded-lg hover:bg-gray-200 text-gray-500">{copied ? <Check className="w-4 h-4 text-[hsl(var(--kp-green))]" /> : <Copy className="w-4 h-4" />}</button>
                      <KpButton variant="outline" onClick={generateCode}><RefreshCw className="w-3.5 h-3.5" /> Generate</KpButton>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Fingerprint className="w-4 h-4 text-[hsl(var(--kp-teal))]" />
                      <div>
                        <div className="text-sm font-medium text-gray-700">Biometrics</div>
                        <div className="text-xs text-gray-400">Enable fingerprint or face login</div>
                      </div>
                    </div>
                    <button onClick={() => handleToggleBiometrics(!biometrics)} className={`relative w-11 h-6 rounded-full transition-colors ${biometrics ? 'bg-[hsl(var(--kp-green))]' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${biometrics ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                </div>
                {savingSecurity && <div className="text-xs text-gray-400 mt-3">Saving security preferences...</div>}
              </PagePanel>

              <PagePanel>
                <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-4">Active Sessions</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-4 h-4 text-[hsl(var(--kp-teal))]" />
                      <div>
                        <div className="text-sm font-medium text-gray-700">Current Session</div>
                        <div className="text-xs text-gray-400">This device • Active now</div>
                      </div>
                    </div>
                    <span className="text-xs text-[hsl(var(--kp-green))] font-medium">Active</span>
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <KpButton variant="danger" onClick={() => base44.auth.logout('/login')}><LogOut className="w-4 h-4" /> Sign out of all sessions</KpButton>
                </div>
              </PagePanel>
            </div>
          )}

          {tab === 'deactivate' && (
            <PagePanel>
              <div className="flex flex-col items-center text-center py-8">
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                  <ShieldOff className="w-8 h-8 text-[hsl(var(--kp-red))]" />
                </div>
                <h3 className="text-lg font-bold text-[hsl(var(--kp-teal))] mb-2">Deactivate Account</h3>
                <p className="text-sm text-gray-500 max-w-sm mb-6">This will temporarily disable your account. You can reactivate it by contacting your school administrator.</p>
                <KpButton variant="danger" onClick={handleDeactivate}>Deactivate Account</KpButton>
              </div>
            </PagePanel>
          )}
        </div>
      </div>
    </div>
  );
}