// app/admin/users/page.tsx – Optimized with real-time updates
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import AdminSidebar from '../../lib/AdminSidebar';
import { Users, User, Shield, UserCog, Plus, FileText, Search, Calendar, Pencil, Trash2, RefreshCw, X, CheckCircle, AlertTriangle } from 'lucide-react';

interface UserType {
  id: string;
  uid?: string;
  username?: string;
  email: string;
  role: 'admin' | 'staff' | 'user';
  barangay?: string;
  lastLogin?: any;
  createdAt?: any;
}

interface Toast { id: string; type: 'success' | 'error' | 'info'; message: string; }

// Helper: get current user (Firebase or mock)
const getCurrentUser = () => {
  if (auth.currentUser) return auth.currentUser;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('cemms_user');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {}
    }
  }
  return null;
};

export default function UsersPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ total: 0, admins: 0, staff: 0, regular_users: 0 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [operationLoading, setOperationLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const router = useRouter();

  const addToast = (type: Toast['type'], message: string) => {
    const id = `toast-${toastIdRef.current++}-${Date.now()}`;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // Real-time listener for users collection
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const usersList: UserType[] = [];
        let adminCount = 0, staffCount = 0, userCount = 0;

        snapshot.forEach((doc) => {
          const data = doc.data();
          const role = data.role || 'user';
          const userData: UserType = {
            id: doc.id,
            uid: data.uid || doc.id,
            email: data.email || '',
            role,
            username: data.username || data.name || data.email?.split('@')[0] || 'User',
            barangay: data.barangay || data.assignedBarangay || '',
            lastLogin: data.lastLogin || null,
            createdAt: data.createdAt || null
          };
          usersList.push(userData);
          if (role === 'admin') adminCount++;
          else if (role === 'staff') staffCount++;
          else userCount++;
        });

        setUsers(usersList);
        setStats({
          total: usersList.length,
          admins: adminCount,
          staff: staffCount,
          regular_users: userCount
        });
        setLoading(false);
      },
      (error) => {
        console.error('Users listener error:', error);
        addToast('error', 'Failed to load users');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Authentication check (only once)
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setCurrentUser(user);
    } else {
      const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
        if (firebaseUser) {
          setCurrentUser(firebaseUser);
        } else {
          router.push('/login');
        }
      });
      return () => unsubscribe();
    }
  }, [router]);

  const handleDelete = async (userId: string) => {
    if (userId === currentUser?.uid) {
      addToast('error', 'You cannot delete your own account!');
      return;
    }
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    setDeleteLoading(userId);
    try {
      await deleteDoc(doc(db, 'users', userId));
      addToast('success', 'User deleted successfully');
      // No need to call fetchUsers because onSnapshot updates automatically
    } catch (error: any) {
      addToast('error', `Delete failed: ${error.message}`);
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setOperationLoading(true);
    try {
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      const username = formData.get('username') as string;
      const role = formData.get('role') as string;
      const barangay = (formData.get('barangay') as string) || null;

      await updateDoc(doc(db, 'users', editingUser.id), {
        username,
        role,
        barangay,
        updatedAt: serverTimestamp()
      });
      addToast('success', 'User updated successfully');
      setShowEditModal(false);
      setEditingUser(null);
    } catch (error: any) {
      addToast('error', `Update failed: ${error.message}`);
    } finally {
      setOperationLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const username = formData.get('username') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;
    const barangay = formData.get('barangay') as string;

    setOperationLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        username,
        email,
        role,
        barangay: barangay || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLogin: null
      });
      addToast('success', `User ${username} created successfully`);
      setShowAddModal(false);
      // The real-time listener will pick up the new user automatically
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        addToast('error', 'Email already in use');
      } else {
        addToast('error', 'Error adding user: ' + err.message);
      }
    } finally {
      setOperationLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('cemms_user');
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const filteredUsers = users.filter(user =>
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.barangay?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FDF9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCw size={48} className="animate-spin" color="#14B89D" />
        <p style={{ marginTop: 16, color: '#0F5C4B' }}>Loading users...</p>
      </div>
    );
  }

  const userName = currentUser?.email?.split('@')[0] || 'Admin';
  const barangays = [
    'Abangan Norte', 'Abangan Sur', 'Ibayo', 'Lambakin', 'Lias',
    'Loma de Gato', 'Nagbalon', 'Patubig', 'Poblacion I', 'Poblacion II',
    'Prenza I', 'Prenza II', 'Santa Rosa I', 'Santa Rosa II', 'Saog', 'Tabing Ilog'
  ];

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
              <span>{t.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}><X size={16} /></button>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="header-card">
          <div>
            <h1>User Management</h1>
            <p>Manage admin, staff, and regular user accounts</p>
          </div>
          <div className="header-actions">
            <button className="icon-btn" onClick={() => {}}>
              <RefreshCw size={14} /> Sync
            </button>
            <div className="live-badge"><span className="live-dot"></span> LIVE</div>
            <div className="date-badge"><Calendar size={14} /> {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card pastel-teal">
            <div className="stat-icon"><Users size={24} /></div>
            <div className="stat-content">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Users</div>
            </div>
          </div>
          <div className="stat-card pastel-mint">
            <div className="stat-icon"><Shield size={24} /></div>
            <div className="stat-content">
              <div className="stat-value">{stats.admins}</div>
              <div className="stat-label">Admins</div>
            </div>
          </div>
          <div className="stat-card pastel-yellowgreen">
            <div className="stat-icon"><UserCog size={24} /></div>
            <div className="stat-content">
              <div className="stat-value">{stats.staff}</div>
              <div className="stat-label">Staff</div>
            </div>
          </div>
          <div className="stat-card pastel-coral">
            <div className="stat-icon"><User size={24} /></div>
            <div className="stat-content">
              <div className="stat-value">{stats.regular_users}</div>
              <div className="stat-label">Regular Users</div>
            </div>
          </div>
        </div>

        {/* Add User Card */}
        <div className="action-card">
          <div className="action-left">
            <Plus size={28} className="action-icon" />
            <div>
              <h3>Add New User</h3>
              <p>Create staff/admin accounts (automatically active)</p>
            </div>
          </div>
          <button className="add-user-btn" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Add User
          </button>
        </div>

        {/* Users Table */}
        <div className="data-table">
          <div className="table-header">
            <h3><FileText size={18} /> System Users</h3>
            <div className="search-box">
              <Search size={14} />
              <input 
                type="text" 
                placeholder="Search users..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="table-scroll">
            {filteredUsers.length === 0 ? (
              <div className="empty-state">
                <Users size={48} color="#94A3B8" />
                <h4>No users found</h4>
                <p>Click "Add User" to create your first user.</p>
              </div>
            ) : (
              <table className="user-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Barangay</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="user-id">#{user.id.slice(0, 6)}</td>
                      <td>
                        <div className="user-name">
                          {user.role === 'admin' && <Shield size={14} className="role-icon admin" />}
                          {user.role === 'staff' && <UserCog size={14} className="role-icon staff" />}
                          {user.role === 'user' && <User size={14} className="role-icon user" />}
                          {user.username}
                          {user.id === currentUser?.uid && <span className="you-badge">YOU</span>}
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td><span className={`role-badge ${user.role}`}>{user.role.toUpperCase()}</span></td>
                      <td>{user.barangay || '—'}</td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="action-btn edit" 
                            onClick={() => {
                              setEditingUser(user);
                              setShowEditModal(true);
                            }}
                            disabled={operationLoading}
                          >
                            <Pencil size={12} /> Edit
                          </button>
                          {user.id !== currentUser?.uid && (
                            <button 
                              className="action-btn delete" 
                              onClick={() => handleDelete(user.id)}
                              disabled={deleteLoading === user.id}
                            >
                              {deleteLoading === user.id ? (
                                <RefreshCw size={12} className="spin" />
                              ) : (
                                <Trash2 size={12} />
                              )}
                              Delete
                            </button>
                          )}
                        </div>
                       </td>
                     </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ADD USER MODAL */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Plus size={18} /> Add New User</h3>
              <button className="close-modal" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddUser}>
              <div className="modal-body">
                <div className="input-group">
                  <label>Username</label>
                  <input type="text" name="username" required placeholder="Enter username" />
                </div>
                <div className="input-group">
                  <label>Email</label>
                  <input type="email" name="email" required placeholder="Enter email address" />
                </div>
                <div className="input-group">
                  <label>Password</label>
                  <input type="password" name="password" required placeholder="Enter password" />
                </div>
                <div className="input-group">
                  <label>Role</label>
                  <select name="role" required>
                    <option value="" disabled>Select role...</option>
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                    <option value="user">Regular User</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Barangay (optional)</label>
                  <select name="barangay">
                    <option value="">Select barangay...</option>
                    {barangays.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <p style={{ fontSize: 12, color: '#14B89D', marginTop: 8 }}>
                  ✓ Users created by admin are immediately active.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="save-btn" disabled={operationLoading}>
                  {operationLoading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditModal && editingUser && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Pencil size={18} /> Edit User: {editingUser.username}</h3>
              <button className="close-modal" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body">
                <div className="input-group">
                  <label>Username</label>
                  <input type="text" name="username" defaultValue={editingUser.username || ''} required />
                </div>
                <div className="input-group">
                  <label>Email (read-only)</label>
                  <input type="email" value={editingUser.email} readOnly className="readonly" />
                </div>
                <div className="input-group">
                  <label>Role</label>
                  <select name="role" defaultValue={editingUser.role} required>
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                    <option value="user">Regular User</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Barangay</label>
                  <select name="barangay" defaultValue={editingUser.barangay || ''}>
                    <option value="">None</option>
                    {barangays.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="save-btn" disabled={operationLoading}>
                  {operationLoading ? 'Updating...' : 'Update User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin, .spin { animation: spin 1s linear infinite; }

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

        /* Header */
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
          flex-wrap: wrap;
        }
        .icon-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          border: 1px solid #9FE5D5;
          padding: 8px 18px;
          border-radius: 44px;
          font-size: 13px;
          cursor: pointer;
          color: #0F5C4B;
          font-weight: 500;
          transition: all 0.2s;
        }
        .icon-btn:hover {
          background: #E6F7F3;
          transform: translateY(-1px);
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
          50% { opacity:0.5; transform:scale(1.2); }
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

        /* Stats Cards */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          margin-bottom: 28px;
        }
        .stat-card {
          padding: 14px 18px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          position: relative;
          padding-top: 48px;
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.08);
        }
        .stat-card .stat-value { font-size: 24px; font-weight: 800; margin-bottom: 2px; }
        .stat-card .stat-label { font-size: 12px; font-weight: 500; }
        .stat-card .stat-content { text-align: center; }
        .stat-card .stat-icon {
          position: absolute;
          top: 16px;
          left: 16px;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .stat-card.pastel-teal { background: #D6F4EE; border: 1px solid #9FE5D5; }
        .stat-card.pastel-teal .stat-value { color: #0F5C4B; }
        .stat-card.pastel-teal .stat-label { color: #3B7A6A; }
        .stat-card.pastel-mint { background: #DCFCE7; border: 1px solid #BBF7D0; }
        .stat-card.pastel-mint .stat-value { color: #166534; }
        .stat-card.pastel-mint .stat-label { color: #4B5563; }
        .stat-card.pastel-yellowgreen { background: #E9F5DB; border: 1px solid #D4E8B3; }
        .stat-card.pastel-yellowgreen .stat-value { color: #3D5C1A; }
        .stat-card.pastel-yellowgreen .stat-label { color: #5A7C2E; }
        .stat-card.pastel-coral { background: #FFEDD5; border: 1px solid #FED7AA; }
        .stat-card.pastel-coral .stat-value { color: #9A3412; }
        .stat-card.pastel-coral .stat-label { color: #C2410C; }

        /* Action Card */
        .action-card {
          background: #E6F7F3;
          border-radius: 28px;
          padding: 24px 28px;
          margin-bottom: 28px;
          border: 1px solid #9FE5D5;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 20px;
        }
        .action-left {
          display: flex;
          align-items: center;
          gap: 18px;
        }
        .action-icon {
          color: #14B89D;
          background: white;
          padding: 14px;
          border-radius: 60px;
        }
        .action-left h3 {
          color: #0F5C4B;
          margin: 0 0 6px;
          font-size: 20px;
          font-weight: 700;
        }
        .action-left p {
          margin: 0;
          font-size: 14px;
          color: #3B7A6A;
        }
        .add-user-btn {
          background: #14B89D;
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 44px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .add-user-btn:hover {
          background: #0F5C4B;
          transform: translateY(-1px);
        }

        /* Data Table */
        .data-table {
          background: white;
          border-radius: 28px;
          overflow: hidden;
          border: 1px solid #C8E6C9;
        }
        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 28px;
          background: #E9F5DB;
          border-bottom: 1px solid #D4E8B3;
          flex-wrap: wrap;
          gap: 16px;
        }
        .table-header h3 {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #3D5C1A;
          margin: 0;
          font-size: 18px;
          font-weight: 700;
        }
        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          border: 1px solid #9FE5D5;
          border-radius: 44px;
          padding: 6px 16px;
        }
        .search-box input {
          border: none;
          outline: none;
          font-size: 14px;
          width: 200px;
          background: transparent;
        }
        .table-scroll {
          max-height: 520px;
          overflow-y: auto;
          overflow-x: auto;
        }
        .user-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .user-table th, .user-table td {
          padding: 14px 18px;
          text-align: left;
          border-bottom: 1px solid #E6F7F3;
        }
        .user-table th {
          position: sticky;
          top: 0;
          background: #F0FDF4;
          color: #0F5C4B;
          font-weight: 700;
        }
        .user-id { font-weight: 600; color: #64748B; }
        .user-name { display: flex; align-items: center; gap: 8px; }
        .role-icon.admin { color: #8B0000; }
        .role-icon.staff { color: #F59E0B; }
        .role-icon.user { color: #14B89D; }
        .you-badge {
          background: #E9F5DB;
          color: #3D5C1A;
          padding: 2px 10px;
          border-radius: 30px;
          font-size: 10px;
          font-weight: 700;
          margin-left: 10px;
        }
        .role-badge {
          display: inline-block;
          padding: 4px 14px;
          border-radius: 40px;
          font-size: 12px;
          font-weight: 700;
          color: white;
        }
        .role-badge.admin { background: #8B0000; }
        .role-badge.staff { background: #F59E0B; }
        .role-badge.user { background: #14B89D; }
        .action-buttons {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .action-btn {
          background: none;
          border: 1px solid #C8E6C9;
          padding: 5px 14px;
          border-radius: 40px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }
        .action-btn.edit { color: #14B89D; border-color: #9FE5D5; }
        .action-btn.edit:hover { background: #D6F4EE; border-color: #14B89D; }
        .action-btn.delete { color: #DC2626; border-color: #FEE2E2; }
        .action-btn.delete:hover { background: #FEF2F2; border-color: #DC2626; }
        .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 80px 20px;
          color: #94A3B8;
        }
        .empty-state h4 { color: #0F5C4B; margin: 16px 0 8px; }
        .empty-state p { font-size: 14px; }

        /* Modals */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal {
          background: white;
          border-radius: 32px;
          width: 500px;
          max-width: 90%;
          max-height: 85vh;
          overflow-y: auto;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 28px;
          border-bottom: 1px solid #E5E7EB;
        }
        .modal-header h3 {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #0F5C4B;
          margin: 0;
          font-size: 22px;
          font-weight: 700;
        }
        .close-modal {
          background: none;
          border: none;
          font-size: 28px;
          cursor: pointer;
          color: #64748B;
        }
        .modal-body {
          padding: 24px 28px;
        }
        .input-group {
          margin-bottom: 24px;
        }
        .input-group label {
          display: block;
          font-weight: 600;
          color: #0F5C4B;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .input-group input, .input-group select {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #C8E6C9;
          border-radius: 20px;
          font-size: 14px;
          background: #F9FAFB;
        }
        .input-group input.readonly {
          background: #F3F4F6;
          color: #6B7280;
        }
        .modal-footer {
          display: flex;
          gap: 14px;
          padding: 20px 28px;
          border-top: 1px solid #E5E7EB;
        }
        .cancel-btn, .save-btn {
          flex: 1;
          padding: 10px;
          border-radius: 44px;
          font-weight: 600;
          cursor: pointer;
          text-align: center;
          border: none;
          font-size: 14px;
        }
        .save-btn {
          background: #14B89D;
          color: white;
        }
        .save-btn:hover:not(:disabled) { background: #0F5C4B; }
        .cancel-btn {
          background: #F3F4F6;
          border: 1px solid #D1D5DB;
          color: #374151;
        }
        .save-btn:disabled, .cancel-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        @media (max-width: 1024px) {
          .main-content { margin-left: 0; padding: 20px; }
          .stats-grid { grid-template-columns: repeat(2,1fr); }
        }
        @media (max-width: 640px) {
          .stats-grid { grid-template-columns: 1fr; }
          .action-card { flex-direction: column; align-items: stretch; text-align: center; }
          .action-left { justify-content: center; }
          .add-user-btn { justify-content: center; }
          .table-header { flex-direction: column; align-items: stretch; }
          .search-box { width: 100%; }
          .search-box input { width: 100%; }
        }
      `}</style>
    </div>
  );
}