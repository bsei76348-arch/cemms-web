// app/admin/settings/page.tsx – Teal Green + Pastel Yellow-Green Theme
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { 
  signOut, updateProfile, updateEmail, updatePassword, 
  EmailAuthProvider, reauthenticateWithCredential
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import AdminSidebar from '../../lib/AdminSidebar';
import { 
  Settings, Calendar, Shield, CheckCircle, XCircle,
  Building2, Mail, Zap, FileText, Info, Zap as ZapIcon,
  FileText as FileTextIcon, RotateCcw, Clock, Save, RefreshCw, AlertTriangle,
  User, Lock, KeyRound, LogOut
} from 'lucide-react';

interface Toast { id: string; type: 'success' | 'error' | 'info'; message: string; }

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const router = useRouter();

  // Tab state
  const [activeTab, setActiveTab] = useState<'system' | 'account'>('system');

  // System settings state
  const [settings, setSettings] = useState({
    system_name: 'CEMMS',
    municipality: 'Marilao, Bulacan',
    contact_email: 'menro@marilao.gov.ph',
    emission_factor_electricity: '0.5',
    report_footer: 'For MENRO Marilao official use only.'
  });

  // Account settings state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);

  const addToast = (type: Toast['type'], message: string) => {
    const id = `toast-${toastIdRef.current++}-${Date.now()}`;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // Load user data when authenticated
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setDisplayName(firebaseUser.displayName || '');
        setEmail(firebaseUser.email || '');
        await loadSettings();
      } else {
        // Fallback: check localStorage for mock user
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('cemms_user');
          if (stored) {
            try {
              const mock = JSON.parse(stored);
              setUser({ uid: mock.uid, email: mock.email, displayName: mock.role });
              setDisplayName(mock.displayName || '');
              setEmail(mock.email || '');
              await loadSettings();
              setLoading(false);
              return;
            } catch {}
          }
        }
        router.push('/login');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const loadSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
      if (settingsDoc.exists()) {
        setSettings(prev => ({ ...prev, ...settingsDoc.data() }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      addToast('error', 'Failed to load settings');
    }
  };

  // ---------- System Settings Handlers ----------
  const handleSaveSystem = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'general'), settings);
      addToast('success', 'System settings updated successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      addToast('error', 'Error updating system settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetSystem = () => {
    if (confirm('Reset all system settings to default?')) {
      setSettings({
        system_name: 'CEMMS',
        municipality: 'Marilao, Bulacan',
        contact_email: 'menro@marilao.gov.ph',
        emission_factor_electricity: '0.5',
        report_footer: 'For MENRO Marilao official use only.'
      });
      addToast('info', 'System settings reset to default');
    }
  };

  // ---------- Account Settings Handlers ----------
  const reauthenticate = async (password: string): Promise<boolean> => {
    if (!user || !user.email) return false;
    const credential = EmailAuthProvider.credential(user.email, password);
    try {
      await reauthenticateWithCredential(user, credential);
      return true;
    } catch (error: any) {
      addToast('error', 'Re-authentication failed: ' + (error.message || 'Wrong password'));
      return false;
    }
  };

  const handleUpdateDisplayName = async () => {
    if (!user) return;
    if (!displayName.trim()) {
      addToast('error', 'Display name cannot be empty');
      return;
    }
    setAccountLoading(true);
    try {
      await updateProfile(user, { displayName: displayName.trim() });
      addToast('success', 'Display name updated successfully');
    } catch (error: any) {
      addToast('error', error.message || 'Failed to update display name');
    } finally {
      setAccountLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!user) return;
    if (!email.trim() || !email.includes('@')) {
      addToast('error', 'Valid email address required');
      return;
    }
    if (!currentPassword) {
      addToast('error', 'Current password required to change email');
      return;
    }

    setAccountLoading(true);
    const reauthed = await reauthenticate(currentPassword);
    if (!reauthed) {
      setAccountLoading(false);
      return;
    }

    try {
      await updateEmail(user, email);
      addToast('success', 'Email updated successfully. You may need to verify your new email.');
      setCurrentPassword('');
    } catch (error: any) {
      addToast('error', error.message || 'Failed to update email');
    } finally {
      setAccountLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!user) return;
    if (!newPassword) {
      addToast('error', 'New password cannot be empty');
      return;
    }
    if (newPassword.length < 6) {
      addToast('error', 'Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('error', 'New passwords do not match');
      return;
    }
    if (!currentPassword) {
      addToast('error', 'Current password required to change password');
      return;
    }

    setAccountLoading(true);
    const reauthed = await reauthenticate(currentPassword);
    if (!reauthed) {
      setAccountLoading(false);
      return;
    }

    try {
      await updatePassword(user, newPassword);
      addToast('success', 'Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      addToast('error', error.message || 'Failed to update password');
    } finally {
      setAccountLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FDF9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={48} className="animate-spin" color="#14B89D" />
          <p style={{ marginTop: 20, color: '#0F5C4B', fontSize: 16 }}>Loading settings...</p>
        </div>
      </div>
    );
  }

  const userName = user?.email?.split('@')[0] || 'Admin';

  return (
    <div style={{ display: 'flex', background: '#F8FDF9', minHeight: '100vh' }}>
      <AdminSidebar userName={userName} onLogout={handleLogout} />

      <div className="main-content">
        {/* Toast Notifications */}
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.type}`}>
              {t.type === 'success' && <CheckCircle size={18} />}
              {t.type === 'error' && <AlertTriangle size={18} />}
              <span style={{ fontSize: 14 }}>{t.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}><XCircle size={16} /></button>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="settings-wrapper">
          <div className="header-card">
            <div>
              <h1>Settings</h1>
              <p>Manage system configuration and your account</p>
            </div>
            <div className="header-actions">
              <div className="live-badge"><span className="live-dot"></span> ADMIN</div>
              <div className="date-badge"><Calendar size={14} /> {new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="settings-wrapper">
          <div className="tabs">
            <button 
              className={`tab ${activeTab === 'system' ? 'active' : ''}`}
              onClick={() => setActiveTab('system')}
            >
              <Settings size={16} /> System Settings
            </button>
            <button 
              className={`tab ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => setActiveTab('account')}
            >
              <User size={16} /> Account Settings
            </button>
          </div>
        </div>

        {/* System Settings Panel */}
        {activeTab === 'system' && (
          <div className="settings-wrapper">
            <div className="settings-panel">
              <div className="panel-header">
                <h3><Settings size={20} /> System Configuration</h3>
                <div className="admin-badge"><Shield size={12} /> Admin Only</div>
              </div>

              {/* General Settings */}
              <div className="settings-section">
                <h4><Building2 size={16} /> General Information</h4>
                <div className="form-group">
                  <label>System Name</label>
                  <input 
                    type="text" 
                    value={settings.system_name}
                    onChange={(e) => setSettings({ ...settings, system_name: e.target.value })}
                    placeholder="CEMMS"
                  />
                  <div className="form-hint"><Info size={12} /> Displayed on header and reports</div>
                </div>
                <div className="form-group">
                  <label>Municipality</label>
                  <input 
                    type="text" 
                    value={settings.municipality}
                    onChange={(e) => setSettings({ ...settings, municipality: e.target.value })}
                    placeholder="Marilao, Bulacan"
                  />
                </div>
                <div className="form-group">
                  <label>Contact Email</label>
                  <input 
                    type="email" 
                    value={settings.contact_email}
                    onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                    placeholder="menro@marilao.gov.ph"
                  />
                  <div className="form-hint"><Mail size={12} /> For system notifications and reports</div>
                </div>
              </div>

              {/* Emission Factor */}
              <div className="settings-section">
                <h4><Zap size={16} /> Carbon Emission Factor</h4>
                <div className="info-card">
                  <FileText size={20} className="info-icon" />
                  <div className="info-content">
                    <strong>Electricity Emission Factor</strong>
                    <p>Based on DENR standards, 1 kilowatt-hour (kWh) of electricity produces 0.50 kg of CO₂. 
                    This value is used to calculate carbon emissions from household electricity consumption.</p>
                  </div>
                </div>
                <div className="form-group">
                  <label>Electricity Emission Factor (kg CO₂/kWh)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={settings.emission_factor_electricity}
                    onChange={(e) => setSettings({ ...settings, emission_factor_electricity: e.target.value })}
                    required
                  />
                  <div className="form-hint"><ZapIcon size={12} /> Default: 0.50 kg CO₂ per kWh · Only change if advised by DENR</div>
                </div>
              </div>

              {/* Report Settings */}
              <div className="settings-section">
                <h4><FileTextIcon size={16} /> Report Settings</h4>
                <div className="form-group">
                  <label>Report Footer Text</label>
                  <textarea 
                    rows={2}
                    value={settings.report_footer}
                    onChange={(e) => setSettings({ ...settings, report_footer: e.target.value })}
                    placeholder="For MENRO Marilao official use only."
                  />
                  <div className="form-hint"><FileText size={12} /> Displayed at the bottom of all generated PDF reports</div>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={handleResetSystem}>
                  <RotateCcw size={14} /> Reset
                </button>
                <button type="button" className="btn-primary" onClick={handleSaveSystem} disabled={saving}>
                  {saving ? <Clock size={14} className="spin" /> : <Save size={14} />}
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Account Settings Panel */}
        {activeTab === 'account' && (
          <div className="settings-wrapper">
            <div className="settings-panel">
              <div className="panel-header">
                <h3><User size={20} /> Account Settings</h3>
                <div className="admin-badge"><Shield size={12} /> Admin Account</div>
              </div>

              <div className="settings-section">
                <h4><User size={16} /> Profile Information</h4>
                <div className="form-group">
                  <label>Display Name</label>
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                  />
                  <button 
                    className="inline-btn" 
                    onClick={handleUpdateDisplayName} 
                    disabled={accountLoading}
                  >
                    Update Name
                  </button>
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                  />
                  <div className="form-hint"><Mail size={12} /> Changing email requires re‑authentication</div>
                  <div className="password-group">
                    <input 
                      type="password" 
                      placeholder="Current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                    <button 
                      className="inline-btn" 
                      onClick={handleUpdateEmail} 
                      disabled={accountLoading}
                    >
                      Update Email
                    </button>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h4><Lock size={16} /> Security</h4>
                <div className="form-group">
                  <label>Change Password</label>
                  <input 
                    type="password" 
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <input 
                    type="password" 
                    placeholder="New password (min. 6 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <input 
                    type="password" 
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button 
                    className="inline-btn" 
                    onClick={handleUpdatePassword} 
                    disabled={accountLoading}
                  >
                    <KeyRound size={14} /> Change Password
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <h4><LogOut size={16} /> Session</h4>
                <button className="btn-danger" onClick={handleLogout}>
                  <LogOut size={14} /> Sign Out
                </button>
              </div>

              <div className="system-info">
                <p>Logged in as: <strong>{user?.email}</strong> · UID: {user?.uid?.slice(0,8)}...</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer note */}
        <div className="settings-wrapper">
          <div className="system-info" style={{ marginTop: '16px', textAlign: 'center' }}>
            <p>CEMMS v1.0 · Developed for MENRO Marilao · {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .animate-spin, .spin {
          animation: spin 1s linear infinite;
        }

        .main-content {
          flex: 1;
          margin-left: 280px;
          padding: 28px 36px;
          background: #F8FDF9;
          min-height: 100vh;
        }

        /* Toast */
        .toast-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1100;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .toast {
          background: white;
          border-radius: 14px;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          border-left: 5px solid;
          font-size: 14px;
        }
        .toast.success { border-left-color: #14B89D; }
        .toast.error { border-left-color: #DC2626; }
        .toast button {
          background: none;
          border: none;
          cursor: pointer;
          margin-left: auto;
          color: #64748B;
        }

        /* Header card */
        .header-card {
          background: #14B89D;
          border-radius: 28px;
          padding: 24px 32px;
          margin-bottom: 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 20px;
          border: 1px solid #9FE5D5;
          box-shadow: 0 6px 16px rgba(20,184,157,0.12);
          width: 100%;
          max-width: 2000px;
        }
        .header-card h1 {
          color: white;
          margin: 0 0 8px;
          font-size: 32px;
          font-weight: 700;
        }
        .header-card p {
          color: #E6F7F3;
          margin: 0;
          font-size: 15px;
        }
        .header-actions {
          display: flex;
          gap: 14px;
          align-items: center;
        }
        .live-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #FEF2F2;
          padding: 8px 18px;
          border-radius: 44px;
          font-size: 13px;
          font-weight: 700;
          color: #DC2626;
        }
        .live-dot {
          width: 8px;
          height: 8px;
          background: #DC2626;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        .date-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          padding: 8px 18px;
          border-radius: 44px;
          font-size: 13px;
          color: #0F5C4B;
          font-weight: 500;
          border: 1px solid #9FE5D5;
        }

        /* Tabs */
        .tabs {
          display: flex;
          gap: 12px;
          margin-bottom: 28px;
          background: white;
          padding: 6px;
          border-radius: 60px;
          width: fit-content;
          border: 1px solid #9FE5D5;
        }
        .tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 28px;
          border-radius: 44px;
          background: transparent;
          border: none;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          color: #4B5563;
          font-size: 14px;
        }
        .tab.active {
          background: #14B89D;
          color: white;
        }
        .tab:hover:not(.active) {
          background: #E6F7F3;
        }

        /* Settings wrapper & panel */
        .settings-wrapper {
          display: flex;
          justify-content: center;
          padding: 0 16px;
          width: 100%;
        }
        .settings-panel {
          width: 100%;
          max-width: 2000px;
          background: white;
          border-radius: 28px;
          padding: 28px 32px;
          border: 1px solid #C8E6C9;
          box-shadow: 0 4px 12px rgba(0,0,0,0.04);
          margin-bottom: 28px;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
          padding-bottom: 16px;
          border-bottom: 2px solid #E5E7EB;
        }
        .panel-header h3 {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #166534;
          margin: 0;
          font-size: 22px;
          font-weight: 700;
        }
        .admin-badge {
          background: #8B0000;
          color: white;
          padding: 5px 14px;
          border-radius: 40px;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* Sections */
        .settings-section {
          margin-bottom: 36px;
        }
        .settings-section h4 {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #166534;
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 700;
        }
        .form-group {
          margin-bottom: 24px;
        }
        .form-group label {
          display: block;
          margin-bottom: 8px;
          color: #0F5C4B;
          font-weight: 600;
          font-size: 14px;
        }
        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #C8E6C9;
          border-radius: 20px;
          font-size: 14px;
          outline: none;
          transition: all 0.2s;
          background: #F9FAFB;
          margin-bottom: 12px;
        }
        .form-group input:focus,
        .form-group textarea:focus {
          border-color: #14B89D;
          box-shadow: 0 0 0 3px rgba(20,184,157,0.1);
        }
        .form-hint {
          font-size: 12px;
          color: #64748B;
          margin-top: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .inline-btn {
          background: #E6F7F3;
          border: 1px solid #9FE5D5;
          color: #14B89D;
          padding: 8px 20px;
          border-radius: 40px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 8px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .inline-btn:hover:not(:disabled) {
          background: #14B89D;
          color: white;
          border-color: #14B89D;
        }
        .password-group {
          margin-top: 12px;
        }
        .btn-danger {
          background: #DC2626;
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 44px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }
        .btn-danger:hover {
          background: #B91C1C;
          transform: translateY(-1px);
        }

        /* Info card */
        .info-card {
          background: #E9F5DB;
          border-radius: 20px;
          padding: 20px;
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
          border: 1px solid #D4E8B3;
        }
        .info-icon {
          color: #14B89D;
          flex-shrink: 0;
        }
        .info-content strong {
          display: block;
          color: #166534;
          margin-bottom: 6px;
          font-size: 14px;
        }
        .info-content p {
          margin: 0;
          font-size: 13px;
          color: #4B5563;
          line-height: 1.5;
        }

        /* Form actions */
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 16px;
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #E5E7EB;
        }
        .btn-primary, .btn-secondary {
          padding: 10px 28px;
          border-radius: 44px;
          border: none;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }
        .btn-primary {
          background: #14B89D;
          color: white;
        }
        .btn-primary:hover:not(:disabled) {
          background: #0F5C4B;
          transform: translateY(-1px);
        }
        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn-secondary {
          background: #F3F4F6;
          border: 1px solid #D1D5DB;
          color: #374151;
        }
        .btn-secondary:hover {
          background: #E5E7EB;
        }

        .system-info {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #E5E7EB;
          text-align: center;
          color: #94A3B8;
          font-size: 12px;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .main-content { margin-left: 0; padding: 20px; }
          .settings-wrapper { padding: 0 12px; }
          .settings-panel { max-width: 100%; padding: 24px; }
          .header-card { padding: 20px 24px; }
        }
        @media (max-width: 768px) {
          .header-card { flex-direction: column; align-items: flex-start; gap: 16px; }
          .tabs { width: 100%; justify-content: center; }
          .tab { flex: 1; justify-content: center; }
          .settings-panel { padding: 20px 16px; }
        }
        @media (max-width: 480px) {
          .main-content { padding: 16px; }
          .settings-panel, .header-card { border-radius: 24px; padding: 16px; }
          .panel-header { flex-direction: column; align-items: flex-start; gap: 12px; }
          .form-actions { flex-direction: column; gap: 12px; }
          .btn-primary, .btn-secondary, .btn-danger { width: 100%; justify-content: center; }
          .inline-btn { width: 100%; justify-content: center; }
        }
      `}</style>
    </div>
  );
}