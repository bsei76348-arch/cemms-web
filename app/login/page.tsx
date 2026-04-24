// app/login/page.tsx – Working mock Firebase user (no errors)
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { 
  Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ClipboardList,
  Leaf, Shield, UserCog
} from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    setTimeout(() => {
      if (email === 'admin@cemms.com' && password === 'admin123') {
        // Create a complete mock Firebase user with all required methods
        const mockUser = {
          uid: 'mock-admin-uid',
          email: 'admin@cemms.com',
          displayName: 'Admin',
          emailVerified: true,
          isAnonymous: false,
          phoneNumber: null,
          photoURL: null,
          providerData: [],
          refreshToken: 'mock-refresh-token',
          tenantId: null,
          metadata: {
            creationTime: new Date().toISOString(),
            lastSignInTime: new Date().toISOString(),
          },
          // Required by Firebase SDK
          stsTokenManager: {
            accessToken: 'mock-access-token',
            expirationTime: Date.now() + 3600000,
            refreshToken: 'mock-refresh-token',
          },
          // Internal methods required by Firebase
          _stopProactiveRefresh: () => {},
          _startProactiveRefresh: () => {},
          delete: async () => {},
          getIdToken: async () => 'mock-id-token',
          getIdTokenResult: async () => ({
            token: 'mock-id-token',
            signInProvider: null,
            expirationTime: '',
            issuedAtTime: '',
            authTime: '',
            claims: {}
          }),
          reload: async () => {},
          toJSON: () => ({})
        };
        
        // Override Firebase's currentUser
        Object.defineProperty(auth, 'currentUser', { value: mockUser, writable: true, configurable: true });
        localStorage.setItem('cemms_user', JSON.stringify({ email, role: 'admin', uid: mockUser.uid }));
        
        setSuccess('Login successful! Redirecting to Admin Dashboard...');
        setTimeout(() => router.push('/admin'), 1000);
      } 
      else if (email === 'staff@cemms.com' && password === 'staff123') {
        const mockUser = {
          uid: 'mock-staff-uid',
          email: 'staff@cemms.com',
          displayName: 'Staff',
          emailVerified: true,
          isAnonymous: false,
          phoneNumber: null,
          photoURL: null,
          providerData: [],
          refreshToken: 'mock-refresh-token',
          tenantId: null,
          metadata: {
            creationTime: new Date().toISOString(),
            lastSignInTime: new Date().toISOString(),
          },
          // Required by Firebase SDK
          stsTokenManager: {
            accessToken: 'mock-access-token',
            expirationTime: Date.now() + 3600000,
            refreshToken: 'mock-refresh-token',
          },
          _stopProactiveRefresh: () => {},
          _startProactiveRefresh: () => {},
          delete: async () => {},
          getIdToken: async () => 'mock-id-token',
          getIdTokenResult: async () => ({
            token: 'mock-id-token',
            signInProvider: null,
            expirationTime: '',
            issuedAtTime: '',
            authTime: '',
            claims: {}
          }),
          reload: async () => {},
          toJSON: () => ({})
        };
        Object.defineProperty(auth, 'currentUser', { value: mockUser, writable: true, configurable: true });
        localStorage.setItem('cemms_user', JSON.stringify({ email, role: 'staff', uid: mockUser.uid }));
        setSuccess('Login successful! Redirecting to Staff Dashboard...');
        setTimeout(() => router.push('/staff'), 1000);
      } 
      else {
        setError('Invalid email or password. Use demo credentials below.');
      }
      setLoading(false);
    }, 500);
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const fillDemoCredentials = (type: 'admin' | 'staff1') => {
    if (type === 'admin') {
      setEmail('admin@cemms.com');
      setPassword('admin123');
    } else {
      setEmail('staff@cemms.com');
      setPassword('staff123');
    }
    setError('');
    setSuccess('');
  };

  return (
    <div className="login-page-wrapper">
      <Leaf className="leaf leaf-1" />
      <Leaf className="leaf leaf-2" />
      
      <div className="login-container">
        <div className="logo-container">
          <div className="logo-icon"><Lock className="w-10 h-10" /></div>
          <div className="logo-text">CEMMS</div>
          <div className="logo-subtitle">Secure Login</div>
        </div>
        
        {error && (
          <div className="error">
            <AlertCircle className="w-5 h-5" /> {error}
          </div>
        )}
        {success && (
          <div className="success">
            <CheckCircle2 className="w-5 h-5" /> {success}
          </div>
        )}
        
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                disabled={loading}
              />
              <button type="button" className="password-toggle" onClick={togglePasswordVisibility}>
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div className="button-wrapper">
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In →'}
            </button>
          </div>
        </form>
        
        <div className="demo-credentials">
          <h4><ClipboardList className="w-5 h-5" /> Demo Credentials</h4>
          <p onClick={() => fillDemoCredentials('admin')} className="demo-item">
            <Shield className="w-4 h-4 inline mr-1" /> <strong>Admin:</strong> admin@cemms.com / admin123
          </p>
          <p onClick={() => fillDemoCredentials('staff1')} className="demo-item">
            <UserCog className="w-4 h-4 inline mr-1" /> <strong>Staff:</strong> staff@cemms.com / staff123
          </p>
          <small className="demo-note">Click to auto-fill. Uses mock Firebase login.</small>
        </div>
        
        <div className="links">
          <Link href="/">← Back to Home</Link>
          <Link href="/register">Create Account</Link>
        </div>
      </div>

      <style jsx>{`
        .login-page-wrapper {
          min-height: 100vh;
          width: 100%;
          background: #F8FDF9;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          padding: 20px;
        }
        .leaf {
          position: fixed;
          font-size: 80px;
          opacity: 0.06;
          color: #14B89D;
          pointer-events: none;
          z-index: 0;
        }
        .leaf-1 { top: 5%; left: 5%; transform: rotate(15deg); }
        .leaf-2 { bottom: 5%; right: 5%; transform: rotate(-15deg); }
        .login-container {
          background: white;
          border-radius: 32px;
          padding: 48px 40px;
          width: 100%;
          max-width: 460px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.05);
          border: 1px solid #C8E6C9;
          z-index: 1;
          animation: fadeIn 0.6s ease-out;
          margin: 40px 0;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .logo-container {
          text-align: center;
          margin-bottom: 36px;
        }
        .logo-icon {
          background: linear-gradient(135deg, #14B89D, #0F5C4B);
          width: 80px;
          height: 80px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          color: white;
          box-shadow: 0 8px 20px rgba(20,184,157,0.2);
          animation: float 3s ease-in-out infinite;
        }
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .logo-text {
          font-size: 32px;
          font-weight: 800;
          color: #0F5C4B;
          margin-bottom: 6px;
        }
        .logo-subtitle {
          color: #64748B;
          font-size: 14px;
          letter-spacing: 1px;
        }
        .form-group {
          margin-bottom: 24px;
        }
        label {
          display: block;
          margin-bottom: 8px;
          color: #0F5C4B;
          font-weight: 600;
          font-size: 14px;
        }
        input {
          width: 100%;
          padding: 14px 18px;
          border: 1px solid #C8E6C9;
          border-radius: 20px;
          font-size: 15px;
          background: #F9FAFB;
        }
        input:focus {
          outline: none;
          border-color: #14B89D;
          background: white;
          box-shadow: 0 0 0 3px rgba(20,184,157,0.1);
        }
        .password-wrapper {
          position: relative;
        }
        .password-wrapper input {
          padding-right: 50px;
        }
        .password-toggle {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          cursor: pointer;
          color: #64748B;
        }
        .button-wrapper {
          text-align: center;
          margin-top: 8px;
        }
        .login-btn {
          width: 100%;
          background: #14B89D;
          color: white;
          border: none;
          padding: 14px;
          border-radius: 44px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(20,184,157,0.3);
        }
        .login-btn:hover:not(:disabled) {
          background: #0F5C4B;
          transform: translateY(-1px);
        }
        .login-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .error, .success {
          padding: 12px 16px;
          border-radius: 20px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .error {
          background: #FEF2F2;
          color: #DC2626;
          border: 1px solid #FEE2E2;
        }
        .success {
          background: #DCFCE7;
          color: #166534;
          border: 1px solid #BBF7D0;
        }
        .demo-credentials {
          background: #F9FAFB;
          padding: 20px;
          border-radius: 24px;
          margin-top: 32px;
          border: 1px solid #E9F5DB;
        }
        .demo-credentials h4 {
          margin: 0 0 16px;
          color: #166534;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
        }
        .demo-item {
          color: #4B5563;
          margin-bottom: 10px;
          padding: 10px 14px;
          background: white;
          border-radius: 16px;
          border-left: 4px solid #14B89D;
          cursor: pointer;
          transition: all 0.2s;
        }
        .demo-item:hover {
          background: #E6F7F3;
          border-left-color: #0F5C4B;
          transform: translateX(4px);
        }
        .demo-note {
          display: block;
          margin-top: 12px;
          font-size: 11px;
          color: #94A3B8;
          text-align: center;
        }
        .links {
          text-align: center;
          margin-top: 32px;
          display: flex;
          justify-content: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        .links a {
          color: #14B89D;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          padding: 4px 12px;
          border-radius: 30px;
        }
        .links a:hover {
          color: #0F5C4B;
          background: #E9F5DB;
        }
        @media (max-width: 480px) {
          .login-container { padding: 32px 24px; margin: 20px; }
          .logo-text { font-size: 28px; }
          .leaf { display: none; }
        }
      `}</style>
    </div>
  );
}