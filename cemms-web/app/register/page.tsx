// app/register/page.tsx – No barangay field for staff
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Leaf, Eye, EyeOff, AlertCircle, CheckCircle2, User, Mail, Lock, Phone } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    contactNumber: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validation
    if (!formData.fullName.trim()) {
      setError('Full name is required');
      setLoading(false);
      return;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      setLoading(false);
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      // 1. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // 2. Create user document in Firestore (pending approval)
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: formData.fullName,
        email: formData.email,
        contact: formData.contactNumber || '',
        role: 'staff',
        approved: false,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setSuccess('Account created! Your registration is pending admin approval. You will be notified once approved.');
      
      // Clear form
      setFormData({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        contactNumber: ''
      });
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
      
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Email already in use. Please use a different email.');
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-wrapper">
      <div className="bg-pattern"></div>
      <div className="register-container">
        <div className="register-header">
          <Link href="/" className="back-link">← Back to Home</Link>
          <div className="logo-icon floating">
            <Leaf size={32} />
          </div>
        </div>

        <div className="register-card">
          <h1>Create Staff Account</h1>
          <p className="subtitle">Register to request access. Admin approval required.</p>

          {error && (
            <div className="alert-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert-success">
              <CheckCircle2 size={18} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label><User size={14} /> Full Name</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Juan Dela Cruz"
                required
              />
            </div>

            <div className="form-group">
              <label><Mail size={14} /> Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="staff@cemms.com"
                required
              />
            </div>

            <div className="form-group">
              <label><Lock size={14} /> Password</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimum 6 characters"
                  required
                />
                <button type="button" className="toggle-password" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label><Lock size={14} /> Confirm Password</label>
              <div className="password-wrapper">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  required
                />
                <button type="button" className="toggle-password" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label><Phone size={14} /> Contact Number (Optional)</label>
              <input
                type="tel"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleChange}
                placeholder="09123456789"
              />
            </div>

            <button type="submit" className="register-btn" disabled={loading}>
              {loading ? 'Creating Account...' : 'Request Access'}
            </button>
          </form>

          <p className="login-link">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </div>

      <style jsx>{`
        .register-wrapper {
          min-height: 100vh;
          background: #F8FDF9;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
        }
        .bg-pattern {
          position: fixed;
          inset: 0;
          background-image: radial-gradient(#14B89D 1px, transparent 1px);
          background-size: 40px 40px;
          opacity: 0.03;
          pointer-events: none;
        }
        .register-container {
          max-width: 500px;
          width: 100%;
          background: white;
          border-radius: 32px;
          border: 1px solid #C8E6C9;
          box-shadow: 0 20px 35px rgba(0,0,0,0.05);
          overflow: hidden;
        }
        .register-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 28px;
          background: #E9F5DB;
          border-bottom: 1px solid #D4E8B3;
        }
        .back-link {
          color: #166534;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
        }
        .back-link:hover {
          text-decoration: underline;
        }
        .logo-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #14B89D, #0F5C4B);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .register-card {
          padding: 32px 28px;
        }
        h1 {
          font-size: 28px;
          font-weight: 700;
          color: #0F5C4B;
          margin-bottom: 8px;
        }
        .subtitle {
          color: #64748B;
          font-size: 14px;
          margin-bottom: 28px;
        }
        .alert-error, .alert-success {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 14px;
          margin-bottom: 24px;
        }
        .alert-error {
          background: #FEF2F2;
          color: #DC2626;
          border: 1px solid #FEE2E2;
        }
        .alert-success {
          background: #DCFCE7;
          color: #166534;
          border: 1px solid #BBF7D0;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #0F5C4B;
          margin-bottom: 8px;
        }
        input {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #C8E6C9;
          border-radius: 20px;
          font-size: 14px;
          background: white;
          transition: all 0.2s;
        }
        input:focus {
          outline: none;
          border-color: #14B89D;
          box-shadow: 0 0 0 3px rgba(20,184,157,0.1);
        }
        .password-wrapper {
          position: relative;
        }
        .password-wrapper input {
          padding-right: 45px;
        }
        .toggle-password {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #94A3B8;
        }
        .register-btn {
          width: 100%;
          background: #14B89D;
          color: white;
          border: none;
          padding: 14px;
          border-radius: 44px;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 12px;
        }
        .register-btn:hover:not(:disabled) {
          background: #0F5C4B;
          transform: translateY(-2px);
        }
        .register-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .login-link {
          text-align: center;
          margin-top: 28px;
          font-size: 14px;
          color: #4B5563;
        }
        .login-link a {
          color: #14B89D;
          text-decoration: none;
          font-weight: 600;
        }
        .login-link a:hover {
          text-decoration: underline;
        }
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .floating {
          animation: float 3s ease-in-out infinite;
        }
        @media (max-width: 480px) {
          .register-card {
            padding: 24px 20px;
          }
          h1 {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
}