'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/staff/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else if (err.code === 'auth/user-not-found') {
        setError('No account found with this email');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className=\"min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50\">
      <div className=\"max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-2xl\">
        <div className=\"text-center\">
          <h2 className=\"text-3xl font-bold text-gray-900\">CEMMS Login</h2>
          <p className=\"mt-2 text-sm text-gray-600\">Green Initiative Program</p>
        </div>
        
        {error && (
          <div className=\"bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm\">
            {error}
          </div>
        )}
        
        <form className=\"mt-8 space-y-6\" onSubmit={handleLogin}>
          <div className=\"space-y-4\">
            <div>
              <label className=\"block text-sm font-medium text-gray-700\">Email Address</label>
              <input
                type=\"email\"
                required
                className=\"mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500\"
                placeholder=\"staff@cemms.com\"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className=\"block text-sm font-medium text-gray-700\">Password</label>
              <input
                type=\"password\"
                required
                className=\"mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500\"
                placeholder=\"••••••••\"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type=\"submit\"
            disabled={loading}
            className=\"w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50\"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
