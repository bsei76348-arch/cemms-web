'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAccount, setNewAccount] = useState({ email: '', password: '', role: 'staff', name: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch accounts
  const fetchAccounts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'accounts'));
      const docs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAccounts(docs);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Add account
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      await addDoc(collection(db, 'accounts'), {
        email: newAccount.email,
        password: newAccount.password, // Note: In production, use proper hashing!
        role: newAccount.role,
        name: newAccount.name,
        createdAt: new Date().toISOString()
      });
      
      setMessage('Account added successfully!');
      setNewAccount({ email: '', password: '', role: 'staff', name: '' });
      fetchAccounts();
    } catch (error) {
      console.error('Error adding account:', error);
      setMessage('Error adding account');
    } finally {
      setSaving(false);
    }
  };

  // Delete account
  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this account?')) {
      try {
        await deleteDoc(doc(db, 'accounts', id));
        fetchAccounts();
      } catch (error) {
        console.error('Error deleting account:', error);
      }
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Accounts Management</h1>
      
      {/* Add Account Form */}
      <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h2>Add New Account</h2>
        <form onSubmit={handleAddAccount}>
          <div style={{ marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="Name"
              value={newAccount.name}
              onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
              required
              style={{ padding: '8px', width: '200px', marginRight: '10px' }}
            />
            <input
              type="email"
              placeholder="Email"
              value={newAccount.email}
              onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
              required
              style={{ padding: '8px', width: '200px', marginRight: '10px' }}
            />
            <input
              type="password"
              placeholder="Password"
              value={newAccount.password}
              onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
              required
              style={{ padding: '8px', width: '150px', marginRight: '10px' }}
            />
            <select
              value={newAccount.role}
              onChange={(e) => setNewAccount({ ...newAccount, role: e.target.value })}
              style={{ padding: '8px', marginRight: '10px' }}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: '8px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {saving ? 'Adding...' : 'Add Account'}
            </button>
          </div>
        </form>
        {message && <p style={{ color: 'green' }}>{message}</p>}
      </div>

      {/* Accounts List */}
      <h2>Existing Accounts</h2>
      {accounts.length === 0 ? (
        <p>No accounts yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#eee' }}>
              <th style={{ padding: '10px', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Email</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Role</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '10px' }}>{account.name}</td>
                <td style={{ padding: '10px' }}>{account.email}</td>
                <td style={{ padding: '10px' }}>
                  <span style={{ 
                    background: account.role === 'admin' ? '#dc3545' : '#28a745', 
                    color: 'white', 
                    padding: '2px 8px', 
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    {account.role}
                  </span>
                </td>
                <td style={{ padding: '10px' }}>
                  <button
                    onClick={() => handleDelete(account.id)}
                    style={{ background: '#dc3545', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}