// app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { accountsAuth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getUserRole, UserRole } from '@/lib/auth';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  ClipboardList,
  Leaf,
  Shield,
  UserCog
} from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(accountsAuth, email, password);
      const user = userCredential.user;
      const userRole: UserRole = await getUserRole(user);

      setSuccess('Login successful! Redirecting...');

      setTimeout(() => {
        if (userRole.role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/staff');
        }
      }, 1500);
      
    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.code === 'auth/user-not-found') {
        setError('User not found!');
      } else if (error.code === 'auth/wrong-password') {
        setError('Invalid password!');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email format!');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many attempts. Try again later.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const fillDemoCredentials = (type: 'admin' | 'staff1') => {
    if (type === 'admin') {
      setEmail('admin@cemms.com');
      setPassword('admin123');
    } else if (type === 'staff1') {
      setEmail('staff@cemms.com');
      setPassword('staff123');
    }
  };

  return (
    <div className=\"login-page-wrapper\">
      <Leaf className=\"leaf leaf-1 absolute text-3xl opacity-10\" />
      <Leaf className=\"leaf leaf-2 absolute text-3xl opacity-10 rotate-[-45deg]\" />
      
      <div className=\"login-container\">
        <div className=\"logo-container\">
          <div className=\"logo-icon\">
            <Lock className=\"w-10 h-10\" />
          </div>
          <div className=\"logo-text\">CEMMS</div>
          <div className=\"logo-subtitle\">Secure Staff Login</div>
        </div>
        
        {error && (
          <div className=\"error\">
            <AlertCircle className=\"w-5 h-5\" />
            {error}
          </div>
        )}
        
        {success && (
          <div className=\"success\">
            <CheckCircle2 className=\"w-5 h-5\" />
            {success}
          </div>
        )}
        
        <form onSubmit={handleLogin}>
          <div className=\"form-group\">
            <label htmlFor=\"email\">Email Address</label>
            <input
              type=\"email\"
              id=\"email\"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder=\"Enter your email\"
              disabled={loading}
            />
          </div>
          
          <div className=\"form-group\">
            <label htmlFor=\"password\">Password</label>
            <div className=\"password-wrapper\">
              <input
                type={showPassword ? \"text\" : \"password\"}
                id=\"password\"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder=\"Enter your password\"
                disabled={loading}
              />
              <button
                type=\"button\"
                className=\"password-toggle\"
                onClick={togglePasswordVisibility}
                tabIndex={-1}
              >
              {showPassword ? (
                  <span className=\"toggle-icon\">
                    <EyeOff className=\"w-5 h-5\" />
                  </span>
                ) : (
                  <span className=\"toggle-icon\">
                    <Eye className=\"w-5 h-5\" />
                  </span>
                )}
              </button>
            </div>
          </div>
          
          <button 
            type=\"submit\" 
            className=\"login-btn\"
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In →'}
          </button>
        </form>
        
        <div className=\"demo-credentials\">
          <h4>
            <ClipboardList className=\"w-5 h-5\" />
            Demo Credentials
          </h4>
          <p onClick={() => fillDemoCredentials('admin')} style={{ cursor: 'pointer' }}>
            <strong><Shield className=\"w-5 h-5 inline mr-1\" /> Admin:</strong> admin@cemms.com / admin123
          </p>
          <p onClick={() => fillDemoCredentials('staff1')} style={{ cursor: 'pointer' }}>
            <strong><UserCog className=\"w-5 h-5 inline mr-1\" /> Staff:</strong> staff@cemms.com / staff123
          </p>
          <small style={{ display: 'block', marginTop: '10px', color: '#999' }}>
            Click any to auto-fill
          </small>
        </div>
        
        <div className=\"links\">
          <Link href=\"/\">← Back to Home</Link>
          <Link href=\"/register\">Create Account</Link>
        </div>
        
        <div style={{ height: '100px' }}></div>
      </div>

      <style jsx>{\
        .login-page-wrapper {
          min-height: 100vh;
          width: 100%;
          background-color: #FFF0F5;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          padding: 20px;
        }
        
        .login-container {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 25px;
          padding: 50px 40px;
          width: 100%;
          max-width: 450px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.08);
          border: 2px solid rgba(255, 182, 193, 0.3);
          position: relative;
          z-index: 1;
          animation: fadeIn 0.8s ease-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .logo-icon {
          background: linear-gradient(135deg, #FFB6C1, #98FB98);
          width: 80px;
          height: 80px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          box-shadow: 0 8px 25px rgba(255, 182, 193, 0.4);
          animation: float 3s ease-in-out infinite;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        
        .logo-text {
          font-size: 32px;
          font-weight: 800;
          background: linear-gradient(135deg, #2E8B57, #FF69B4);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-align: center;
          margin-bottom: 8px;
        }
        
        .logo-subtitle {
          color: #666;
          font-size: 14px;
          text-align: center;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        
        .form-group {
          margin-bottom: 25px;
        }
        
        label {
          display: block;
          margin-bottom: 10px;
          color: #2E8B57;
          font-weight: 600;
          font-size: 15px;
        }
        
        input {
          width: 100%;
          padding: 16px 20px;
          border: 2px solid #E0E0E0;
          border-radius: 15px;
          font-size: 16px;
          transition: all 0.3s ease;
          background: #F9F9F9;
        }
        
        input:focus {
          outline: none;
          border-color: #FFB6C1;
          background: white;
          box-shadow: 0 0 0 4px rgba(255, 182, 193, 0.15);
        }
        
        .password-wrapper {
          position: relative;
        }
        
        .password-wrapper input {
          padding-right: 55px;
        }
        
        .password-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
        }
        
        .password-toggle:hover {
          background: rgba(255, 182, 193, 0.2);
        }
        
        .login-btn {
          width: 100%;
          background: linear-gradient(135deg, #2E8B57, #3CB371);
          color: white;
          border: none;
          padding: 18px;
          border-radius: 15px;
          font-size: 17px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 10px;
        }
        
        .login-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(46, 139, 87, 0.4);
        }
        
        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        .error {
          background: #FFEBEE;
          color: #D32F2F;
          padding: 15px;
          border-radius: 12px;
          margin-bottom: 25px;
          text-align: center;
        }
        
        .success {
          background: #E8F5E9;
          color: #2E7D32;
          padding: 15px;
          border-radius: 12px;
          margin-bottom: 25px;
          text-align: center;
        }
        
        .demo-credentials {
          background: #F5F5F5;
          padding: 20px;
          border-radius: 15px;
          margin-top: 30px;
        }
        
        .demo-credentials h4 {
          margin-bottom: 15px;
          color: #2E8B57;
          font-size: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .demo-credentials p {
          color: #555;
          margin-bottom: 10px;
          padding: 8px 12px;
          background: white;
          border-radius: 8px;
          border-left: 4px solid #FFB6C1;
          cursor: pointer;
        }
        
        .demo-credentials p:hover {
          background: #FFF0F5;
          border-left-color: #2E8B57;
        }
        
        .links {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #E0E0E0;
        }
        
        .links a {
          color: #2E8B57;
          text-decoration: none;
          margin: 0 15px;
          padding: 8px 16px;
          border-radius: 20px;
        }
        
        .links a:hover {
          color: #FF69B4;
          background: rgba(255, 182, 193, 0.1);
        }
      \}</style>
    </div>
  );
}
