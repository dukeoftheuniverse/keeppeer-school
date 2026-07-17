import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { PagePanel, PageTitle, KpButton, KpInput } from '@/components/kp/ui';
import { Save, Lock, Key, Eye, Fingerprint, Smartphone, ShieldOff } from 'lucide-react';

export default function AccountSettings() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ username: '', email: '', currentPassword: '', newPassword: '', confirmPassword: '', recoveryNumber: '', recoveryEmail: '', secretQuestion: '' });
  const [twoFA, setTwoFA] = useState(false);
  const [biometrics, setBiometrics] = useState(false);
  const [connectionCode, setConnectionCode] = useState('KP-XXXX-XXXX-XXXX');
  const [showCode, setShowCode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('account');

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setForm(f => ({ ...f, username: u?.full_name || '', email: u?.email || '' }));
    }).catch(() => {});
  }, []);

  const update = (field, value) => setForm({ ...form, [field]: value });

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ full_name: form.username });
    } finally { setSaving(false); }
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const gen = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setConnectionCode(`KP-${gen()}-${gen()}-${gen()}`);
  };

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
                <KpInput label="Current Password" type="password" value={form.currentPassword} onChange={e => update('currentPassword', e.target.value)} />
                <KpInput label="New Password" type="password" value={form.newPassword} onChange={e => update('newPassword', e.target.value)} />
                <KpInput label="Confirm New Password" type="password" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} />
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
                    <KpButton variant="outline">Change Username</KpButton>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Lock className="w-4 h-4 text-[hsl(var(--kp-teal))]" />
                      <div>
                        <div className="text-sm font-medium text-gray-700">Change Password</div>
                        <div className="text-xs text-gray-400">Update your login password</div>
                      </div>
                    </div>
                    <KpButton variant="outline">Change Password</KpButton>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-4 h-4 text-[hsl(var(--kp-teal))]" />
                      <div>
                        <div className="text-sm font-medium text-gray-700">2-Factor Authentication</div>
                        <div className="text-xs text-gray-400">Add an extra layer of security</div>
                      </div>
                    </div>
                    <button onClick={() => setTwoFA(!twoFA)} className={`relative w-11 h-6 rounded-full transition-colors ${twoFA ? 'bg-[hsl(var(--kp-green))]' : 'bg-gray-300'}`}>
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
                      <KpButton variant="outline" onClick={generateCode}>Generate</KpButton>
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
                    <button onClick={() => setBiometrics(!biometrics)} className={`relative w-11 h-6 rounded-full transition-colors ${biometrics ? 'bg-[hsl(var(--kp-green))]' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${biometrics ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                </div>
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
                <KpButton variant="danger">Deactivate Account</KpButton>
              </div>
            </PagePanel>
          )}
        </div>
      </div>
    </div>
  );
}