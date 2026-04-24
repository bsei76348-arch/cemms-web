'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signOut, updatePassword, updateProfile, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import StaffSidebar from '@/app/lib/StaffSidebar';
import { 
  Calendar, Mail, User, Lock, KeyRound, LogOut, CheckCircle, 
  AlertTriangle, Info, Save, RotateCcw, Zap, FileText, Shield,
  XCircle, Building2, RefreshCw
} from 'lucide-react';

// 16 barangays ng Marilao
const barangays = [
  'LOMA DE GATO', 'LAMBAKIN', 'ABANGAN NORTE', 'ABANGAN SUR',
  'SAOG', 'LIAS', 'STA. ROSA 1', 'STA. ROSA 2',
  'PRENZA 1', 'PRENZA 2', 'POBLACION 1', 'POBLACION 2',
  'IBAYO', 'PATUBIG', 'TABING ILOG', 'NAGBALON'
];

interface Toast { id: string; type: 'success' | 'error' | 'info'; message: string; }

export default function StaffSettings() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const router = useRouter();

  // Staff details
  const [staffDetails, setStaffDetails] = useState({
    fullname: '',
    displayName: '',
    email: '',
    contact: '',
    username: '',
    assigned_barangay: ''
  });

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  
  // System info
  const [emissionFactor, setEmissionFactor] = useState('0.50');
  const [systemName, setSystemName] = useState('CEMMS');

  const addToast = (type: Toast['type'], message: string) => {
    const id = `toast-${toastIdRef.current++}-${Date.now()}`;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (authUser) => {
      if (authUser) {
        setUser(authUser);
        
        try {
          // Load user profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', authUser.uid));
          const authDisplayName = authUser.displayName || '';
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setStaffDetails({
              fullname: userData.name || userData.fullname || authDisplayName || '',
              displayName: authDisplayName,
              email: authUser.email || '',
              contact: userData.contact || '',
              username: userData.username || authUser.email?.split('@')[0] || 'staff',
              assigned_barangay: userData.assignedBarangay || userData.barangay || 'Not assigned'
            });
          } else {
            setStaffDetails({
              fullname: authDisplayName || authUser.email?.split('@')[0] || 'Staff User',
              displayName: authDisplayName,
              email: authUser.email || '',
              contact: '',
              username: authUser.email?.split('@')[0] || 'staff',
              assigned_barangay: 'Not assigned'
            });
          }
          
          // Load system settings (read-only)
          const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
          if (settingsDoc.exists()) {
            const data = settingsDoc.data();
            setEmissionFactor(data.emission_factor_electricity || '0.50');
            setSystemName(data.system_name || 'CEMMS');
          }
        } catch (error) {
          console.error('Error fetching data:', error);
          addToast('error', 'Failed to load profile data');
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      addToast('error', 'Logout failed');
    }
  };

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

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffDetails.fullname.trim()) {
      addToast('error', 'Full name cannot be empty');
      return;
    }
    
    setSaving(true);
    try {
      // Update Firebase Auth displayName
      if (user && staffDetails.fullname !== user.displayName) {
        await updateProfile(user, { displayName: staffDetails.fullname.trim() });
      }
      
      // Update Firestore user document
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name: staffDetails.fullname,
        fullname: staffDetails.fullname,
        contact: staffDetails.contact,
        updatedAt: new Date()
      });
      
      // Update local displayName state
      setStaffDetails(prev => ({ ...prev, displayName: staffDetails.fullname }));
      addToast('success', 'Profile updated successfully!');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      addToast('error', err.message || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.new !== passwordForm.confirm) {
      addToast('error', 'New password and confirm password do not match.');
      return;
    }
    
    if (passwordForm.new.length < 8) {
      addToast('error', 'Password must be at least 8 characters.');
      return;
    }
    
    if (passwordForm.current === passwordForm.new) {
      addToast('error', 'New password must be different from current password.');
      return;
    }
    
    setSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, passwordForm.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwordForm.new);
      
      addToast('success', 'Password changed successfully!');
      setPasswordForm({ current: '', new: '', confirm: '' });
    } catch (err: any) {
      console.error('Error changing password:', err);
      if (err.code === 'auth/wrong-password') {
        addToast('error', 'Current password is incorrect.');
      } else if (err.code === 'auth/weak-password') {
        addToast('error', 'Password is too weak. Use at least 8 characters.');
      } else {
        addToast('error', err.message || 'Failed to change password. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FDF9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={48} className="animate-spin" color="#14B89D" />
          <p style={{ marginTop: 20, color: '#0F5C4B', fontSize: 16 }}>Loading settings...</p>
        </div>
        <style jsx>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          .animate-spin { animation: spin 1s linear infinite; }
        `}</style>
      </div>
    );
  }

  const username = staffDetails.username || 'Staff';

  return (
    <div style={{ display: 'flex', background: '#F8FDF9', minHeight: '100vh' }}>
      <StaffSidebar userName={username} />
      
      <div className="main-content">
        {/* Toast Notifications */}
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.type}`}>
              {t.type === 'success' && <CheckCircle size={18} />}
              {t.type === 'error' && <AlertTriangle size={18} />}
              {t.type === 'info' && <Info size={18} />}
              <span style={{ fontSize: 14 }}>{t.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>
                <XCircle size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="settings-wrapper">
          <div className="header-card">
            <div>
              <h1>Staff Settings</h1>
              <p>Manage your profile and account security</p>
            </div>
            <div className="header-actions">
              <div className="staff-badge">
                <Shield size={12} /> STAFF
              </div>
              <div className="date-badge">
                <Calendar size={14} /> {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Main Settings Panel */}
        <div className="settings-wrapper">
          <div className="settings-panel">
            {/* Staff Info Card */}
            <div className="profile-summary">
              <div className="avatar">👤</div>
              <div className="profile-info">
                <h3>{staffDetails.fullname || username}</h3>
                <p className="role">MENRO Staff · {staffDetails.assigned_barangay !== 'Not assigned' ? staffDetails.assigned_barangay : 'Unassigned'}</p>
                <p className="email"><Mail size={14} /> {user?.email}</p>
              </div>
              <div className="profile-meta">
                <div><span>Staff ID:</span> <strong>#{user?.uid?.slice(0,8).toUpperCase()}</strong></div>
                <div><span>Role:</span> <strong>Field Staff</strong></div>
              </div>
            </div>

            {/* Edit Profile Section */}
            <div className="settings-section">
              <div className="section-header">
                <User size={20} />
                <h4>Profile Information</h4>
              </div>
              <form onSubmit={handleUpdateProfile}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    value={staffDetails.fullname} 
                    onChange={(e) => setStaffDetails({...staffDetails, fullname: e.target.value})} 
                    required 
                    placeholder="Your full name"
                  />
                  <div className="form-hint"><Info size={12} /> This will be displayed on your profile and reports</div>
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    value={user?.email || ''} 
                    disabled 
                    readOnly 
                    className="readonly-input"
                  />
                  <div className="form-hint"><Mail size={12} /> Email cannot be changed. Contact administrator.</div>
                </div>
                <div className="form-group">
                  <label>Contact Number</label>
                  <input 
                    type="tel" 
                    value={staffDetails.contact} 
                    onChange={(e) => setStaffDetails({...staffDetails, contact: e.target.value})} 
                    placeholder="e.g., 09123456789"
                  />
                </div>
                <div className="form-group">
                  <label>Username</label>
                  <input 
                    type="text" 
                    value={staffDetails.username} 
                    disabled 
                    readOnly 
                    className="readonly-input"
                  />
                  <div className="form-hint"><Info size={12} /> Username is based on your email and cannot be changed.</div>
                </div>
                <div className="form-group">
                  <label>Assigned Barangay</label>
                  <input 
                    type="text" 
                    value={staffDetails.assigned_barangay} 
                    disabled 
                    readOnly 
                    className="readonly-input"
                  />
                  <div className="form-hint"><Building2 size={12} /> Contact admin to change your assigned area.</div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>

            {/* Change Password Section */}
            <div className="settings-section">
              <div className="section-header">
                <Lock size={20} />
                <h4>Security</h4>
              </div>
              <form onSubmit={handleChangePassword}>
                <div className="form-group">
                  <label>Current Password</label>
                  <input 
                    type="password" 
                    value={passwordForm.current} 
                    onChange={(e) => setPasswordForm({...passwordForm, current: e.target.value})} 
                    required 
                    autoComplete="current-password"
                  />
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <input 
                    type="password" 
                    value={passwordForm.new} 
                    onChange={(e) => setPasswordForm({...passwordForm, new: e.target.value})} 
                    required 
                    autoComplete="new-password"
                  />
                  <div className="form-hint"><KeyRound size={12} /> Minimum 8 characters</div>
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input 
                    type="password" 
                    value={passwordForm.confirm} 
                    onChange={(e) => setPasswordForm({...passwordForm, confirm: e.target.value})} 
                    required 
                    autoComplete="new-password"
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? <RefreshCw size={14} className="spin" /> : <KeyRound size={14} />}
                    {saving ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>

            {/* System Reference Card (Read-only) */}
            <div className="settings-section">
              <div className="section-header">
                <Zap size={20} />
                <h4>System Reference</h4>
              </div>
              <div className="info-card">
                <FileText size={20} className="info-icon" />
                <div className="info-content">
                  <strong>Carbon Emission Factor</strong>
                  <p>Electricity emission factor: <strong>{emissionFactor} kg CO₂/kWh</strong></p>
                  <p>Based on DENR standards. Used for calculating carbon emissions from household electricity consumption.</p>
                </div>
              </div>
              <div className="info-card">
                <Building2 size={20} className="info-icon" />
                <div className="info-content">
                  <strong>System Information</strong>
                  <p><strong>{systemName}</strong> v1.0 · MENRO Marilao, Bulacan</p>
                  <p>For official use only.</p>
                </div>
              </div>
            </div>

            {/* Account Info & Logout */}
            <div className="settings-section">
              <div className="section-header">
                <Shield size={20} />
                <h4>Account</h4>
              </div>
              <div className="account-info">
                <div className="info-row">
                  <span>Account Created:</span>
                  <strong>{user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'N/A'}</strong>
                </div>
                <div className="info-row">
                  <span>Last Sign In:</span>
                  <strong>{user?.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleString() : 'N/A'}</strong>
                </div>
                <div className="info-row">
                  <span>Account Status:</span>
                  <span className="status-badge">Active</span>
                </div>
              </div>
              <div className="logout-section">
                <button className="btn-danger" onClick={handleLogout}>
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="system-footer">
              <p>{systemName} v1.0 · Developed for MENRO Marilao · {new Date().getFullYear()}</p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }

        .main-content {
          flex: 1;
          margin-left: 280px;
          padding: 28px 36px;
          background: #F8FDF9;
          min-height: 100vh;
        }

        /* Toast Notifications */
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
          min-width: 280px;
        }
        .toast.success { border-left-color: #14B89D; }
        .toast.error { border-left-color: #DC2626; }
        .toast.info { border-left-color: #3B82F6; }
        .toast button {
          background: none;
          border: none;
          cursor: pointer;
          margin-left: auto;
          color: #64748B;
          padding: 4px;
          display: flex;
          align-items: center;
        }
        .toast button:hover {
          color: #374151;
        }

        /* Header Card */
        .settings-wrapper {
          display: flex;
          justify-content: center;
          width: 100%;
        }
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
        .staff-badge {
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

        /* Settings Panel */
        .settings-panel {
          width: 100%;
          max-width: 2000px;
          background: white;
          border-radius: 28px;
          padding: 32px;
          border: 1px solid #C8E6C9;
          box-shadow: 0 4px 12px rgba(0,0,0,0.04);
          margin-bottom: 28px;
        }

        /* Profile Summary */
        .profile-summary {
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 20px 24px;
          background: #F8FDF9;
          border-radius: 24px;
          margin-bottom: 32px;
          flex-wrap: wrap;
          border: 1px solid #E5E7EB;
        }
        .avatar {
          width: 80px;
          height: 80px;
          background: #E6F7F3;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          color: #14B89D;
        }
        .profile-info h3 {
          color: #166534;
          margin: 0 0 4px;
          font-size: 22px;
        }
        .profile-info .role {
          color: #4B5563;
          margin: 0 0 4px;
          font-size: 14px;
        }
        .profile-info .email {
          color: #14B89D;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 0;
        }
        .profile-meta {
          margin-left: auto;
          display: flex;
          gap: 24px;
          color: #6B7280;
          font-size: 13px;
        }
        .profile-meta strong {
          color: #166534;
          margin-left: 6px;
        }

        /* Settings Sections */
        .settings-section {
          margin-bottom: 40px;
          padding-bottom: 32px;
          border-bottom: 1px solid #E5E7EB;
        }
        .settings-section:last-of-type {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        .section-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
          color: #166534;
        }
        .section-header h4 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: #166534;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          margin-bottom: 8px;
          color: #0F5C4B;
          font-weight: 600;
          font-size: 14px;
        }
        .form-group input {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #C8E6C9;
          border-radius: 20px;
          font-size: 14px;
          outline: none;
          transition: all 0.2s;
          background: white;
        }
        .form-group input:focus {
          border-color: #14B89D;
          box-shadow: 0 0 0 3px rgba(20,184,157,0.1);
        }
        .form-group .readonly-input {
          background: #F3F4F6;
          color: #6B7280;
          cursor: not-allowed;
        }
        .form-hint {
          font-size: 12px;
          color: #64748B;
          margin-top: 6px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .form-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 24px;
        }
        .btn-primary {
          background: #14B89D;
          color: white;
          border: none;
          padding: 10px 28px;
          border-radius: 44px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }
        .btn-primary:hover:not(:disabled) {
          background: #0F5C4B;
          transform: translateY(-1px);
        }
        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn-danger {
          background: #DC2626;
          color: white;
          border: none;
          padding: 10px 28px;
          border-radius: 44px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }
        .btn-danger:hover {
          background: #B91C1C;
          transform: translateY(-1px);
        }

        /* Info Cards */
        .info-card {
          background: #E9F5DB;
          border-radius: 20px;
          padding: 20px;
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
          border: 1px solid #D4E8B3;
        }
        .info-card:last-child {
          margin-bottom: 0;
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

        /* Account Info */
        .account-info {
          background: #F9FAFB;
          border-radius: 20px;
          padding: 16px 20px;
          margin-bottom: 24px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #E5E7EB;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-row span:first-child {
          color: #6B7280;
          font-size: 14px;
        }
        .info-row strong {
          color: #166534;
        }
        .status-badge {
          background: #DCFCE7;
          padding: 4px 12px;
          border-radius: 50px;
          color: #166534;
          font-size: 12px;
          font-weight: 600;
        }
        .logout-section {
          display: flex;
          justify-content: center;
          margin-top: 8px;
        }

        /* Footer */
        .system-footer {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #E5E7EB;
          text-align: center;
          color: #94A3B8;
          font-size: 12px;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .main-content {
            margin-left: 0;
            padding: 20px;
          }
          .settings-panel {
            padding: 24px;
          }
          .header-card {
            padding: 20px 24px;
          }
          .profile-summary {
            flex-direction: column;
            text-align: center;
          }
          .profile-meta {
            margin-left: 0;
            justify-content: center;
          }
        }
        @media (max-width: 768px) {
          .header-card {
            flex-direction: column;
            align-items: flex-start;
          }
          .settings-panel {
            padding: 20px;
          }
          .profile-summary {
            padding: 16px;
          }
          .form-actions {
            justify-content: stretch;
          }
          .btn-primary, .btn-danger {
            width: 100%;
            justify-content: center;
          }
        }
        @media (max-width: 480px) {
          .main-content {
            padding: 16px;
          }
          .settings-panel, .header-card {
            border-radius: 24px;
            padding: 16px;
          }
          .profile-meta {
            flex-direction: column;
            gap: 8px;
            align-items: center;
          }
          .info-card {
            flex-direction: column;
            text-align: center;
          }
          .info-icon {
            margin: 0 auto;
          }
        }
      `}</style>
    </div>
  );
}